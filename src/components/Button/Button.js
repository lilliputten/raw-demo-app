export class Button {
  node;
  clickHandlers = [];
  constructor(node) {
    this.node = node;
    this._internalClickHandler = this.internalClickHandler.bind(this);
    if (node) {
      node.addEventListener('click', this._internalClickHandler);
    }
  }
  destroy() {
    if (this.node) {
      this.node.removeEventListener('click', this._internalClickHandler);
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
