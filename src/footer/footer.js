import { Button } from '../components/Button/Button.js';

let footerNode;

export function initFooter() {
  footerNode = document.querySelector('#footer');
}

export function startFooter(params = {}) {
  const {
    onStart,
    onEnd,
    onVrStart,
    onAudioStart,
    onVideoStart,
    onVrStop,
    onAudioStop,
    onVideoStop,
  } = params;

  const startButton = new Button(footerNode.querySelector('#startButton'));
  if (onStart) {
    startButton.enable().onClick(onStart);
  }

  const endButton = new Button(footerNode.querySelector('#endButton'));
  if (onEnd) {
    endButton.enable().onClick(onEnd);
  }

  const vrStartButton = new Button(footerNode.querySelector('#vrStartButton'));
  if (onVrStart) {
    vrStartButton.enable().onClick(onVrStart);
  }

  const audioStartButton = new Button(footerNode.querySelector('#audioStartButton'));
  if (onAudioStart) {
    audioStartButton.enable().onClick(onAudioStart);
  }

  const videoStartButton = new Button(footerNode.querySelector('#videoStartButton'));
  if (onVideoStart) {
    videoStartButton.enable().onClick(onVideoStart);
  }

  const vrStopButton = new Button(footerNode.querySelector('#vrStopButton'));
  if (onVrStop) {
    vrStopButton.enable().onClick(onVrStop);
  }

  const audioStopButton = new Button(footerNode.querySelector('#audioStopButton'));
  if (onAudioStop) {
    audioStopButton.enable().onClick(onAudioStop);
  }

  const videoStopButton = new Button(footerNode.querySelector('#videoStopButton'));
  if (onVideoStop) {
    videoStopButton.enable().onClick(onVideoStop);
  }
}
