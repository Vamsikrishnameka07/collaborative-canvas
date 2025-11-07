import { setupCanvas } from './canvas.js';
import { createWS } from './websocket.js';


const els = {
tool: document.getElementById('tool'),
color: document.getElementById('color'),
width: document.getElementById('width'),
undo: document.getElementById('undo'),
redo: document.getElementById('redo'),
users: document.getElementById('users'),
room: document.getElementById('room'),
name: document.getElementById('name'),
join: document.getElementById('join'),
};


const canvases = setupCanvas();
const ws = createWS();
let SELF = { id: null, color: '#000' };


// UI events
els.undo.onclick = () => ws.emit('op:undo');
els.redo.onclick = () => ws.emit('op:redo');
els.join.onclick = () => {
ws.emit('room:join', { roomId: els.room.value.trim() || 'default', name: els.name.value.trim() || undefined });
};


// Canvas draw control
canvases.onLocalStroke = (evt) => {
ws.emit(evt.type, evt.payload);
};


canvases.getTool = () => els.tool.value;
canvases.getColor = () => els.color.value || SELF.color;
canvases.getWidth = () => Number(els.width.value) || 6;


// WebSocket events -> canvas + UI
ws.on('init', (data) => {
SELF = data.self;
renderUsers(data.users);
canvases.resetAndReplay(data.operations);
});


ws.on('users:update', (users) => renderUsers(users));


ws.on('cursor:move', ev => canvases.drawCursor(ev));
ws.on('stroke:begin', ev => canvases.remoteBegin(ev));
ws.on('stroke:point', ev => canvases.remotePoint(ev));
ws.on('stroke:end', ev => canvases.remoteEnd(ev));


ws.on('op:add', op => canvases.applyOperation(op));
ws.on('op:remove', msg => canvases.removeOperation(msg.id));


function renderUsers(users) {
els.users.innerHTML = '';
users.forEach(u => {
const div = document.createElement('div');
div.className = 'user';
div.innerHTML = `<span class="dot" style="background:${u.color}"></span> <strong>${u.name || u.id}</strong>`;
els.users.appendChild(div);
});
}


// Auto-join default room on load
ws.emit('room:join', { roomId: 'default' });