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
