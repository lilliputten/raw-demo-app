export function toggleClassName(node, cls, isOn) {
  if (isOn && !node.classList.contains(cls)) {
    node.classList.add(cls);
  } else if (!isOn && node.classList.contains(cls)) {
    node.classList.remove(cls);
  }
}

export function removeAllChildren(node) {
  if (node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }
}

export function querySelector(query, node = undefined) {
  if (!node) {
    node = document;
  }
  return node.querySelector(query);
}

export function getQuerySelector(node) {
  if (!node) {
    node = document;
  }
  return node.querySelector.bind(node);
}

/** @return promise */
export function addScript(url) {
  return new Promise((resolve, reject) => {
    // document.write('<script src="' + url + '"></script>');
    var script = document.createElement('script');
    script.setAttribute('src', url);
    script.addEventListener('load', resolve);
    script.addEventListener('error', reject);
    document.head.appendChild(script);
  });
}
