import { isGuide, shareScreen } from '../config.js';

export function initHeader() {
  let infoStr = isGuide ? 'Guide' : 'Visitor';
  if (isGuide && shareScreen) {
    infoStr += ' (share screen)';
  }
  const nodeRef = document.querySelector('#header');
  nodeRef.innerHTML = infoStr;
}
