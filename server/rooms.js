import { v4 as uuidv4 } from 'uuid';


// Simple per-room state with global op stack + redo stack
export function createRoomsManager() {
const rooms = new Map();


function ensure(roomId) {
if (!rooms.has(roomId)) {
rooms.set(roomId, {
users: new Map(),
operations: [],
redo: []
});
}
return rooms.get(roomId);
}


function getState(roomId) {
return ensure(roomId);
}


function getUsers(roomId) {
return Array.from(ensure(roomId).users.values());
}


function addUser(roomId, user) {
ensure(roomId).users.set(user.id, user);
}


function removeUser(roomId, userId) {
ensure(roomId).users.delete(userId);
}


function commitOperation(roomId, op) {
const room = ensure(roomId);
const operation = { ...op, id: op.id || uuidv4() };
room.operations.push(operation);
room.redo = []; // invalidate redo stack on new op
return operation;
}


function undo(roomId) {
const room = ensure(roomId);
const op = room.operations.pop();
if (op) room.redo.push(op);
return op || null;
}


function redo(roomId) {
const room = ensure(roomId);
const op = room.redo.pop();
if (op) room.operations.push(op);
return op || null;
}


function getRandomColor() {
const palette = [
'#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
'#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
'#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
'#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];
return palette[Math.floor(Math.random() * palette.length)];
}


return {
getState,
getUsers,
addUser,
removeUser,
commitOperation,
undo,
redo,
getRandomColor
};
}