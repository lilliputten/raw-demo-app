import { isGuide, uniquePanoId, panoSkinUrl } from '../config.js';
import { addScript, querySelector, removeAllChildren } from '../helpers/dom.js';
import { showError, showInfo, showSuccess } from '../notify/notify.js';
import { PanoPlayer } from './PanoPlayer.js';

export class PanoView {
  // Permanent parameters...
  events = undefined;
  panoNode = undefined;
  socket = undefined;
  // Session-time parameters...
  started = false;
  panoPlayer = undefined;

  constructor({ events }) {
    this.events = events;
    this.panoNode = querySelector('#' + uniquePanoId);
    this.events.on('tourSessionStarted', ({ socket }) => {
      this.socket = socket;
    });
    this.events.on('tourSessionStopped', () => {
      // Close connection...
      this.stop();
      this.socket = undefined;
    });
    // Load panorama skin...
    addScript(panoSkinUrl + 'skin.js');
    // TODO: Check skin loading result?
  }

  isStarted() {
    return this.started;
  }

  /** @return promise */
  start() {
    if (this.started) {
      const error = new Error('Calling start for already started instance');
      // eslint-disable-next-line no-console
      console.error('[PanoView:start]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    const viewMode = isGuide ? 'guide' : 'visitor';
    showInfo('Starting panorama in "' + viewMode + '" mode...');
    if (!this.socket) {
      const error = new Error('Socket has not initialized');
      showError(error);
      // eslint-disable-next-line no-console
      console.error('[PanoView:start]: error', error);
      debugger; // eslint-disable-line no-debugger
      throw error;
    }
    this.panoPlayer = new PanoPlayer({
      socket: this.socket,
      uniquePanoId,
      panoSkinUrl,
      isGuide,
    });
    return this.panoPlayer
      .start()
      .then(() => {
        this.events.emit('panoStarted');
        this.started = true;
        showSuccess('Panorama started');
        showSuccess('Started panorama in "' + viewMode + '" mode');
      })
      .catch((error) => {
        showError('Panorama start error: ' + error.message);
      });
  }

  stop() {
    if (!this.started) {
      const error = new Error('Calling stop for non-started instance');
      // eslint-disable-next-line no-console
      console.error('[PanoView:stop]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
    showInfo('Stopping panorama...');
    this.panoPlayer.destroy();
    this.panoPlayer = undefined;
    // TODO: Find and remove all created dom nodes, etc?
    removeAllChildren(this.panoNode);
    this.events.emit('panoStopped');
    this.started = false;
    showSuccess('Panorama stopped');
  }
}
