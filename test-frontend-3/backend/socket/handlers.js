export const handleSocketEvents = (io, socket) => {
  socket.on('message:send', (data) => {
    io.emit('message:new', data);
  });

  socket.on('user:typing', (data) => {
    socket.broadcast.emit('user:typing', data);
  });

  socket.on('user:stopped-typing', (data) => {
    socket.broadcast.emit('user:stopped-typing', data);
  });
};