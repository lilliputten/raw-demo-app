import { Button } from '../components/Button/Button.js';

let footerNode, endButton, vrButton, audioButton, videoButton;

export function initFooter() {
  footerNode = document.querySelector('#footer');
  endButton = new Button(footerNode.querySelector('#endButton'));
  vrButton = new Button(footerNode.querySelector('#vrButton'));
  audioButton = new Button(footerNode.querySelector('#audioButton'));
  videoButton = new Button(footerNode.querySelector('#videoButton'));
}

export function startFooter(params = {}) {
  const { onVideoClick, onVrClick } = params;

  if (endButton) {
    endButton.enable();
    let hasStarted = false;
    endButton.onClick(() => {
      hasStarted = !hasStarted;
      endButton.setText(hasStarted ? 'End' : 'Start');
    });
  }

  if (vrButton) {
    vrButton.enable();
    vrButton.onClick(onVrClick);
  }

  if (audioButton) {
    // audioButton.enable();
    audioButton.onClick(() => {
      console.log('onClick audioButton');
      debugger;
    });
  }

  if (videoButton) {
    videoButton.enable();
    videoButton.onClick(onVideoClick);
  }
}
