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

  let sessionStarted = false;
  let panoStarted = false;

  function updateButtons() {
    startButton.setEnabled(!sessionStarted && !!onStart);
    endButton.setEnabled(sessionStarted && !!onStop);

    vrStartButton.setEnabled(sessionStarted && !panoStarted && !!onVrStart);
    vrStopButton.setEnabled(sessionStarted && panoStarted && !!onVrStop);

    audioStartButton.setEnabled(sessionStarted && !!onAudioStart);
    audioStopButton.setEnabled(sessionStarted && !!onAudioStop);
    videoStartButton.setEnabled(sessionStarted && !!onVideoStart);
    videoStopButton.setEnabled(sessionStarted && !!onVideoStop);
  }

  events.on('tourSessionStarted', () => {
    sessionStarted = true;
    updateButtons();
  });

  events.on('tourSessionStopped', () => {
    sessionStarted = false;
    updateButtons();
  });

  events.on('panoStarted', () => {
    panoStarted = true;
    updateButtons();
  });
  events.on('panoStopped', () => {
    panoStarted = false;
    updateButtons();
  });
}
