/* eslint-disable no-console */
import { mediaClientUrl, mediaClientAppId, shareScreen, isGuide } from '../config.js';
import { sleep } from '../helpers/async.js';
import { querySelector, toggleClassName } from '../helpers/dom.js';
import { uuidv4 } from '../helpers/strings.js';
import { showError, showInfo } from '../notify/notify.js';
import { camEncodings, removeVideoAudio, screenshareEncodings, setMediaSoupDebugLevel } from './mediaHelpers.js';

// Enable mediasoup logging
const mediaSoupDebugLevel = '*';

const pollDelay = 10000;

export class MediaClient {
  // Permanent parameters...
  events = undefined;
  videoNode = undefined;
  socket = undefined; // TODO!
  myPeerId = undefined;
  device = undefined;

  videoStarted = false;
  audioStarted = false;

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
    setMediaSoupDebugLevel(mediaSoupDebugLevel);
  }

  onUnload() {
    this.sig('leave', {}, true);
  }

  init() {
    return new Promise((resolve, reject) => {
      this.myPeerId = uuidv4();
      showInfo('Initializing media client...'); // ' with peerId ' + this.myPeerId);
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
        console.log('[MediaClient:joinRoom]: success', {
          routerRtpCapabilities,
        });
        this.joined = true;
        // $('#leave-room').style.display = 'initial';
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
        const error = new Error('Poll failed: ' + err.message || err);
        // eslint-disable-next-line no-console
        console.error('[MediaClient:joinRoom]: poll error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      }
    }, pollDelay);
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

    this.events.emit('MediaClient:roomLeft');

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

  async pollAndUpdate() {
    const { peers, activeSpeaker, error } = await this.sig('sync');
    console.log('[MediaClient:pollAndUpdate]', {
      peers,
      activeSpeaker,
      error,
    });
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
      const url = mediaClientUrl + mediaClientAppId + endpoint;
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

  getCamPausedState() {
    // return !$('#local-cam-checkbox').checked;
    return false;
  }

  getMicPausedState() {
    // return !$('#local-mic-checkbox').checked;
    return false;
  }

  // utility function to create a transport and hook up signaling logic
  // appropriate to the transport's direction
  async createTransport(direction) {
    showInfo(`Create ${direction} transport`);

    // ask the server to create a server-side transport object and send
    // us back the info we need to create a client-side transport
    const { transportOptions } = await this.sig('create-transport', { direction });
    console.log('[MediaClient:createTransport]: Transport options', { transportOptions });

    let transport;
    if (direction === 'recv') {
      transport = await this.device.createRecvTransport(transportOptions);
    } else if (direction === 'send') {
      transport = await this.device.createSendTransport(transportOptions);
    } else {
      // throw new Error(`bad transport 'direction': ${direction}`);
      const error = new Error(`bad transport 'direction': ${direction}`);
      // eslint-disable-next-line no-console
      console.error('[MediaClient:createTransport]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }

    // mediasoup-client will emit a connect event when media needs to
    // start flowing for the first time. send dtlsParameters to the
    // server, then call callback() on success or errback() on failure.
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      console.log('[MediaClient:createTransport:connect] transport connect event', {
        direction,
      });
      const { error: err } = await this.sig('connect-transport', {
        transportId: transportOptions.id,
        dtlsParameters,
      });
      if (err) {
        // err('error connecting transport', direction, error);
        const error = new Error('Error connecting transport: ' + err.message || err);
        // eslint-disable-next-line no-console
        console.error('[MediaClient:createTransport:connect]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        errback();
        return;
      }
      callback();
    });

    if (direction === 'send') {
      // sending transports will emit a produce event when a new track
      // needs to be set up to start sending. the producer's appData is
      // passed as a parameter
      transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        const { mediaTag } = appData;
        console.log('[MediaClient:createTransport:produce] transport produce event', {
          mediaTag,
        });
        // we may want to start out paused (if the checkboxes in the ui
        // aren't checked, for each media type. not very clean code, here
        // but, you know, this isn't a real application.)
        let paused = false;
        if (mediaTag === 'cam-video') {
          paused = this.getCamPausedState();
        } else if (mediaTag === 'cam-audio') {
          paused = this.getMicPausedState();
        }
        // tell the server what it needs to know from us in order to set
        // up a server-side producer object, and get back a
        // producer.id. call callback() on success or errback() on
        // failure.
        const { error: err, id } = await this.sig('send-track', {
          transportId: transportOptions.id,
          kind,
          rtpParameters,
          paused,
          appData,
        });
        if (err) {
          const error = new Error('Error setting up server-side producer: ' + err.message || err);
          // eslint-disable-next-line no-console
          console.error('[MediaClient:createTransport:produce]: error', error);
          debugger; // eslint-disable-line no-debugger
          showError(error);
          errback();
          return;
        }
        callback({ id });
      });
    }

    // for this simple demo, any time a transport transitions to closed,
    // failed, or disconnected, leave the room and reset
    transport.on('connectionstatechange', async (state) => {
      console.log('[MediaClient:createTransport:produce] connectionstatechange', {
        id: transport.id,
        state,
      });
      // for this simple sample code, assume that transports being
      // closed is an error (we never close these transports except when
      // we leave the room)
      if (state === 'closed' || state === 'failed' || state === 'disconnected') {
        console.log('[MediaClient:createTransport:produce] transport closed');
        this.leaveRoom();
      }
    });

    return transport;
  }

  async startScreenshare() {
    if (!this.joined) {
      const error = new Error('Room has not joined');
      // eslint-disable-next-line no-console
      console.error('[MediaClient:startScreenshare]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }

    showInfo('Start screen share...');
    // $('#share-screen').style.display = 'none';

    // make sure we've joined the room and that we have a sending
    // transport
    if (!this.sendTransport) {
      this.sendTransport = await this.createTransport('send');
    }

    // get a screen share track
    this.localScreen = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    // create a producer for video
    this.screenVideoProducer = await this.sendTransport.produce({
      track: this.localScreen.getVideoTracks()[0],
      encodings: screenshareEncodings(),
      appData: { mediaTag: 'screen-video' },
    });

    // create a producer for audio, if we have it
    if (this.localScreen.getAudioTracks().length) {
      this.screenAudioProducer = await this.sendTransport.produce({
        track: this.localScreen.getAudioTracks()[0],
        appData: { mediaTag: 'screen-audio' },
      });
    }

    // handler for screen share stopped event (triggered by the
    // browser's built-in screen sharing ui)
    this.screenVideoProducer.track.onended = async () => {
      console.log('[MediaClient:startScreenshare] screen share stopped');
      try {
        await this.screenVideoProducer.pause();
        const { error } = await this.sig('close-producer', {
          producerId: this.screenVideoProducer.id,
        });
        await this.screenVideoProducer.close();
        this.screenVideoProducer = null;
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[MediaClient:startScreenshare]: error', error);
          debugger; // eslint-disable-line no-debugger
          showError(error);
          // throw error;
          // err(error);
        }
        if (this.screenAudioProducer) {
          const { error } = await this.sig('close-producer', {
            producerId: this.screenAudioProducer.id,
          });
          await this.screenAudioProducer.close();
          this.screenAudioProducer = null;
          if (error) {
            // eslint-disable-next-line no-console
            console.error('[MediaClient:startScreenshare]: error', error);
            debugger; // eslint-disable-line no-debugger
            showError(error);
            // throw error;
            // err(error);
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[MediaClient:startScreenshare]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        // throw error;
      }
      // $('#local-screen-pause-ctrl').style.display = 'none';
      // $('#local-screen-audio-pause-ctrl').style.display = 'none';
      // $('#share-screen').style.display = 'initial';
    };

    // $('#local-screen-pause-ctrl').style.display = 'block';
    // if (screenAudioProducer) {
    //   $('#local-screen-audio-pause-ctrl').style.display = 'block';
    // }
  }

  async startCamera() {
    if (this.localCam) {
      return;
    }
    console.log('[MediaClient:startCamera]: start camera');
    try {
      this.localCam = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err) {
      // console.error('start camera error', e);
      const error = new Error('Start camera failed: ' + err.message || err);
      // eslint-disable-next-line no-console
      console.error('[MediaClient:startCamera]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
  }

  async sendCameraStreams() {
    if (!this.joined) {
      const error = new Error('Room has not joined');
      // eslint-disable-next-line no-console
      console.error('[MediaClient:sendCameraStreams]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }

    showInfo('Send camera streams...');
    // $('#send-camera').style.display = 'none';

    // make sure we've joined the room and started our camera. these
    // functions don't do anything if they've already been called this
    // session
    await this.startCamera();

    // create a transport for outgoing media, if we don't already have one
    if (!this.sendTransport) {
      this.sendTransport = await this.createTransport('send');
    }

    // start sending video. the transport logic will initiate a
    // signaling conversation with the server to set up an outbound rtp
    // stream for the camera video track. our createTransport() function
    // includes logic to tell the server to start the stream in a paused
    // state, if the checkbox in our UI is unchecked. so as soon as we
    // have a client-side camVideoProducer object, we need to set it to
    // paused as appropriate, too.
    this.camVideoProducer = await this.sendTransport.produce({
      track: this.localCam.getVideoTracks()[0],
      encodings: camEncodings(),
      appData: { mediaTag: 'cam-video' }
    });
    if (this.getCamPausedState()) {
      try {
        await this.camVideoProducer.pause();
      } catch (e) {
        console.error(e);
      }
    }

    // same thing for audio, but we can use our already-created
    this.camAudioProducer = await this.sendTransport.produce({
      track: this.localCam.getAudioTracks()[0],
      appData: { mediaTag: 'cam-audio' },
    });
    if (this.getMicPausedState()) {
      try {
        this.camAudioProducer.pause();
      } catch (e) {
        console.error(e);
      }
    }

    // $('#stop-streams').style.display = 'initial';
    // showCameraInfo();
  }

  startVideo() {
    if (this.videoStarted) {
      return;
    }
    let startPromise;
    if (isGuide) {
      if (shareScreen) {
        startPromise = this.startScreenshare();
      } else {
        startPromise = this.sendCameraStreams();
      }
    } else {
      // TODO: Connect to video stream
      startPromise = sleep(2000);
    }
    startPromise
      .then(() => {
        toggleClassName(this.videoNode, 'visible', true);
        this.events.emit('MediaClient:videoStarted');
      })
      .catch((err) => {
        const error = new Error('Video start failed: ' + err.message);
        // eslint-disable-next-line no-console
        console.error('[MediaClient:startVideo]: error', error, { err });
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      });
  }

  stopVideo() {
    if (!this.videoStarted) {
      return;
    }
    toggleClassName(this.videoNode, 'visible', false);
    this.events.emit('MediaClient:videoStopped');
  }
}
