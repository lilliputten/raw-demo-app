import { PanoPlayer } from './PanoPlayer.js';

// TODO: Move parameters to config/store?
const panoSkinUrl = window.isDev
  ? 'http://localhost:3001/kuskovo/002/' // Local dev server (eg: `http://localhost:3001/kuskovo/002/index.xml`)
  : '/kuskovo/002/'; // Test server (eg: `https://360caster.com/kuskovo/002/index.xml`)
const socketsUrl = window.isDev
  ? 'http://localhost:8082/' // Local socket.io server
  : '/'; // Production sockets address (`https://360caster.com:8082/`)
const socketsPath = '/appId002/';

const uniquePanoId = 'pano2vr-container'; // TODO: Generate unique id dynamicaly?

export function startPanoView() {
  const viewMode = window.isGuide ? 'guide' : 'visitor';
  const panoPlayer = new PanoPlayer({
    uniquePanoId,
    panoSkinUrl,
    viewMode,
    socketsUrl,
    socketsPath,
  });
  panoPlayer.start();
}
