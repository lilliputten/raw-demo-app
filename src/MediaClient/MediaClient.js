/* eslint-disable no-console */
import { mediaClientUrl, mediaClientAppId, shareScreen, isGuide } from '../config.js';
import { sleep } from '../helpers/async.js';
import { querySelector, toggleClassName } from '../helpers/dom.js';
import { uuidv4 } from '../helpers/strings.js';
import { showError, showInfo } from '../notify/notify.js';
import {
  camEncodings,
  findAudioPeer,
  findAudioPeerId,
  findVideoPeer,
  findVideoPeerId,
  getPeerAudioMediaTag,
  getPeerVideoMediaTag,
  removeVideoAudio,
  screenshareEncodings,
  setMediaSoupDebugLevel,
} from './mediaHelpers.js';

// Enable mediasoup logging
const mediaSoupDebugLevel = false; // '*';

const pollDelay = 10000;

// Use own socket interface
const useExternalSocket = false;

export class MediaClient {
  // Permanent parameters...
  events = undefined;
  // videoNode = undefined;
  mainNode = undefined;
  socket = undefined; // TODO!
  myPeerId = undefined;
  device = undefined;

  // Current video and audio...
  videoStarted = false;
  audioStarted = false;
  activeVideoPeerId = undefined;
  activeAudioPeerId = undefined;

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

  constructor({ events, mainNode }) {
    if (!events) {
      const error = new Error('Events orchestrator has not passed to constructor');
      // eslint-disable-next-line no-console
      console.error('[MediaClient:constructor]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    if (!mainNode) {
      const error = new Error('Root dom node has not passed to constructor');
      // eslint-disable-next-line no-console
      console.error('[MediaClient:constructor]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    this.events = events;
    this.mainNode = mainNode;
    // this.videoNode = querySelector('#videoView');
    setMediaSoupDebugLevel(mediaSoupDebugLevel);
  }

  onUnload() {
    this.sig('leave', {});
  }

  startSocket() {
    return new Promise((resolve, reject) => {
      if (useExternalSocket) {
        return Promise.resolve();
      }
      /* console.log('[MediaClient:start]: Starting socket', {
       *   commonSocketUrl,
       *   commonSocketAppId,
       * });
       */
      const opts = {
        path: mediaClientAppId,
        transports: ['websocket'],
      };
      this.socket = window.io(mediaClientUrl, opts);
      this.socket.on('connect', resolve);
      this.socket.on('connect_error', reject);
      this.socket.on('connect_failed', reject);
    });
  }

  stopSocket() {
    if (!useExternalSocket) {
      this.socket.disconnect();
      this.socket.destroy();
    }
    this.socket = undefined;
  }

  startSession() {
    this.startSocket()
      .then(() => {
        return this.joinRoom();
      })
      .catch((err) => {
        const error = new Error('Session start failed: ' + (err.message || err));
        // eslint-disable-next-line no-console
        console.error('[MediaClient:startSession]: error', error, { err });
        debugger; // eslint-disable-line no-debugger
        showError(error);
        // throw error;
      });
  }

  stopSession() {
    this.leaveRoom();
    this.stopSocket();
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
        // Add join/leave events...
        this.events.on('tourSessionStarted', ({ socket }) => {
          if (!useExternalSocket && socket) {
            this.socket = socket;
          }
          this.startSession();
        });
        this.events.on('tourSessionStopped', () => {
          this.stopSession();
        });
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
      this.device = undefined;
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
      // Signal that we're a new peer and initialize our
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
        // Super-simple signaling: let's poll at intervals
        this.pollAndUpdate();
        this.pollingInterval = setInterval(async () => {
          try {
            const result = await this.pollAndUpdate();
            const { error: err } = result;
            if (err) {
              throw err;
            }
          } catch (err) {
            const error = new Error('Poll failed: ' + (err.message || err));
            // eslint-disable-next-line no-console
            console.error('[MediaClient:joinRoom]: poll error', error);
            debugger; // eslint-disable-line no-debugger
            showError(error);
            // clearInterval(this.pollingInterval); // ???
            throw error;
          }
        }, pollDelay);
      }
    } catch (err) {
      const error = new Error('Media client start failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:joinRoom]: error', error, { err });
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
      const error = new Error('Leave request failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:leaveRoom]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }

    await Promise.all([this.stopVideo(), this.stopAudio()]);
    await this.stopTransports();

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
      const error = new Error('Transports stop failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:stopTransports]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
  }

  findConsumerForTrack(peerId, mediaTag) {
    return this.consumers.find(
      (c) => c.appData.peerId === peerId && c.appData.mediaTag === mediaTag,
    );
  }

  async pauseConsumer(consumer) {
    if (consumer) {
      const { peerId, mediaTag } = consumer.appData;
      console.log('[MediaClient:pauseConsumer]', { peerId, mediaTag });
      try {
        await this.sig('pause-consumer', { consumerId: consumer.id });
        await consumer.pause();
      } catch (e) {
        console.error(e);
      }
    }
  }

  async resumeConsumer(consumer) {
    if (consumer) {
      const { peerId, mediaTag } = consumer.appData;
      console.log('[MediaClient:resumeConsumer]', { peerId, mediaTag });
      try {
        await this.sig('resume-consumer', { consumerId: consumer.id });
        await consumer.resume();
      } catch (e) {
        console.error(e);
      }
    }
  }

  addVideoAudio(consumer) {
    if (!(consumer && consumer.track)) {
      return;
    }
    if (!this.mainNode) {
      const error = new Error('Root dom node is not specified');
      // eslint-disable-next-line no-console
      console.error('[MediaClient:addVideoAudio]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    const isVideo = consumer.kind === 'video';
    const el = document.createElement(consumer.kind);
    // set some attributes on our audio and video elements to make
    // mobile Safari happy. note that for audio to play you need to be
    // capturing from the mic/camera
    if (isVideo) {
      el.setAttribute('playsinline', true);
    } else {
      el.setAttribute('playsinline', true);
      el.setAttribute('autoplay', true);
    }
    this.mainNode.appendChild(el);
    el.srcObject = new MediaStream([consumer.track.clone()]);
    el.consumer = consumer;
    // let's "yield" and return before playing, rather than awaiting on
    // play() succeeding. play() will not succeed on a producer-paused
    // track until the producer unpauses.
    el.play()
      .then(() => {})
      .catch((err) => {
        const error = new Error('Stream playing error: ' + (err.message || err));
        // eslint-disable-next-line no-console
        console.error('[MediaClient:addVideoAudio]: error', error, { err });
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      });
    if (isVideo) {
      toggleClassName(el, 'visible', true);
    }
  }

  removeVideoAudio(consumer) {
    document.querySelectorAll(consumer.kind).forEach((v) => {
      if (v.consumer === consumer) {
        v.parentNode.removeChild(v);
      }
    });
  }

  async subscribeToTrack(peerId, mediaTag) {
    console.log('[MediaClient:subscribeToTrack] subscribe to track', peerId, mediaTag);

    // create a receive transport if we don't already have one
    if (!this.recvTransport) {
      this.recvTransport = await this.createTransport('recv');
    }

    // if we do already have a consumer, we shouldn't have called this
    // method
    let consumer = this.findConsumerForTrack(peerId, mediaTag);
    if (consumer) {
      const error = new Error('already have consumer for track ' + peerId + ' (' + mediaTag + ')');
      // eslint-disable-next-line no-console
      console.error('[MediaClient:subscribeToTrack]: error', error, { peerId, mediaTag });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      // throw error;
      return;
    }

    // ask the server to create a server-side consumer object and send
    // us back the info we need to create a client-side consumer
    const consumerParameters = await this.sig('recv-track', {
      mediaTag,
      mediaPeerId: peerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
    console.log('[MediaClient:subscribeToTrack] consumer parameters', consumerParameters);
    consumer = await this.recvTransport.consume({
      ...consumerParameters,
      appData: { peerId, mediaTag },
    });
    console.log('[MediaClient:subscribeToTrack] created new consumer', consumer.id);

    // the server-side consumer will be started in paused state. wait
    // until we're connected, then send a resume request to the server
    // to get our first keyframe and start displaying video
    while (this.recvTransport.connectionState !== 'connected') {
      console.log('[MediaClient:subscribeToTrack] transport connstate', {
        connectionState: this.recvTransport.connectionState,
      });
      await sleep(100);
    }
    // okay, we're ready. let's ask the peer to send us media
    await this.resumeConsumer(consumer);

    // keep track of all our consumers
    this.consumers.push(consumer);

    // ui
    this.addVideoAudio(consumer);
    // updatePeersDisplay();
  }

  async unsubscribeFromTrack(peerId, mediaTag) {
    const consumer = this.findConsumerForTrack(peerId, mediaTag);
    if (!consumer) {
      return;
    }
    console.log('[MediaClient:unsubscribeFromTrack] unsubscribe from track', peerId, mediaTag);
    try {
      await this.closeConsumer(consumer);
    } catch (err) {
      const error = new Error('Failed unsubscribing from track: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:unsubscribeFromTrack]: error', error, { peerId, mediaTag });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      // throw error;
      return;
    }
    // force update of ui
    // updatePeersDisplay();
  }

  async unsubscribeFromVideoTrack() {
    const { lastPollSyncData: peers, videoStarted, activeVideoPeerId } = this;
    if (!videoStarted || !activeVideoPeerId) {
      return;
    }
    const peer = peers[activeVideoPeerId];
    await this.unsubscribeFromTrack(activeVideoPeerId, getPeerVideoMediaTag(peer));
    this.activeVideoPeerId = undefined;
  }

  async unsubscribeFromAudioTrack() {
    const { lastPollSyncData: peers, audioStarted, activeAudioPeerId } = this;
    if (!audioStarted || !activeAudioPeerId) {
      return;
    }
    const peer = peers[activeAudioPeerId];
    await this.unsubscribeFromTrack(activeAudioPeerId, getPeerAudioMediaTag(peer));
    this.activeAudioPeerId = undefined;
  }

  async subscribeToVideoTrack() {
    const { lastPollSyncData: peers, videoStarted, activeVideoPeerId } = this;
    const videoPeerId = findVideoPeerId(peers);
    if (!videoStarted || !videoPeerId) {
      if (activeVideoPeerId) {
        return this.unsubscribeFromVideoTrack();
      }
      return;
    }
    console.log('[MediaClient:subscribeToVideoTrack]: done', {
      videoPeerId,
      peers,
    });
    if (
      activeVideoPeerId &&
      activeVideoPeerId !== videoPeerId &&
      this.consumers[activeVideoPeerId]
    ) {
      // NOTE: Inactive peers can be removed in `pollAndUpdate`
      const peer = peers[activeVideoPeerId];
      await this.unsubscribeFromTrack(activeVideoPeerId, getPeerVideoMediaTag(peer));
      this.activeVideoPeerId = undefined;
    }
    if (!activeVideoPeerId) {
      const peer = peers[videoPeerId];
      await this.subscribeToTrack(videoPeerId, getPeerVideoMediaTag(peer));
      this.activeVideoPeerId = videoPeerId;
    }
    if (this.activeVideoPeerId) {
      this.videoStarted = true;
      // TODO: Send event (video totally connected)?
      console.log('[MediaClient:subscribeToVideoTrack]: started');
    }
  }

  async subscribeToAudioTrack() {
    const {
      currentActiveSpeaker,
      lastPollSyncData: peers,
      // consumers,
      audioStarted,
      activeAudioPeerId,
    } = this;
    const audioPeerId = currentActiveSpeaker?.peerId || findAudioPeerId(peers);
    if (!audioStarted || !audioPeerId) {
      if (activeAudioPeerId) {
        return this.unsubscribeFromAudioTrack();
      }
      return;
    }
    console.log('[MediaClient:subscribeToAudioTrack]: done', {
      audioPeerId,
      peers,
    });
    if (
      activeAudioPeerId &&
      activeAudioPeerId !== audioPeerId &&
      this.consumers[activeAudioPeerId]
    ) {
      // NOTE: Inactive peers can be removed in `pollAndUpdate`
      const peer = peers[activeAudioPeerId];
      await this.unsubscribeFromTrack(activeAudioPeerId, getPeerAudioMediaTag(peer));
      this.activeAudioPeerId = undefined;
    }
    if (!activeAudioPeerId) {
      const peer = peers[audioPeerId];
      await this.subscribeToTrack(audioPeerId, getPeerAudioMediaTag(peer));
      this.activeAudioPeerId = audioPeerId;
    }
    if (this.activeAudioPeerId) {
      this.audioStarted = true;
      // TODO: Send event (audio totally connected)?
      console.log('[MediaClient:subscribeToAudioTrack]: started');
    }
  }

  async updateActivePeers() {
    return Promise.all([this.subscribeToVideoTrack(), this.subscribeToAudioTrack()]);
    // TODO: consumers[id].media['screen-video', 'cam-video', 'cam-audio']
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

    this.lastPollSyncData = peers; // Used?

    this.updateActivePeers();

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
      const error = new Error('Consumer close failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:joinRoom]: error', error, { err });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      // throw error;
    }
  }

  socketRequest(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        const error = new Error('Socket interface has not initialized');
        // eslint-disable-next-line no-console
        console.error('[MediaClient:socketRequest]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        reject(error);
      }
      this.socket.emit(type, data, (result) => {
        const { error: err } = result;
        if (err) {
          const error = new Error('Socket request failed: ' + (err.message || err));
          // eslint-disable-next-line no-console
          console.error('[MediaClient:socketRequest]: error', error, {
            err,
            result,
            data,
            type,
          });
          debugger; // eslint-disable-line no-debugger
          showError(error);
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /* // UNUSED: Old sig method
   * async sigFetch(endpoint, data, beacon) {
   *   try {
   *     const headers = {
   *       'Content-Type': 'application/json',
   *       'Access-Control-Allow-Origin': '*',
   *     };
   *     const body = JSON.stringify({ ...data, peerId: this.myPeerId });
   *     const url = mediaClientUrl + mediaClientAppId + endpoint;
   *     const fetchParams = {
   *       method: 'POST',
   *       body,
   *       headers,
   *       mode: 'cors',
   *     };
   *     console.log('[MediaClient:sig] start', {
   *       url,
   *       headers,
   *       fetchParams,
   *       body,
   *       endpoint,
   *       data,
   *       beacon,
   *     });
   *     if (beacon) {
   *       navigator.sendBeacon(url, body);
   *       return null;
   *     }
   *     const response = await fetch(url, fetchParams);
   *     console.log('[MediaClient:sig] success', {
   *       response,
   *       url,
   *       headers,
   *       fetchParams,
   *       body,
   *       endpoint,
   *       data,
   *       beacon,
   *     });
   *     return await response.json();
   *   } catch (err) {
   *     const error = new Error('Remote request (sig) failed: ' + (err.message || err));
   *     // eslint-disable-next-line no-console
   *     console.error('[MediaClient:sig]: error', error, { err });
   *     debugger; // eslint-disable-line no-debugger
   *     showError(error);
   *     throw error;
   *     // return { error };
   *   }
   * }
   */

  // NOTE: Beacon is unused!
  async sig(message, params, beacon) {
    try {
      /* // UNUSED: Old method
       * const headers = {
       *   'Content-Type': 'application/json',
       *   'Access-Control-Allow-Origin': '*',
       * };
       * const body = JSON.stringify({ ...params, peerId: this.myPeerId });
       * const url = mediaClientUrl + mediaClientAppId + message;
       * const fetchParams = {
       *   method: 'POST',
       *   body,
       *   headers,
       *   mode: 'cors',
       * };
       * console.log('[MediaClient:sig] start', {
       *   url,
       *   headers,
       *   fetchParams,
       *   body,
       *   message,
       *   params,
       *   beacon,
       * });
       * if (beacon) {
       *   navigator.sendBeacon(url, body);
       *   return null;
       * }
       * const response = await fetch(url, fetchParams);
       * return await response.json();
       */
      const data = await this.socketRequest(message, { ...params, peerId: this.myPeerId });
      console.log('[MediaClient:sig] success', {
        params,
        message,
        data,
        beacon,
      });
      return data;
    } catch (err) {
      const error = new Error('Remote request (sig) failed: ' + (err.message || err));
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
        const error = new Error('Error connecting transport: ' + (err.message || err));
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
          const error = new Error('Error setting up server-side producer: ' + (err.message || err));
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
      const error = new Error('Start camera failed: ' + (err.message || err));
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
      appData: { mediaTag: 'cam-video' },
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

  async startVideo() {
    try {
      if (this.videoStarted) {
        return;
      }
      this.videoStarted = 'starting';
      if (isGuide) {
        if (shareScreen) {
          await this.startScreenshare();
        } else {
          await this.sendCameraStreams();
        }
      }
      // toggleClassName(this.videoNode, 'visible', true);
      this.events.emit('MediaClient:videoStarted'); // TODO: Send message only on start finished?
      // TODO: Try to start video now?
      return this.updateActivePeers();
    } catch (err) {
      const error = new Error('Video start failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:startVideo]: error', error, { err });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
  }

  async stopVideo() {
    if (!this.videoStarted) {
      return;
    }
    // TODO: Stop video (guide: camera or screenshare)
    // toggleClassName(this.videoNode, 'visible', false);
    await this.unsubscribeFromVideoTrack();
    this.videoStarted = false;
    this.events.emit('MediaClient:videoStopped');
  }

  async startAudio() {
    try {
      if (this.audioStarted) {
        return;
      }
      this.audioStarted = 'starting';
      if (isGuide) {
        if (shareScreen) {
          await this.startScreenshare();
        } else {
          await this.sendCameraStreams();
        }
      }
      // toggleClassName(this.audioNode, 'visible', true);
      this.events.emit('MediaClient:audioStarted'); // TODO: Send message only on start finished?
      // TODO: Try to start audio now?
      return this.updateActivePeers();
    } catch (err) {
      const error = new Error('Audio start failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:startAudio]: error', error, { err });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
  }

  async stopAudio() {
    if (!this.audioStarted) {
      return;
    }
    // TODO: Stop audio (guide: camera or screenshare)
    // toggleClassName(this.audioNode, 'visible', false);
    await this.unsubscribeFromAudioTrack();
    this.audioStarted = false;
    this.events.emit('MediaClient:audioStopped');
  }

  // TODO: startAudio, stopAudio
}
