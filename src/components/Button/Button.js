export class Button {
  node;
  onClickHandlers = [];
  constructor(node) {
    this.node = node;
    this._onClickHandler = this.onClickHandler.bind(this);
    if (node) {
      node.addEventListener('click', this._onClickHandler);
    }
  }
  setText(text) {
    if (this.node) {
      this.node.innerHTML = text;
    }
  }
  destroy() {
    if (this.node) {
      this.node.removeEventListener('click', this._onClickHandler);
    }
  }
  onClickHandler(ev) {
    this.onClickHandlers.forEach((cb) => cb(ev));
  }
  onClick(cb) {
    if (cb) {
      this.onClickHandlers.push(cb);
    }
  }
}
