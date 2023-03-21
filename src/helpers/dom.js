export function toggleClassName(node, cls, isOn) {
  if (isOn && !node.classList.contains(cls)) {
    node.classList.add(cls);
  } else if (!isOn && node.classList.contains(cls)) {
    node.classList.remove(cls);
  }
}
