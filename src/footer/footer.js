import { Button } from '../components/Button/Button.js';
import { isGuide } from '../config.js';
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
  let videoStarted = false;
  let audioStarted = false;

  let hasVideo = false;
  let hasAudio = false;

  function updateButtons() {
    /* console.log('footerQuery:updateButtons', {
     *   isGuide,
     *   hasAudio,
     *   hasVideo,
     *   sessionStarted,
     *   panoStarted,
     *   audioStarted,
     *   videoStarted,
     *   onAudioStart,
     *   onAudioStop,
     *   onStart,
     *   onStop,
     *   onVideoStart,
     *   onVideoStop,
     *   onVrStart,
     *   onVrStop,
     * });
     */

    startButton.setEnabled(!sessionStarted && !!onStart);
    endButton.setEnabled(sessionStarted && !!onStop);

    vrStartButton.setEnabled(sessionStarted && !panoStarted && !!onVrStart);
    vrStopButton.setEnabled(sessionStarted && panoStarted && !!onVrStop);

    audioStartButton.setEnabled(
      sessionStarted && !audioStarted && !!onAudioStart && hasAudio && !isGuide,
    );
    audioStopButton.setEnabled(sessionStarted && audioStarted && !!onAudioStop);

    videoStartButton.setEnabled(
      sessionStarted && !videoStarted && !!onVideoStart && (isGuide || hasVideo),
    );
    videoStopButton.setEnabled(sessionStarted && videoStarted && !!onVideoStop);
  }

  events.on('MediaClient:updatePeers', (params) => {
    // console.log('footer:event:MediaClient:updatePeers', { params });
    hasVideo = params.hasVideo;
    hasAudio = params.hasAudio;
    updateButtons();
  });

  events.on('tourSessionStarted', () => {
    // console.log('footer:event:tourSessionStarted');
    sessionStarted = true;
    updateButtons();
  });

  events.on('tourSessionStopped', () => {
    // console.log('footer:event:tourSessionStopped');
    sessionStarted = false;
    updateButtons();
  });

  events.on('panoStarted', () => {
    // console.log('footer:event:panoStarted');
    panoStarted = true;
    updateButtons();
  });
  events.on('panoStopped', () => {
    // console.log('footer:event:panoStopped');
    panoStarted = false;
    updateButtons();
  });

  events.on('MediaClient:audioStarted', () => {
    // console.log('footer:event:audioStarted');
    audioStarted = true;
    updateButtons();
  });
  events.on('MediaClient:audioStopped', () => {
    // console.log('footer:event:audioStopped');
    audioStarted = false;
    updateButtons();
  });

  events.on('MediaClient:videoStarted', () => {
    // console.log('footer:event:videoStarted');
    videoStarted = true;
    updateButtons();
  });
  events.on('MediaClient:videoStopped', () => {
    // console.log('footer:event:videoStopped');
    videoStarted = false;
    updateButtons();
  });
}
