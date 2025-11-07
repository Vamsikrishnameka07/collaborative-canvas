export function createWS() {
const socket = io();
const listeners = new Map();


socket.onAny((event, payload) => {
const fns = listeners.get(event);
if (fns) fns.forEach(fn => fn(payload));
});


return {
on: (event, fn) => {
if (!listeners.has(event)) listeners.set(event, []);
listeners.get(event).push(fn);
},
emit: (event, payload) => socket.emit(event, payload)
};
}