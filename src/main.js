import { initPanoView, togglePanoView } from './panoView/panoView.js';
import { initVideoView, toggleVideo } from './videoView/videoView.js';
import { initHeader } from './header/header.js';
import { initFooter } from './footer/footer.js';
import { showSuccess } from './notify/notify.js';

export function main() {
  initPanoView();
  initVideoView();
  initHeader();
  initFooter({
    onVideoToggle: toggleVideo,
    onVrToggle: togglePanoView,
  });
  showSuccess('Application started');
}
