import { PanoView } from './PanoView/PanoView.js';
import { initVideoView, startVideo, stopVideo } from './videoView/videoView.js';
import { initHeader } from './header/header.js';
import { initFooter, startFooter } from './footer/footer.js';
import { showError, showSuccess } from './notify/notify.js';
import { MicroEvents } from './helpers/MicroEvents.js';
import { TourSession } from './TourSession/TourSession.js';
import { MediaClient } from './MediaClient/MediaClient.js';

export function main() {
  try {
    const events = new MicroEvents();
    const panoView = new PanoView({ events });
    // Init components...
    initVideoView({ events });
    initHeader();
    initFooter();
    // Start...
    const tourSession = new TourSession({ events });
    const mediaClient = new MediaClient({ events });
    Promise.all([panoView.init(), tourSession.init(), mediaClient.init()])
      .then(() => {
        startFooter({
          onVideoStart: startVideo,
          onVideoStop: stopVideo,
          onVrStart: panoView.start.bind(panoView),
          onVrStop: panoView.stop.bind(panoView),
          onStart: tourSession.start.bind(tourSession),
          onStop: tourSession.stop.bind(tourSession),
          events,
        });
        showSuccess('Application started');
      })
      .catch((err) => {
        const error = new Error('Application start failed: ' + err.message);
        // eslint-disable-next-line no-console
        console.error('[TourSession:start]: error', error, { err });
        debugger; // eslint-disable-line no-debugger
        showError(error);
        // throw error; // ???
      });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[main:main]: error', error);
    debugger; // eslint-disable-line no-debugger
    showError(error);
  }
}
