import { showNotify } from '../notify/notify.js';

// const mediasoup = require('mediasoup-client');
// const socketClient = require('socket.io-client');
// const socketPromise = require('./lib/socket.io-promise').promise;
// const config = require('./config');

import { socketPromise } from '../lib/socket.io-promise.js';

const isGuide = window.isGuide;

let remoteVideoRef; // Video window ref
let device;
let socket;
let videoProducer;
let audioProducer;

function connect() {
  return new Promise((resolve, reject) => {
    showNotify('info', 'Connecting...');

    const opts = {
      path: '/appId003',
      transports: ['websocket'],
    };

    const serverUrl = 'https://360caster.com';
    console.log('serverUrl: ', serverUrl);
    socket = window.io(serverUrl, opts);
    socket.request = socketPromise(socket);

    socket.on('connect', async () => {
        showNotify('success', 'Connected');
      const data = await socket.request('getRouterRtpCapabilities');
      await loadDevice(data);
      resolve();
      // subscribe();
    });

    socket.on('disconnect', () => {
      showNotify('success', 'Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('could not connect to %s%s (%s)', serverUrl, opts.path, error.message);
      debugger;
      showNotify('error', 'Connection failed');
      reject(error);
    });

    // socket.on('newProducer', () => {
    //   showNotify('info', 'newProducer');
    // });
  });
}

async function loadDevice(routerRtpCapabilities) {
  try {
    device = new window.mediasoup.Device();
  } catch (error) {
    if (error.name === 'UnsupportedError') {
      showNotify('error', 'Browser not supported');
    }
  }
  await device.load({ routerRtpCapabilities });
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
              showNotify('Subscribing...');
              break;
            case 'connected':
              remoteVideoRef.srcObject = await stream;
              showNotify('success', 'Subscribed');
              socket.request('resume').then(resolve).catch(reject);
              break;
            case 'failed':
              transport.close();
              showNotify('error', 'Subscribe failed');
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
      if (isGuide) {
        debugger;
      } else {
        return subscribe();
      }
    })
    .then(() => {
      showNotify('success', 'Visitor connected');
    });
}
