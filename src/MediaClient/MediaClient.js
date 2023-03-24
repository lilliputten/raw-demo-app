import {mediaClientUrl} from '../config.js';
import { querySelector } from '../helpers/dom.js';
import { uuidv4 } from '../helpers/strings.js';
import { showError, showInfo } from '../notify/notify.js';
import { removeVideoAudio, sortPeers } from './mediaHelpers.js';

const appPath = '/appId005/';

export class MediaClient {
  // Permanent parameters...
  events = undefined;
  videoNode = undefined;
  socket = undefined; // TODO!
  myPeerId = undefined;
  device = undefined;

  // Media parameters...
  camAudioProducer = undefined;
  camVideoProducer = undefined;
  consumers = [];
  currentActiveSpeaker = {};
  lastPollSyncData = {};
  localCam = undefined;
  localScreen = undefined;
  pollingInterval = undefined;
  recvTransport = undefined;
  screenAudioProducer = undefined;
  screenVideoProducer = undefined;
  sendTransport = undefined;

  // Session-time parameters...
  inited = false;
  joined = false;

  constructor({ events }) {
    this.events = events;
    this.videoNode = querySelector('#videoView');
    this.events.on('tourSessionStarted', ({ socket }) => {
      this.socket = socket;
      this.joinRoom();
    });
    this.events.on('tourSessionStopped', () => {
      /* // Close connection...
       * if (this.started) {
       *   this.stop();
       * }
       */
      this.leaveRoom();
      this.socket = undefined;
    });
  }

  onUnload() {
    this.sig('leave', {}, true);
  }

  init() {
    return new Promise((resolve, reject) => {
      this.myPeerId = uuidv4();
      showInfo('Initializing media client with peerId ' + this.myPeerId);
      try {
        this.device = new window.mediasoup.Device();
        // TODO: Check device?
        // use sendBeacon to tell the server we're disconnecting when
        // the page unloads
        this._bound_onUnload;
        window.addEventListener('unload', this._bound_onUnload);
        // Success
        this.inited = true;
        resolve();
      } catch (err) {
        let errText = 'Media client initialization failed';
        if (err.name === 'UnsupportedError') {
          errText += ': Browser not supported for video calls';
        }
        if (err.message) {
          errText += ': ' + err.message;
        }
        const error = new Error(errText);
        // eslint-disable-next-line no-console
        console.error('[MediaClient:init]: error', errText, { err, error });
        debugger; // eslint-disable-line no-debugger
        showError(error);
        reject(error);
      }
    });
  }

  destroy() {
    if (this.inited) {
      if (this._bound_onUnload) {
        window.addEventListener('unload', this._bound_onUnload);
      }
      this.inited = false;
    }
  }

  async joinRoom() {
    if (this.joined) {
      return;
    }
    if (!this.inited) {
      return;
    }
    // log('join room');
    // $('#join-control').style.display = 'none';

    try {
      // signal that we're a new peer and initialize our
      // mediasoup-client device, if this is our first time connecting
      const { routerRtpCapabilities } = await this.sig('join-as-new-peer');
      if (!this.device.loaded && routerRtpCapabilities) {
        await this.device.load({ routerRtpCapabilities });
        this.joined = true;
        // $('#leave-room').style.display = 'initial';
        // TODO: Sent event
        this.events.emit('MediaClient:roomJoined');
      }
    } catch (err) {
      const error = new Error('Media client start failed: ' + err.message);
      // eslint-disable-next-line no-console
      console.error('[MediaClient:joinRoom]: error', error, { err });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }

    // super-simple signaling: let's poll at 1-second intervals
    this.pollingInterval = setInterval(async () => {
      const { error: err } = await this.pollAndUpdate();
      if (err) {
        clearInterval(this.pollingInterval);
        const error = new Error('Poll failed: ' + err.message);
        // eslint-disable-next-line no-console
        console.error('[MediaClient:joinRoom]: poll error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      }
    }, 1000);
  }

  async stopTransports() {
    // closing the transports closes all producers and consumers. we
    // don't need to do anything beyond closing the transports, except
    // to set all our local variables to their initial states
    try {
      if (this.recvTransport) {
        await this.recvTransport.close();
        this.recvTransport = undefined;
      }
      if (this.sendTransport) {
        await this.sendTransport.close();
        this.sendTransport = undefined;
      }
    } catch (err) {
      const error = new Error('Transports stop failed: ' + err.message);
      // eslint-disable-next-line no-console
      console.error('[MediaClient:leaveRoom]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
  }

  async leaveRoom() {
    if (!this.joined) {
      return;
    }

    showInfo('Leaving room...');

    // stop polling
    clearInterval(this.pollingInterval);

    // close everything on the server-side (transports, producers, consumers)
    const { error: err } = await this.sig('leave');
    if (err) {
      const error = new Error('Leave request failed: ' + err.message);
      // eslint-disable-next-line no-console
      console.error('[MediaClient:leaveRoom]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }

    this.stopTransports();

    this.camVideoProducer = undefined;
    this.camAudioProducer = undefined;
    this.screenVideoProducer = undefined;
    this.screenAudioProducer = undefined;
    this.localCam = undefined;
    this.localScreen = undefined;
    this.lastPollSyncData = {};
    this.consumers = [];

    this.joined = false;

    /* // TODO?
     * // hacktastically restore ui to initial state
     * $('#join-control').style.display = 'initial';
     * $('#send-camera').style.display = 'initial';
     * $('#stop-streams').style.display = 'none';
     * $('#remote-video').innerHTML = '';
     * $('#share-screen').style.display = 'initial';
     * $('#local-screen-pause-ctrl').style.display = 'none';
     * $('#local-screen-audio-pause-ctrl').style.display = 'none';
     * showCameraInfo();
     * updateCamVideoProducerStatsDisplay();
     * updateScreenVideoProducerStatsDisplay();
     * updatePeersDisplay();
     */
  }

  async pollAndUpdate() {
    const { peers, activeSpeaker, error } = await this.sig('sync');
    if (error) {
      return { error };
    }

    // Always update bandwidth stats and active speaker display
    this.currentActiveSpeaker = activeSpeaker;
    /* // Show info...
     * updateActiveSpeaker();
     * updateCamVideoProducerStatsDisplay();
     * updateScreenVideoProducerStatsDisplay();
     * updateConsumersStatsDisplay();
     */

    /* // Show peers info...
     * // Decide if we need to update tracks list and video/audio
     * // elements. build list of peers, sorted by join time, removing last
     * // seen time and stats, so we can easily do a deep-equals
     * // comparison. compare this list with the cached list from last
     * // poll.
     * const thisPeersList = sortPeers(peers),
     *   lastPeersList = sortPeers(this.lastPollSyncData);
     * if (!window._.isEqual(thisPeersList, lastPeersList)) {
     *   updatePeersDisplay(peers, thisPeersList);
     * }
     */

    // If a peer has gone away, we need to close all consumers we have
    // for that peer and remove video and audio elements
    for (const id in this.lastPollSyncData) {
      if (!peers[id]) {
        showInfo(`Peer ${id} has exited`);
        this.consumers.forEach((consumer) => {
          if (consumer.appData.peerId === id) {
            this.closeConsumer(consumer);
          }
        });
      }
    }

    // If a peer has stopped sending media that we are consuming, we
    // need to close the consumer and remove video and audio elements
    this.consumers.forEach((consumer) => {
      const { peerId, mediaTag } = consumer.appData;
      if (!peers[peerId].media[mediaTag]) {
        showInfo(`Peer ${peerId} has stopped transmitting ${mediaTag}`);
        this.closeConsumer(consumer);
      }
    });

    this.lastPollSyncData = peers;
    return {}; // return an empty object if there isn't an error
  }

  async closeConsumer(consumer) {
    if (!consumer) {
      return;
    }
    showInfo('Closing consumer ' + consumer.appData.peerId + ' ' + consumer.appData.mediaTag);
    try {
      // tell the server we're closing this consumer. (the server-side
      // consumer may have been closed already, but that's okay.)
      await this.sig('close-consumer', { consumerId: consumer.id });
      await consumer.close();
      this.consumers = this.consumers.filter((c) => c !== consumer);
      removeVideoAudio(consumer);
    } catch (err) {
      const error = new Error('Coosumer close failed: ' + err.message);
      // eslint-disable-next-line no-console
      console.error('[MediaClient:joinRoom]: error', error, { err });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      // throw error;
    }
  }

  async sig(endpoint, data, beacon) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      };
      const body = JSON.stringify({ ...data, peerId: this.myPeerId });
      const url = mediaClientUrl + appPath + endpoint;
      const fetchParams = {
        method: 'POST',
        body,
        headers,
        mode: 'cors',
      };
      console.log('[MediaClient:sig] start', {
        url,
        headers,
        fetchParams,
        body,
        endpoint,
        data,
        beacon,
      });
      debugger;
      if (beacon) {
        navigator.sendBeacon(url, body);
        return null;
      }
      const response = await fetch(url, fetchParams);
      console.log('[MediaClient:sig] success', {
        response,
        url,
        headers,
        fetchParams,
        body,
        endpoint,
        data,
        beacon,
      });
      debugger;
      return await response.json();
    } catch (err) {
      const error = new Error('Remote request (sig) failed: ' + err.message);
      // eslint-disable-next-line no-console
      console.error('[MediaClient:sig]: error', error, { err });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
      // return { error };
    }
  }
}
