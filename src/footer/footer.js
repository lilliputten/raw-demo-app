import { Button } from '../components/Button/Button.js';
import { getQuerySelector } from '../helpers/dom.js';

let footerNode;

export function initFooter() {
  footerNode = document.querySelector('#footer');
}

export function startFooter(params = {}) {
  const {
    events,
    onStart,
    onStop,
    onVrStart,
    onAudioStart,
    onVideoStart,
    onVrStop,
    onAudioStop,
    onVideoStop,
  } = params;

  const footerQuery = getQuerySelector(footerNode);

  const startButton = new Button(footerQuery('#startButton'), { onClick: onStart });
  const endButton = new Button(footerQuery('#endButton'), { onClick: onStop });
  const vrStartButton = new Button(footerQuery('#vrStartButton'), { onClick: onVrStart });
  const audioStartButton = new Button(footerQuery('#audioStartButton'), { onClick: onAudioStart });
  const videoStartButton = new Button(footerQuery('#videoStartButton'), { onClick: onVideoStart });
  const vrStopButton = new Button(footerQuery('#vrStopButton'), { onClick: onVrStop });
  const audioStopButton = new Button(footerQuery('#audioStopButton'), { onClick: onAudioStop });
  const videoStopButton = new Button(footerQuery('#videoStopButton'), { onClick: onVideoStop });

  onStart && startButton.setEnabled(true);

  events.on('tourSessionStarted', () => {
    startButton.setEnabled(false);
    endButton.setEnabled(!!onStop);

    vrStartButton.setEnabled(!!onVrStart);
    audioStartButton.setEnabled(!!onAudioStart);
    videoStartButton.setEnabled(!!onVideoStart);
    vrStopButton.setEnabled(!!onVrStop);
    audioStopButton.setEnabled(!!onAudioStop);
    videoStopButton.setEnabled(!!onVideoStop);
  });

  events.on('tourSessionStopped', () => {
    startButton.setEnabled(!!onStart);
    endButton.setEnabled(false);

    vrStartButton.setEnabled(false);
    audioStartButton.setEnabled(false);
    videoStartButton.setEnabled(false);
    vrStopButton.setEnabled(false);
    audioStopButton.setEnabled(false);
    videoStopButton.setEnabled(false);
  });
}
