// Generic parameters...

export const isDev = window.isDev;
export const isGuide = window.isGuide;
export const shareScreen = window.isGuide; // Use 'share screen' instead 'webcam' video casting mode (DEBUG?)

// Panorams...

// TODO: Move parameters to config/store?
export const panoSkinUrl = isDev
  ? 'http://localhost:3001/kuskovo/002/' // Local dev server (eg: `http://localhost:3001/kuskovo/002/index.xml`)
  : '/kuskovo/002/'; // Test server (eg: `https://360caster.com/kuskovo/002/index.xml`)
export const panoSocketsUrl = isDev
  ? 'http://localhost:8082/' // Local socket.io server
  : '/'; // Production sockets address (`https://360caster.com:8082/`)
export const panoSocketsPath = '/appId002/';

// Unique panorama container in the html dom tree
export const uniquePanoId = 'pano2vr-container'; // TODO: Generate unique id dynamicaly?

// Video...

export const videoAppId = '/appId003';
export const videoServerUrl = 'https://360caster.com';
