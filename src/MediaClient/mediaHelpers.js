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

const videoMediaTags = ['cam-video', 'screen-video'];
const audioMediaTags = ['cam-audio'];

export function getPeerVideoMediaTag(peer) {
  for (const tag in peer.media) {
    if (videoMediaTags.includes(tag)) {
      return tag;
    }
  }
}
export function getPeerAudioMediaTag(peer) {
  for (const tag in peer.media) {
    if (audioMediaTags.includes(tag)) {
      return tag;
    }
  }
}

/** @return string | undefined */
export function findPeerIdForMediaTags(peers, mediaTags) {
  for (const id in peers) {
    const peer = peers[id];
    for (const tag in peer.media) {
      if (mediaTags.includes(tag)) {
        return id;
      }
    }
  }
}
export function findVideoPeerId(peers) {
  return findPeerIdForMediaTags(peers, videoMediaTags);
}
export function findAudioPeerId(peers) {
  return findPeerIdForMediaTags(peers, audioMediaTags);
}

export function findPeerForMediaTags(peers, mediaTags) {
  const id = findPeerIdForMediaTags(peers, mediaTags);
  return id && peers[id];
}
export function findVideoPeer(peers) {
  return findPeerForMediaTags(peers, videoMediaTags);
}
export function findAudioPeer(peers) {
  return findPeerForMediaTags(peers, audioMediaTags);
}
