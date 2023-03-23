// Generic parameters...

export const isDev = window.location.host.startsWith('localhost');
export const isGuide = window.location.search.includes('viewMode=guide');
export const shareScreen = window.location.search.includes('share=screen');

// Panorams...

export const prodServerUrl = 'https://360caster.com';

export const useLocalDevServer = isDev;

// TODO: Move parameters to config/store?
export const panoSkinUrl = useLocalDevServer
  ? 'http://localhost:3001/kuskovo/002/' // Local dev server (eg: `http://localhost:3001/kuskovo/002/index.xml`)
  : '/kuskovo/002/'; // Test server (eg: `https://360caster.com/kuskovo/002/index.xml`)
export const panoSocketsUrl = isDev
  ? 'http://localhost:8082/' // Local socket.io server
  : '/'; // Production sockets address (`https://360caster.com:8082/`)
export const panoSocketsPath = '/appId002/';

// Unique panorama container id in the html dom tree
export const uniquePanoId = 'pano2vr-container'; // TODO: Generate unique id dynamicaly?

// Video...

export const videoAppId = '/appId003';
export const videoServerUrl = prodServerUrl;

// Video...

export const commonSocketsUrl = useLocalDevServer
  ? 'http://localhost:8082/' // Local socket.io server
  : prodServerUrl; // Production sockets address (`https://360caster.com:8082/`)
export const commonAppId = isDev ? '/appId002' : '/appId003';
