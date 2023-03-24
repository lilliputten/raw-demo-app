// just two resolutions, for now, as chrome 75 seems to ignore more
// than two encodings
const CAM_VIDEO_SIMULCAST_ENCODINGS = [
  // { maxBitrate:  96000, scaleResolutionDownBy: 4 },
  // { maxBitrate: 680000, scaleResolutionDownBy: 1 },
  { maxBitrate: 100000 },
  { maxBitrate: 300000 },
  { maxBitrate: 900000 },
];

export function camEncodings() {
  return CAM_VIDEO_SIMULCAST_ENCODINGS;
}

export function screenshareEncodings() {
  return undefined;
}

export function setMediaSoupDebugLevel(mediaSoupDebugLevel) {
  if (mediaSoupDebugLevel) {
    window.localStorage.setItem('debug', mediaSoupDebugLevel);
  } else {
    window.localStorage.removeItem('debug');
  }
}

export function removeVideoAudio(consumer) {
  document.querySelectorAll(consumer.kind).forEach((v) => {
    if (v.consumer === consumer) {
      v.parentNode.removeChild(v);
    }
  });
}

export function sortPeers(peers) {
  return Object.entries(peers)
    .map(([id, info]) => ({ id, joinTs: info.joinTs, media: { ...info.media } }))
    .sort((a, b) => (a.joinTs > b.joinTs ? 1 : b.joinTs > a.joinTs ? -1 : 0));
}
