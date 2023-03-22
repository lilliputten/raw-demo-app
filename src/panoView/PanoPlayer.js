/** @module PanoPlayer
 *  @since 2023.03.06, 20:49
 *  @changed 2023.03.07, 14:39
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
    if (useSockets) {
      const { socketsUrl, socketsPath } = this.params;
      const io = window.io; // Use local io (see `CasterViewScripts`)
      if (typeof io === 'function') {
        // @see https://socket.io/docs/v4/client-initialization/
        this.socket = io(socketsUrl, {
          path: socketsPath,
        });
      }
    }
    return true;
  }

  stopSockets() {
    if (useSockets && this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    return true;
  }

  startGuideEvents() {
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

  stopGuideEvents() {
    this.pano.removeEventListener('changenode');
    this.pano.removeEventListener('positionchanged');
    return true;
  }

  startVisitorEvents() {
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

  stopVisitorEvents() {
    this.socket?.off('connect');
    this.socket?.off('msgInit');
    this.socket?.off('msgMove');
    this.socket?.off('msgOpen');
    return true;
  }

  startEvents() {
    const { viewMode } = this.params;
    return viewMode === 'guide' ? this.startGuideEvents() : this.startVisitorEvents();
  }

  stopEvents() {
    const { viewMode } = this.params;
    return viewMode === 'guide' ? this.stopGuideEvents() : this.stopVisitorEvents();
  }

  start() {
    return new Promise((resolve, reject) => {
      if (this.startPlayer() && this.startSockets() && this.startEvents()) {
        this.started = true;
        resolve();
      } else {
        reject('Failed'); // TODO: Provide fail reason?
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
}
