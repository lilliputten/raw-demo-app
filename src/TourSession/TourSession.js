import { commonSocketAppId, commonSocketUrl } from '../config.js';
import { showError, showInfo, showSuccess } from '../notify/notify.js';

export class TourSession {
  // Permanent parameters...
  events = undefined;
  // Session-time parameters...
  inited = false;
  started = false;
  socket = undefined;

  constructor({ events }) {
    this.events = events;
  }

  init() {
    this.inited = true;
    return true;
  }

  isStarted() {
    return this.started;
  }

  isInited() {
    return this.inited;
  }

  startSocket() {
    return new Promise((resolve, reject) => {
      /* console.log('[TourSession:start]: Starting socket', {
       *   commonSocketUrl,
       *   commonSocketAppId,
       * });
       */
      const opts = {
        path: commonSocketAppId,
        transports: ['websocket'],
      };
      this.socket = window.io(commonSocketUrl, opts);
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
  async start() {
    if (this.started) {
      const error = new Error('Trying to start already started instance');
      // eslint-disable-next-line no-console
      console.error('[TourSession:start]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    showInfo('Starting session...');
    try {
      await this.startSocket();
      this.started = true;
      this.events.emit('tourSessionStarted', { socket: this.socket });
      showSuccess('Session started');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[TourSession:start]: error', err, {
        commonSocketUrl,
        commonSocketAppId,
      });
      debugger; // eslint-disable-line no-debugger
      const error = new Error('Tour session start failed: ' + err.message);
      showError(error);
      throw error;
    }
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
