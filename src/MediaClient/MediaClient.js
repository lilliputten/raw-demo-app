import {
  // isDev,
  mediaClientUrl,
  mediaClientAppId,
  shareScreen,
  isGuide,
  mediaClientPollDelay,
  mediaSoupDebugLevel,
  enableMediaClientPolls,
} from '../config.js';
import { sleep } from '../helpers/async.js';
import { toggleClassName } from '../helpers/dom.js';
import { uuidv4 } from '../helpers/strings.js';
import { showError, showInfo, showSuccess } from '../notify/notify.js';
import {
  camEncodings,
  findAudioPeerId,
  findVideoPeerId,
  getPeerAudioMediaTag,
  getPeerVideoMediaTag,
  hasAudioPeer,
  hasVideoPeer,
  screenshareEncodings,
  setMediaSoupDebugLevel,
} from './mediaHelpers.js';

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
  consumers = []; // Active peers list
  currentActiveSpeaker = {}; // ???
  lastPollSyncData = {}; // All peers (hash by id)
  localCam = undefined;
  localScreen = undefined;
  pollingInterval = undefined; // setInterval handler
  recvTransport = undefined;
  screenAudioProducer = undefined;
  screenVideoProducer = undefined;
  sendTransport = undefined;

  // Session-time parameters...
  inited = false;
  joined = false;

  constructor({ events, mainNode, socket }) {
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
    if (socket && useExternalSocket) {
      this.socket = socket;
    }
    // this.videoNode = querySelector('#videoView');
    setMediaSoupDebugLevel(mediaSoupDebugLevel);
    if (useExternalSocket) {
      this.events.on('tourSessionStarted', ({ socket }) => {
        this.setExternalSocket(socket);
      });
    }
  }

  onUnload() {
    this.sig('leave', {});
  }

  setExternalSocket(socket) {
    if (useExternalSocket) {
      this.socket = socket;
    }
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

  async stopSession() {
    await this.leaveRoom();
    // NOTE: Stop socket only after room had leaved.
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
        window.removeEventListener('unload', this._bound_onUnload);
      }
      this.device = undefined;
      this.inited = false;
    }
  }

  async joinRoom() {
    if (!this.inited || this.joined) {
      return;
    }
    // log('join room');
    // $('#join-control').style.display = 'none';

    this.joined = 'joining';

    try {
      // Signal that we're a new peer and initialize our
      // mediasoup-client device, if this is our first time connecting
      const { routerRtpCapabilities } = await this.sig('join-as-new-peer');
      if (!this.device.loaded) {
        // if (!routerRtpCapabilities) { // TODO: Throw an error?
        await this.device.load({ routerRtpCapabilities });
        /* console.log('[MediaClient:joinRoom]: device loaded', {
         *   routerRtpCapabilities,
         * });
         */
      }
      // console.log('[MediaClient:joinRoom]: success');
      this.joined = true;
      // $('#leave-room').style.display = 'initial';
      this.events.emit('MediaClient:roomJoined');
      // Super-simple signaling: let's poll at intervals
      this.pollAndUpdate();
      if (enableMediaClientPolls) {
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
        }, mediaClientPollDelay);
      }
    } catch (err) {
      this.joined = false;
      const error = new Error('Media client start failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:joinRoom]: error', error, { err });
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
  }

  async leaveRoom() {
    if (!this.joined || this.joined === 'leaving') {
      return;
    }

    this.joined = 'leaving';

    showInfo('Leaving room...');
    // console.log('[MediaClient:leaveRoom]: start');
    // TODO: Unload this.device?

    // stop polling
    clearInterval(this.pollingInterval);

    await Promise.all([this.stopVideo(), this.stopAudio()]);
    await this.stopTransports();

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
      // TODO: To use concurrent executing like (Promise.all or race).
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
      /* const { peerId, mediaTag } = consumer.appData;
       * console.log('[MediaClient:pauseConsumer]', {
       *   peerId,
       *   mediaTag,
       * });
       */
      try {
        await this.sig('pause-consumer', { consumerId: consumer.id });
        await consumer.pause();
      } catch (err) {
        const error = new Error('Consumer pause failed: ' + (err.message || err));
        // eslint-disable-next-line no-console
        console.error('[MediaClient:pauseConsumer]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      }
    }
  }

  async resumeConsumer(consumer) {
    if (consumer) {
      /* const { peerId, mediaTag } = consumer.appData;
       * console.log('[MediaClient:resumeConsumer]', {
       *   peerId,
       *   mediaTag,
       * });
       */
      try {
        await this.sig('resume-consumer', { consumerId: consumer.id });
        await consumer.resume();
      } catch (err) {
        const error = new Error('Consumer resume failed: ' + (err.message || err));
        // eslint-disable-next-line no-console
        console.error('[MediaClient:resumeConsumer]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
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
    this.mainNode.querySelectorAll(consumer.kind).forEach((v) => {
      if (v.consumer === consumer) {
        v.parentNode.removeChild(v);
      }
    });
  }

  async subscribeToTrack(peerId, mediaTag) {
    /* console.log('[MediaClient:subscribeToTrack] start', {
     *   peerId,
     *   mediaTag,
     * });
     */

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
    /* console.log('[MediaClient:subscribeToTrack] consumer parameters', {
     *   consumerParameters,
     * });
     */
    consumer = await this.recvTransport.consume({
      ...consumerParameters,
      appData: { peerId, mediaTag },
    });
    /* console.log('[MediaClient:subscribeToTrack] created new consumer', {
     *   id: consumer.id,
     * });
     */

    // the server-side consumer will be started in paused state. wait
    // until we're connected, then send a resume request to the server
    // to get our first keyframe and start displaying video
    while (this.recvTransport.connectionState !== 'connected') {
      /* console.log('[MediaClient:subscribeToTrack] transport connstate', {
       *   connectionState: this.recvTransport.connectionState,
       * });
       */
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
    /* console.log('[MediaClient:unsubscribeFromTrack] start', {
     *   consumer,
     *   peerId,
     *   mediaTag,
     * });
     */
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
    const mediaTag = getPeerVideoMediaTag(peer);
    /* console.log('[MediaClient:unsubscribeFromVideoTrack]', {
     *   peer,
     *   mediaTag,
     *   activeVideoPeerId,
     *   peers,
     * });
     */
    await this.unsubscribeFromTrack(activeVideoPeerId, mediaTag);
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
    const videoPeerId = isGuide ? this.myPeerId : findVideoPeerId(peers);
    if (!videoStarted || !videoPeerId) {
      if (activeVideoPeerId) {
        return this.unsubscribeFromVideoTrack();
      }
      return;
    }
    /* console.log('[MediaClient:subscribeToVideoTrack]: done', {
     *   videoPeerId,
     *   peers,
     * });
     */
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
      const mediaTag = getPeerVideoMediaTag(peer);
      /* console.log('[MediaClient:subscribeToVideoTrack]', {
       *   peer,
       *   mediaTag,
       * });
       */
      // TODO: Show error if media tag not found?
      // NOTE: For self-produced video media tag can be available with delay (on the next iteration)
      if (mediaTag) {
        await this.subscribeToTrack(videoPeerId, mediaTag);
        this.activeVideoPeerId = videoPeerId;
      }
    }
    if (this.activeVideoPeerId) {
      this.videoStarted = true;
      // TODO: Send event (video totally connected)?
      /* console.log('[MediaClient:subscribeToVideoTrack]: started', {
       *   videoPeerId,
       * });
       */
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
    const audioPeerId = isGuide
      ? this.myPeerId
      : currentActiveSpeaker?.peerId || findAudioPeerId(peers);
    if (!audioStarted || !audioPeerId) {
      if (activeAudioPeerId) {
        return this.unsubscribeFromAudioTrack();
      }
      return;
    }
    /* console.log('[MediaClient:subscribeToAudioTrack]: done', {
     *   audioPeerId,
     *   peers,
     * });
     */
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
      const mediaTag = getPeerAudioMediaTag(peer);
      /* console.log('[MediaClient:subscribeToAudioTrack]', {
       *   peer,
       *   mediaTag,
       * });
       */
      // TODO: Show error if media tag not found?
      // NOTE: For self-produced video media tag can be available with delay (on the next iteration)
      if (mediaTag) {
        await this.subscribeToTrack(audioPeerId, mediaTag);
        this.activeAudioPeerId = audioPeerId;
      }
    }
    if (this.activeAudioPeerId) {
      this.audioStarted = true;
      // TODO: Send event (audio totally connected)?
      /* console.log('[MediaClient:subscribeToAudioTrack]: started', {
       *   audioPeerId,
       * });
       */
    }
  }

  async updateActivePeers() {
    return Promise.all([this.subscribeToVideoTrack(), this.subscribeToAudioTrack()]);
    // TODO: consumers[id].media['screen-video', 'cam-video', 'cam-audio']
  }

  async pollAndUpdate() {
    const { peers, activeSpeaker, error } = await this.sig('sync');
    /* console.log('[MediaClient:pollAndUpdate]', {
     *   peers,
     *   activeSpeaker,
     *   error,
     * });
     */
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

    const hasVideo = hasVideoPeer(peers);
    const hasAudio = hasAudioPeer(peers);
    this.events.emit('MediaClient:updatePeers', {
      hasVideo,
      hasAudio,
      peers,
    });

    this.updateActivePeers();

    return {}; // return an empty object if there isn't an error
  }

  async closeConsumer(consumer) {
    if (!consumer) {
      return;
    }
    const { appData, id: consumerId } = consumer;
    const { peerId, mediaTag } = appData;
    showInfo('Closing consumer ' + peerId + ' ' + mediaTag);
    /* console.log('[MediaClient:closeConsumer]', {
     *   consumerId,
     *   peerId,
     *   mediaTag,
     *   appData,
     *   consumer,
     * });
     */
    try {
      // tell the server we're closing this consumer. (the server-side
      // consumer may have been closed already, but that's okay.)
      await this.sig('close-consumer', { consumerId });
      await consumer.close();
      this.consumers = this.consumers.filter((c) => c !== consumer);
      this.removeVideoAudio(consumer);
    } catch (err) {
      const error = new Error('Consumer close failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:closeConsumer]: error', error, { err });
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
      /* console.log('[MediaClient:socketRequest]: start', type, {
       *   data,
       *   type,
       * });
       */
      this.socket.emit(type, data, (result) => {
        const { error: err } = result;
        if (err && (typeof err !== 'object' || Object.keys(err).length)) {
          const error = new Error('Socket request failed: ' + (err.message || err));
          // eslint-disable-next-line no-console
          console.error('[MediaClient:socketRequest]: error', type, error, {
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

  async sig(message, params) {
    const requestData = { ...params, peerId: this.myPeerId };
    /* console.log('[MediaClient:sig] start', message, {
     *   requestData,
     *   params,
     *   message,
     * });
     */
    try {
      const result = await this.socketRequest(message, requestData);
      /* console.log('[MediaClient:sig] success', message, {
       *   params,
       *   message,
       *   result,
       * });
       */
      return result;
    } catch (err) {
      const error = new Error('Remote request (sig) failed: ' + (err.message || err));
      // eslint-disable-next-line no-console
      console.error('[MediaClient:sig]: error', error, {
        err,
        message,
        params,
        requestData,
      });
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
    /* console.log('[MediaClient:createTransport]: Transport options', {
     *   transportOptions,
     * });
     */

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
      /* console.log('[MediaClient:createTransport:connect] transport connect event', {
       *   direction,
       * });
       */
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
        /* console.log('[MediaClient:createTransport:produce] transport produce event', {
         *   mediaTag,
         * });
         */
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
      /* console.log('[MediaClient:createTransport:connectionstatechange]', state, {
       *   id: transport.id,
       *   state,
       * });
       */
      // for this simple sample code, assume that transports being
      // closed is an error (we never close these transports except when
      // we leave the room)
      if (state === 'closed' || state === 'failed' || state === 'disconnected') {
        /* console.log('[MediaClient:createTransport:connectionstatechange] transport closed', {
         *   id: transport.id,
         *   state,
         * });
         */
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

    showInfo('Starting screen share...');
    // console.log('[MediaClient:startScreenshare] start');
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
      // console.log('[MediaClient:startScreenshare] screen share stopped');
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
          throw error;
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
            throw error;
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

    /* console.log('[MediaClient:startScreenshare] done', {
     *   localScreen: this.localScreen,
     *   screenVideoProducer: this.screenVideoProducer,
     *   screenAudioProducer: this.screenAudioProducer,
     *   sendTransport: this.sendTransport,
     * });
     */

    // $('#local-screen-pause-ctrl').style.display = 'block';
    // if (screenAudioProducer) {
    //   $('#local-screen-audio-pause-ctrl').style.display = 'block';
    // }

    showSuccess('Screen share started');
  }

  async startCamera() {
    if (this.localCam) {
      return;
    }
    // console.log('[MediaClient:startCamera]: start camera');
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

    showInfo('Camera audiio & video starting...');
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
      } catch (err) {
        const error = new Error('Cam video producer creation failed: ' + (err.message || err));
        // eslint-disable-next-line no-console
        console.error('[MediaClient:sendCameraStreams]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
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
      } catch (err) {
        const error = new Error('Cam audio producer creation failed: ' + (err.message || err));
        // eslint-disable-next-line no-console
        console.error('[MediaClient:sendCameraStreams]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      }
    }

    // $('#stop-streams').style.display = 'initial';
    // showCameraInfo();

    showSuccess('Camera video & audio started');
  }

  async startVideo() {
    try {
      if (this.videoStarted) {
        return;
      }
      showInfo('Video starting...');
      const { lastPollSyncData: peers } = this;
      const hasVideo = hasVideoPeer(peers);
      /* console.log('[MediaClient:startVideo]', {
       *   hasVideo,
       *   peers,
       * });
       */
      if (!isGuide && !hasVideo) {
        const error = new Error('No video peers found');
        // eslint-disable-next-line no-console
        console.error('[MediaClient:startVideo]: error', error, {
          peers,
          hasVideo,
          isGuide,
        });
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      }
      this.videoStarted = 'starting';
      if (isGuide) {
        if (shareScreen) {
          await this.startScreenshare();
        } else {
          await this.sendCameraStreams();
        }
      }
      this.events.emit('MediaClient:videoStarted'); // TODO: Send message only on start finished?
      showSuccess('Video started');
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
    await this.unsubscribeFromVideoTrack();
    this.videoStarted = false;
    this.events.emit('MediaClient:videoStopped');
    showInfo('Video stopped');
  }

  async startAudio() {
    try {
      if (this.audioStarted) {
        return;
      }
      showInfo('Audio starting...');
      const { lastPollSyncData: peers } = this;
      const hasAudio = hasAudioPeer(peers);
      /* console.log('[MediaClient:startAudio]', {
       *   hasAudio,
       *   peers,
       * });
       */
      if (!isGuide && !hasAudio) {
        const error = new Error('No audio peers found');
        // eslint-disable-next-line no-console
        console.error('[MediaClient:startAudio]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        throw error;
      }
      // TODO: Check if audio peer is exists for visitor.
      this.audioStarted = 'starting';
      if (isGuide) {
        if (shareScreen) {
          await this.startScreenshare();
        } else {
          await this.sendCameraStreams();
        }
      }
      this.events.emit('MediaClient:audioStarted'); // TODO: Send message only on start finished?
      showSuccess('Audio started');
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
    await this.unsubscribeFromAudioTrack();
    this.audioStarted = false;
    this.events.emit('MediaClient:audioStopped');
    showInfo('Audio stopped');
  }
}
