export class Button {
  node = undefined;
  _bound_internalClickHandler = undefined;
  clickHandlers = [];

  constructor(node, opts = {}) {
    this.node = node;
    this._bound_internalClickHandler = this.internalClickHandler.bind(this);
    if (node) {
      node.addEventListener('click', this._bound_internalClickHandler);
    }
    if (opts.onClick) {
      this.clickHandlers.push(opts.onClick);
    }
  }

  destroy() {
    if (this.node) {
      this.node.removeEventListener('click', this._bound_internalClickHandler);
    }
  }

  internalClickHandler(ev) {
    this.clickHandlers.forEach((cb) => cb(ev));
  }
  enable() {
    this.node.removeAttribute('disabled');
    return this;
  }
  disable() {
    this.node.setAttribute('disabled', true);
    return this;
  }
  setEnabled(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
  setText(text) {
    if (this.node) {
      this.node.innerHTML = text;
    }
    return this;
  }
  onClick(cb) {
    if (cb) {
      this.clickHandlers.push(cb);
    }
    return this;
  }
}
