export function socketPromise(socket) {
  return function request(type, data = {}) {
    return new Promise((resolve) => {
      socket.emit(type, data, resolve);
    });
  };
}
