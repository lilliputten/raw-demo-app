/** @module MicroEvents
 *  @class MicroEvents
 *  @desc Minimal events manager engine
 *  @since 2023.03.23, 13:20
 *  @changed 2023.03.23, 20:21
 */

export class MicroEvents /** @lends MicroEvents.prototype */ {
  /** Event handlers storage
   * @type {Object}
   */
  handlers = {};

  /** Add event handler
   * @param {String} id
   * @param {Function} cb
   * @return {Object} this
   */
  on(id, cb) {
    if (typeof cb === 'function') {
      (this.handlers[id] || (this.handlers[id] = [])).push(cb);
    }
    return this;
  }

  /** Remove event handler
   * @param {String} id
   * @param {Function} cb
   * @return {Object} this
   */
  off(id, cb) {
    if (cb && typeof cb === 'function') {
      const cbs = this.handlers[id];
      if (Array.isArray(cbs) && cbs.length) {
        const found = cbs.indexOf(cb);
        if (found !== -1) {
          cbs.splice(found, 1);
        }
      }
    } else if (id) {
      // id without callback -- clear all callbacks for id
      const cbs = this.handlers[id];
      if (Array.isArray(cbs) && cbs.length) {
        delete this.handlers[id];
        // cbs.splice(0, cbs.length)
      }
    } else {
      // No arguments -- clear all}
      this.handlers = {};
    }
    return this;
  }

  /** Emit event
   * @param {String} id
   * @param {*} [...args]
   * @return {Object} this
   */
  emit(id, ...args) {
    const cbs = this.handlers[id];
    if (Array.isArray(cbs) && cbs.length) {
      cbs.forEach((cb) => {
        if (typeof cb === 'function') {
          // TODO: To reset all timers on `off`?
          setTimeout(() => {
            cb.apply(this, args);
          }, 0);
        }
      });
    }
    return this;
  }
}
