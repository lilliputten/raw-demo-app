import { isGuide, panoSocketsPath, panoSocketsUrl, uniquePanoId, panoSkinUrl } from '../config.js';
import { removeAllChildren } from '../helpers/dom.js';
import { showError, showInfo, showSuccess } from '../notify/notify.js';
import { PanoPlayer } from './PanoPlayer.js';

let panoNode;
let panoPlayer;

export function startPanoView() {
  const viewMode = isGuide ? 'guide' : 'visitor';
  showInfo('Starting panorama in "' + viewMode + '" mode...');
  panoPlayer = new PanoPlayer({
    uniquePanoId,
    panoSkinUrl,
    viewMode,
    socketsUrl: panoSocketsUrl,
    socketsPath: panoSocketsPath,
  });
  panoPlayer
    .start()
    .then(() => {
      showSuccess('Started panorama in "' + viewMode + '" mode');
    })
    .catch((error) => {
      showError('Panorama start error: ' + String(error));
    });
}

export function stopPanoView() {
  panoPlayer.stop();
  panoPlayer = undefined;
  // TODO: Find and remove all created dom nodes, etc?
  removeAllChildren(panoNode);
}

export function togglePanoView(isActive) {
  if (isActive) {
    startPanoView();
  } else {
    stopPanoView();
  }
}

export function initPanoView() {
  panoNode = document.querySelector('#' + uniquePanoId);
}
