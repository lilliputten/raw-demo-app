import { commonAppId, commonSocketsUrl } from '../config.js';
import { showError, showInfo, showSuccess } from '../notify/notify.js';

export class TourSession {
  // Permanent parameters...
  events = undefined;
  // Session-time parameters...
  started = false;
  socket = undefined;

  constructor({ events }) {
    this.events = events;
  }

  isStarted() {
    return this.started;
  }

  startSocket() {
    return new Promise((resolve, reject) => {
      console.log('[TourSession:start]: Starting socket', {
        commonSocketsUrl,
        commonAppId,
      });
      const opts = {
        path: commonAppId,
        transports: ['websocket'],
      };
      this.socket = window.io(commonSocketsUrl, opts);
      this.socket.on('connect', resolve);
      this.socket.on('connect_error', reject);
      this.socket.on('connect_failed', reject);
    });
  }

  stopSocket() {
    this.socket.disconnect();
    this.socket.destroy();
    this.socket = undefined;
  }

  /** @return promise */
  start() {
    if (this.started) {
      const error = new Error('Trying to start already started instance');
      // eslint-disable-next-line no-console
      console.error('[TourSession:start]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    showInfo('Starting session...');
    return this.startSocket()
      .then(() => {
        this.started = true;
        this.events.emit('tourSessionStarted', { socket: this.socket });
        showSuccess('Session started');
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[TourSession:start]: error', error, {
          commonSocketsUrl,
          commonAppId,
        });
        debugger; // eslint-disable-line no-debugger
        error = new Error('Tour session start failed: ' + error.message);
        showError(error);
        throw error;
      });
  }

  stop() {
    if (!this.started) {
      const error = new Error('Trying to stop unstarted instance');
      // eslint-disable-next-line no-console
      console.error('[TourSession:stop]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    showInfo('Stopping session...');
    this.stopSocket();
    this.started = false;
    this.events.emit('tourSessionStopped');
    showSuccess('Session stopped');
  }
}
