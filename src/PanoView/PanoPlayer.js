/** @module PanoPlayer
 *  @since 2023.03.06, 20:49
 *  @changed 2023.03.07, 14:39
 */

import { showError } from '../notify/notify.js';

const useSockets = true;

export class PanoPlayer {
  // Parameters...
  params;
  // Has player started?
  started = false;
  // Instances...
  pano;
  skin;
  // socket;

  // TODO: Add errors handler registration?

  constructor(params) {
    this.params = params;
    // Test params?
    if (!this.params.socket) {
      const error = new Error('Socket has not specified for PanoPlayer');
      // eslint-disable-next-line no-console
      console.error('[PanoPlayer:constructor]: error', error);
      debugger; // eslint-disable-line no-debugger
      showError(error);
      throw error;
    }
  }

  hasStarted() {
    return this.started;
  }

  startPlayer() {
    const { uniquePanoId, panoSkinUrl } = this.params;
    if (!this.started && window.pano2vrPlayer && window.pano2vrSkin) {
      this.pano = new window.pano2vrPlayer(uniquePanoId);
      if (this.pano) {
        this.skin = new window.pano2vrSkin(this.pano, panoSkinUrl);
        this.pano.readConfigUrlAsync(panoSkinUrl + 'index.xml');
        return true;
      }
    }
  }

  stopPlayer() {
    if (this.started) {
      // Destroy: this.pano, this.skin
      this.pano.removePanorama();
      this.skin.removeSkinHotspots();
      this.pano = undefined;
      this.skin = undefined;
      return true;
    }
  }

  startSockets() {
    /* // UNUSED: Using external sockets (from params)
     * if (useSockets) {
     *   debugger;
     *   const { panoSocketsUrl, panoSocketsPath } = this.params;
     *   const io = window.io; // Use local io (see `CasterViewScripts`)
     *   if (typeof io === 'function') {
     *     // @see https://socket.io/docs/v4/client-initialization/
     *     this.socket = io(panoSocketsUrl, {
     *       path: panoSocketsPath,
     *     });
     *   }
     * }
     */
    return true;
  }

  stopSockets() {
    /* // UNUSED: Using external sockets
     * if (useSockets && this.socket) {
     *   this.socket.destroy();
     *   this.socket = undefined;
     * }
     */
    return true;
  }

  startGuideEvents() {
    this.pano.addListener('changenode', () => {
      this.params.socket?.emit('msgGuideOpen', {
        nodeId: this.pano.getCurrentNode(),
      });
    });
    this.pano.addListener('positionchanged', () => {
      this.params.socket?.emit('msgGuideMove', {
        pan: this.pano.getPan(),
        fov: this.pano.getFov(),
        tilt: this.pano.getTilt(),
      });
    });
    return true;
  }

  stopGuideEvents() {
    this.pano.removeEventListener('changenode');
    this.pano.removeEventListener('positionchanged');
    return true;
  }

  startVisitorEvents() {
    this.params.socket?.on('connect', () => {
      this.params.socket?.emit('msgJoin', { visitId: this.params.socket?.id });
    });

    this.params.socket?.on('msgInit', (msg) => {
      if (msg.nodeId) {
        this.pano.openNext('{' + msg.nodeId + '}');
        this.pano.setPan(msg.pan);
        this.pano.setFov(msg.fov);
        this.pano.setTilt(msg.tilt);
      }
    });

    this.params.socket?.on('msgMove', (msg) => {
      this.pano.setPan(msg.pan);
      this.pano.setFov(msg.fov);
      this.pano.setTilt(msg.tilt);
    });

    this.params.socket?.on('msgOpen', (msg) => {
      this.pano.openNext('{' + msg.nodeId + '}');
    });
    return true;
  }

  stopVisitorEvents() {
    this.params.socket?.off('connect');
    this.params.socket?.off('msgInit');
    this.params.socket?.off('msgMove');
    this.params.socket?.off('msgOpen');
    return true;
  }

  startEvents() {
    const { isGuide } = this.params;
    return isGuide ? this.startGuideEvents() : this.startVisitorEvents();
  }

  stopEvents() {
    const { isGuide } = this.params;
    return isGuide ? this.stopGuideEvents() : this.stopVisitorEvents();
  }

  start() {
    return new Promise((resolve, reject) => {
      if (!this.startPlayer()) {
        const error = new Error('Player start failed');
        // eslint-disable-next-line no-console
        console.error('[PanoView:start]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        reject(error);
      } else if (!this.startSockets()) {
        const error = new Error('Sockets start failed');
        // eslint-disable-next-line no-console
        console.error('[PanoView:start]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        reject(error);
      } else if (!this.startEvents()) {
        const error = new Error('Events start failed');
        // eslint-disable-next-line no-console
        console.error('[PanoView:start]: error', error);
        debugger; // eslint-disable-line no-debugger
        showError(error);
        reject(error);
      } else {
        // Success
        this.started = true;
        resolve();
      }
    });
  }

  stop() {
    if (this.started) {
      this.stopEvents();
      this.stopSockets();
      this.stopPlayer();
      this.started = false;
    }
  }

  destroy() {
    this.stop();
  }
}
