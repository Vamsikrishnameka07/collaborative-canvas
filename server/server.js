import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { createRoomsManager } from './rooms.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Serve static client
app.use(express.static('client'));

// Rooms manager
const rooms = createRoomsManager();

io.on('connection', socket => {
  console.log('Client connected:', socket.id); // <-- ADD THIS FOR DEBUG
  const userId = uuidv4();
  const userColor = rooms.getRandomColor();
  let currentRoom = null;

  socket.on('room:join', ({ roomId, name }) => {
    currentRoom = roomId || 'default';
    socket.join(currentRoom);

    rooms.addUser(currentRoom, {
      id: userId,
      name: name || `User-${userId.slice(0, 4)}`,
      color: userColor
    });

    const state = rooms.getState(currentRoom);

    socket.emit('init', {
      self: { id: userId, color: userColor },
      users: rooms.getUsers(currentRoom),
      operations: state.operations
    });

    socket.to(currentRoom).emit('users:update', rooms.getUsers(currentRoom));
  });

  socket.on('cursor:move', (payload) => {
    socket.to(currentRoom).emit('cursor:move', { userId, ...payload });
  });

  socket.on('stroke:begin', (p) => {
    socket.to(currentRoom).emit('stroke:begin', { userId, ...p });
  });

  socket.on('stroke:point', (p) => {
    socket.to(currentRoom).emit('stroke:point', { userId, ...p });
  });

  socket.on('stroke:end', (p) => {
    const op = rooms.commitOperation(currentRoom, {
      id: p.id || uuidv4(),
      userId,
      tool: p.tool,
      color: p.color,
      width: p.width,
      points: p.points,
      ts: Date.now()
    });

    io.to(currentRoom).emit('op:add', op);
  });

  socket.on('op:undo', () => {
    const removed = rooms.undo(currentRoom);
    if (removed) io.to(currentRoom).emit('op:remove', { id: removed.id });
  });

  socket.on('op:redo', () => {
    const op = rooms.redo(currentRoom);
    if (op) io.to(currentRoom).emit('op:add', op);
  });

  socket.on('disconnect', () => {
    rooms.removeUser(currentRoom, userId);
    socket.to(currentRoom).emit('users:update', rooms.getUsers(currentRoom));
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});
