import { initPanoView, startPanoView, stopPanoView } from './panoView/panoView.js';
import { initVideoView, startVideo, stopVideo } from './videoView/videoView.js';
import { initHeader } from './header/header.js';
import { initFooter, startFooter } from './footer/footer.js';
import { showSuccess } from './notify/notify.js';

export function main() {
  initPanoView();
  initVideoView();
  initHeader();
  initFooter();
  startFooter({
    onVideoStart: startVideo,
    onVideoStop: stopVideo,
    onVrStart: startPanoView,
    onVrStop: stopPanoView,
  });
  showSuccess('Application started');
}
