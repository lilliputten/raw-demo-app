/** @module config
 *  @since 2023.03.21, 12:00
 *  @changed 2023.03.23, 20:18
 */

// Generic parameters...

export const isDev = window.location.host.startsWith('localhost');
export const isGuide = window.location.search.includes('viewMode=guide');
export const shareScreen = window.location.search.includes('share=screen');

// Server addresses...

export const prodServerUrl = 'https://360caster.com';

export const useLocalDevServer = isDev;

// Panoramas...

export const panoSkinUrl = useLocalDevServer
  ? 'http://localhost:3001/kuskovo/002/' // Local dev server (eg: `http://localhost:3001/kuskovo/002/index.xml`)
  : '/kuskovo/002/'; // Test server (eg: `https://360caster.com/kuskovo/002/index.xml`)

// Unique panorama container id in the html dom tree
export const uniquePanoId = 'pano2vr-container'; // TODO: Generate unique id dynamicaly?

// Video (TODO: Replace with common socket parameters)...

export const videoAppId = '/appId003';
export const videoServerUrl = prodServerUrl;

// Common socket...

export const commonSocketUrl = useLocalDevServer
  ? 'http://localhost:8082/' // Local socket.io server
  : prodServerUrl; // Production sockets address (`https://360caster.com:8082/`)
export const commonSocketAppId = isDev ? '/appId002' : '/appId003';

// Media client socket...

export const mediaClientUrl = prodServerUrl;
export const mediaClientAppId = '/appId005/';
