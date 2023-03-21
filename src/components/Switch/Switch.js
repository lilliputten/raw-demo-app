import { toggleClassName } from '../../helpers/dom.js';

export class Switch {
  node;
  input;
  checked;
  onToggleHandlers = [];
  constructor(node) {
    this.node = node;
    this._onClickHandler = this.onClickHandler.bind(this);
    if (node) {
      node.addEventListener('click', this._onClickHandler);
      const inputs = node.getElementsByTagName('input');
      this.input = inputs[0];
    }
    if (this.input) {
      this.checked = this.input.checked;
      this.updateStyles();
    } else {
      this.checked = this.node.classList.contains('checked');
    }
  }
  destroy() {
    if (this.node) {
      this.node.removeEventListener('click', this._onClickHandler);
    }
  }
  updateStyles() {
    toggleClassName(this.node, 'checked', this.checked);
  }
  onClickHandler(ev) {
    const isDisabled = this.node.getAttribute('disabled') != null;
    if (!isDisabled) {
      this.checked = !this.checked;
      if (this.input) {
        this.input.checked = this.checked;
      }
      this.updateStyles();
      this.onToggleHandlers.forEach((cb) => cb(this.checked));
    }
  }
  onToggle(cb) {
    if (cb) {
      this.onToggleHandlers.push(cb);
    }
  }
}
