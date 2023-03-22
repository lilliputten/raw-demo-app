import { initPanoView, startPanoView } from './panoView/panoView.js';
import { initVideoView, startVideo } from './videoView/videoView.js';
import { initHeader } from './header/header.js';
import { initFooter, startFooter } from './footer/footer.js';
import { showSuccess } from './notify/notify.js';

export function main() {
  initPanoView();
  initVideoView();
  initHeader();
  initFooter();
  startFooter({
    onVideoClick: startVideo,
    onVrClick: startPanoView,
  });
  showSuccess('Application started');
}
