const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = [];

io.on('connection', (socket) => {
  console.log('Novo dispositivo conectado:', socket.id);

  if (players.length < 2) {
    players.push(socket.id);
    const role = players.length === 1 ? 'p1' : 'p2';
    socket.emit('assign-role', role);
    console.log(`Dispositivo ${socket.id} definido como: ${role}`);
  } else {
    socket.emit('assign-role', 'spectator');
  }

  socket.on('player-action', (actionData) => {
    io.emit('game-action', actionData);
  });

  socket.on('disconnect', () => {
    console.log('Dispositivo desconectado:', socket.id);
    players = players.filter(id => id !== socket.id);
  });
});

server.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});