import { Button } from '../components/Button/Button.js';

let footerNode,
  endButton,
  vrStartButton,
  audioStartButton,
  videoStartButton,
  vrStopButton,
  audioStopButton,
  videoStopButton;

export function initFooter() {
  footerNode = document.querySelector('#footer');

  endButton = new Button(footerNode.querySelector('#endButton'));

  vrStartButton = new Button(footerNode.querySelector('#vrStartButton'));
  audioStartButton = new Button(footerNode.querySelector('#audioStartButton'));
  videoStartButton = new Button(footerNode.querySelector('#videoStartButton'));

  vrStopButton = new Button(footerNode.querySelector('#vrStopButton'));
  audioStopButton = new Button(footerNode.querySelector('#audioStopButton'));
  videoStopButton = new Button(footerNode.querySelector('#videoStopButton'));
}

export function startFooter(params = {}) {
  const { onVrStart, onAudioStart, onVideoStart, onVrStop, onAudioStop, onVideoStop } = params;

  if (endButton) {
    endButton.enable();
    let hasStarted = false;
    endButton.onClick(() => {
      hasStarted = !hasStarted;
      endButton.setText(hasStarted ? 'End' : 'Start');
    });
  }

  if (vrStartButton && onVrStart) {
    vrStartButton.enable();
    vrStartButton.onClick(onVrStart);
  }

  if (audioStartButton && onAudioStart) {
    audioStartButton.enable();
    audioStartButton.onClick(onAudioStart);
  }

  if (videoStartButton && onVideoStart) {
    videoStartButton.enable();
    videoStartButton.onClick(onVideoStart);
  }

  if (vrStopButton && onVrStop) {
    vrStopButton.enable();
    vrStopButton.onClick(onVrStop);
  }

  if (audioStopButton && onAudioStop) {
    audioStopButton.enable();
    audioStopButton.onClick(onAudioStop);
  }

  if (videoStopButton && onVideoStop) {
    videoStopButton.enable();
    videoStopButton.onClick(onVideoStop);
  }
}
