import { Button } from '../components/Button/Button.js';
import { Switch } from '../components/Switch/Switch.js';

export function initFooter(params = {}) {
  const { onVideoToggle, onVrToggle } = params;
  const footerNode = document.querySelector('#footer');

  let hasStarted = false;
  const endButton = new Button(footerNode.querySelector('#endButton'));
  endButton.onClick((ev) => {
    console.log('onClick endButton', { ev });
    hasStarted = !hasStarted;
    endButton.setText(hasStarted ? 'End' : 'Start');
  });

  const vrSwitch = new Switch(footerNode.querySelector('#vrSwitch'));
  vrSwitch.onToggle(onVrToggle);

  const audioSwitch = new Switch(footerNode.querySelector('#audioSwitch'));
  audioSwitch.onToggle((checked) => {
    console.log('onClick audioSwitch', { checked });
  });

  const videoSwitch = new Switch(footerNode.querySelector('#videoSwitch'));
  videoSwitch.onToggle(onVideoToggle);
}
