/** @module PanoPlayer
 *  @since 2023.03.06, 20:49
 *  @changed 2023.03.07, 14:39
 */

/*
 * import { io, Socket } from 'socket.io-client';
 * import { TCasterViewMode } from '@/core/types';
 * interface TParams {
 *   uniquePanoId: string;
 *   panoSkinUrl: string;
 *   viewMode: TCasterViewMode;
 *   socketsUrl: string;
 *   socketsPath: string;
 * }
 */

const useSockets = true;

export class PanoPlayer {
  // Parameters...
  params;
  // Has player started?
  started = false;
  // Instances...
  pano;
  skin;
  socket;

  // TODO: Add errors handler registration?

  constructor(params) {
    this.params = params;
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

  startSockets() {
    if (useSockets) {
      const { socketsUrl, socketsPath } = this.params;
      const io = window.io; // Use local io (see `CasterViewScripts`)
      if (typeof io === 'function') {
        // @see https://socket.io/docs/v4/client-initialization/
        this.socket = io(socketsUrl, {
          path: socketsPath,
        });
        /* console.log('[this.started]: startSockets', {
         *   socket: this.socket,
         * });
         */
      }
    }
    return true;
  }

  initGuideEvents() {
    this.pano.addListener('changenode', () => {
      this.socket?.emit('msgGuideOpen', {
        nodeId: this.pano.getCurrentNode(),
      });
    });
    this.pano.addListener('positionchanged', () => {
      this.socket?.emit('msgGuideMove', {
        pan: this.pano.getPan(),
        fov: this.pano.getFov(),
        tilt: this.pano.getTilt(),
      });
    });
    return true;
  }

  initVisitorEvents() {
    this.socket?.on('connect', () => {
      this.socket?.emit('msgJoin', { visitId: this.socket?.id });
    });

    this.socket?.on('msgInit', (msg) => {
      if (msg.nodeId) {
        this.pano.openNext('{' + msg.nodeId + '}');
        this.pano.setPan(msg.pan);
        this.pano.setFov(msg.fov);
        this.pano.setTilt(msg.tilt);
      }
    });

    this.socket?.on('msgMove', (msg) => {
      this.pano.setPan(msg.pan);
      this.pano.setFov(msg.fov);
      this.pano.setTilt(msg.tilt);
    });

    this.socket?.on('msgOpen', (msg) => {
      this.pano.openNext('{' + msg.nodeId + '}');
    });
    return true;
  }

  initEvents() {
    const { viewMode } = this.params;
    return viewMode === 'guide' ? this.initGuideEvents() : this.initVisitorEvents();
  }

  start() {
    if (this.startPlayer() && this.startSockets() && this.initEvents()) {
      this.started = true;
    }
  }

  finish() {
    if (this.started) {
      // TODO?
    }
  }
}
