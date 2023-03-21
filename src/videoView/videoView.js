import { showInfo, showSuccess, showError } from '../notify/notify.js';

// const mediasoup = require('mediasoup-client');
// const socketClient = require('socket.io-client');
// const socketPromise = require('./lib/socket.io-promise').promise;
// const config = require('./config');

import { socketPromise } from '../lib/socket.io-promise.js';

let remoteVideoRef; // Video window ref
let device;
let socket;
let videoProducer;
let audioProducer;

function connect() {
  return new Promise((resolve, reject) => {
    showInfo('Connecting...');

    const opts = {
      path: '/appId003',
      transports: ['websocket'],
    };

    const serverUrl = 'https://360caster.com';
    console.log('serverUrl: ', serverUrl);
    socket = window.io(serverUrl, opts);
    socket.request = socketPromise(socket);

    socket.on('connect', async () => {
      showSuccess('Connected');
      const data = await socket.request('getRouterRtpCapabilities');
      await loadDevice(data);
      resolve();
      // subscribe();
    });

    socket.on('disconnect', () => {
      showSuccess('Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('could not connect to %s%s (%s)', serverUrl, opts.path, error.message);
      debugger;
      showError('Connection failed');
      reject(error);
    });

    // socket.on('newProducer', () => {
    //   showInfo('newProducer');
    // });
  });
}

async function loadDevice(routerRtpCapabilities) {
  try {
    device = new window.mediasoup.Device();
  } catch (error) {
    if (error.name === 'UnsupportedError') {
      showError('Browser not supported');
    }
  }
  await device.load({ routerRtpCapabilities });
}

async function publish(isWebcam) {
  const showText = isWebcam ? 'webcam' : 'screen';
  showInfo('Start publish ' + showText);

  const data = await socket.request('createProducerTransport', {
    forceTcp: false,
    rtpCapabilities: device.rtpCapabilities,
  });

  if (data.error) {
    console.error(data.error);
    return;
  }

  const transport = device.createSendTransport(data);
  transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    socket.request('connectProducerTransport', { dtlsParameters }).then(callback).catch(errback);
  });

  transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
    try {
      const { id } = await socket.request('produce', {
        transportId: transport.id,
        kind,
        rtpParameters,
      });

      console.log('producer id :', id);
      console.log('producer kind :', kind);

      callback({ id });
    } catch (err) {
      errback(err);
    }
  });

  transport.on('connectionstatechange', (state) => {
    switch (state) {
      case 'connecting':
        showInfo('Publishing...');
        break;
      case 'connected':
        // document.querySelector('#local_video').srcObject = videoStream;
        remoteVideoRef.srcObject = videoStream;
        showSuccess('Published');
        break;
      case 'failed':
        transport.close();
        showError('Publish failed');
        break;
    }
  });

  let videoStream;
  let audioStream;
  try {
    videoStream = await getUserMedia(transport, isWebcam);
    audioStream = await getUserAudioMedia(transport);
    const videoTrack = videoStream.getVideoTracks()[0];
    const audioTrack = audioStream.getAudioTracks()[0];
    const videoParams = { track: videoTrack };
    const audioParams = { track: audioTrack };

    /* // UNUSED? Simulcast?
     * if ($chkSimulcast.checked) {
     *   params.encodings = [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }];
     *   params.codecOptions = {
     *     videoGoogleStartBitrate: 1000,
     *   };
     * }
     */

    videoProducer = await transport.produce(videoParams);
    audioProducer = await transport.produce(audioParams);
  } catch (err) {
    showError('Publish failed');
  }
}

async function getUserMedia(transport, isWebcam) {
  if (!device.canProduce('video')) {
    showError('Cannot produce video');
    return;
  }

  let stream;
  try {
    stream = isWebcam
      ? //await navigator.mediaDevices.getUserMedia({ video: true }) :
        await navigator.mediaDevices.getUserMedia({ video: true })
      : await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (err) {
    console.error('getUserMedia() failed:', err.message);
    throw err;
  }
  return stream;
}

async function getUserAudioMedia(transport) {
  if (!device.canProduce('audio')) {
    console.error('cannot produce audio');
    return;
  }

  let audioStream;

  try {
    //await navigator.mediaDevices.getUserMedia({ video: true }) :
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error('getUserMedia() failed:', err.message);
    throw err;
  }
  return audioStream;
}

async function consume(transport) {
  const { rtpCapabilities } = device;

  const data = await socket.request('consume_video', { rtpCapabilities });

  const { producerId, id, kind, rtpParameters } = data;

  const codecOptions = {};

  const consumer = await transport.consume({
    id,
    producerId,
    kind,
    rtpParameters,
    codecOptions,
  });

  //audio
  const audioData = await socket.request('consume_audio', { rtpCapabilities });

  /* let {
    producerId,
    id,
    kind,
    rtpParameters,
  } = audioData; */

  const audioCodecOptions = {};

  const audioConsumer = await transport.consume({
    id: audioData.id,
    producerId: audioData.producerId,
    kind: audioData.kind,
    rtpParameters: audioData.rtpParameters,
    codecOptions: audioCodecOptions,
  });

  const stream = new MediaStream();

  stream.addTrack(consumer.track);
  stream.addTrack(audioConsumer.track);

  return stream;
}

function subscribe() {
  return new Promise((resolve, reject) => {
    socket
      .request('createConsumerTransport', {
        forceTcp: false,
      })
      .then((data) => {
        const { error } = data;
        if (error) {
          console.error(data.error);
          debugger;
          reject(error);
        }

        const transport = device.createRecvTransport(data);
        const stream = consume(transport);

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket
            .request('connectConsumerTransport', {
              transportId: transport.id,
              dtlsParameters,
            })
            .then(callback)
            .catch(errback);
        });

        transport.on('connectionstatechange', async (state) => {
          switch (state) {
            case 'connecting':
              showInfo('Subscribing...');
              break;
            case 'connected':
              remoteVideoRef.srcObject = await stream;
              showSuccess('Subscribed');
              socket.request('resume').then(resolve).catch(reject);
              break;
            case 'failed':
              transport.close();
              showError('Subscribe failed');
              break;
          }
        });
      })
      .catch(reject);
  });
}

export function startVideoView() {
  remoteVideoRef = document.querySelector('#videoViewMedia');
  connect()
    .then(() => {
      if (window.isGuide) {
        const isWebcam = !window.shareScreen;
        return publish(isWebcam);
      } else {
        return subscribe();
      }
    })
    .then(() => {
      showSuccess('Connected');
    });
}
