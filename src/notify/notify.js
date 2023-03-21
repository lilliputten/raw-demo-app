let rootNode;
let notifyRoot;
let inited = false;

const timeoutDelay = 3000;

// Modes: info, error, warn, success

const icons = {
  success: 'fa-check',
  error: 'fa-warning',
  warn: 'fa-bell',
  info: 'fa-info',
};

function init() {
  if (!inited) {
    rootNode = document.querySelector('.root');
    notifyRoot = document.createElement('div');
    notifyRoot.classList.add('notifyRoot');
    notifyRoot.setAttribute('id', 'notifyRoot');
    rootNode.appendChild(notifyRoot);
    inited = true;
  }
}

export function showNotify(mode, text) {
  if (!text) {
    text = mode;
    mode = 'info';
  }
  inited || init();
  const node = document.createElement('div');
  node.classList.add('notify');
  node.classList.add('notify_' + mode);
  // Add icon...
  const nodeIcon = document.createElement('div');
  nodeIcon.classList.add('icon');
  nodeIcon.classList.add('fa');
  nodeIcon.classList.add(icons[mode]);
  node.appendChild(nodeIcon);
  // Add text...
  const nodeText = document.createElement('div');
  nodeText.classList.add('text');
  nodeText.innerHTML = text;
  node.appendChild(nodeText);
  notifyRoot.appendChild(node);
  // Remove node after delay...
  const handler = setTimeout(() => {
    notifyRoot.removeChild(node);
  }, timeoutDelay);
  // Click handler...
  node.addEventListener('click', () => {
    notifyRoot.removeChild(node);
    clearTimeout(handler);
  });
  // TODO: Stop timer on hover
}

export function showInfo(text) {
  showNotify('info', text);
}

export function showSuccess(text) {
  showNotify('success', text);
}

export function showWarn(text) {
  showNotify('warn', text);
}

export function showError(text) {
  showNotify('error', text);
}
