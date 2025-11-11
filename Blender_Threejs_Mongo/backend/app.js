// backend/app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');

const blockRoutes = require('./routes/blockRoutes'); // tus rutas existentes

// ---- App base
const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: '*'}));
app.use(express.json({ limit: '10mb' }));

// Endpoint raíz (informativo)
app.get('/', (req, res) => {
  res.send(`
    <h1>API de bloques</h1>
    <p>Usa la ruta <code>/api/blocks</code> para interactuar con los bloques.</p>
    <p>Puerto actual: ${PORT}</p>
  `);
});

// Endpoint de salud (para verificar estado de DB)
app.get('/api/health', (req, res) => {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  res.json({ ok: true, dbState: mongoose.connection.readyState });
});

// Rutas de bloques
app.use('/api/blocks', blockRoutes);

// ---- Conexión a Mongo y arranque del server HTTP+SocketIO
async function start() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('Falta MONGO_URI en .env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    const server = http.createServer(app);
    const io = socketio(server, {
      cors: { origin: '*' }
    });

    // ====== Experiencia multijugador ======
    let players = {};

    io.on('connection', (socket) => {
      console.log(`🟢 Usuario conectado: ${socket.id}`);

      socket.on('new-player', (data) => {
        players[socket.id] = {
          id: socket.id,
          position: data?.position || { x: 0, y: 0, z: 0 },
          rotation: data?.rotation || 0,
          color: data?.color || '#ffffff'
        };

        socket.broadcast.emit('spawn-player', {
          id: socket.id,
          position: players[socket.id].position,
          rotation: players[socket.id].rotation,
          color: players[socket.id].color
        });

        socket.emit('players-update', players);

        const others = Object.entries(players)
          .filter(([id]) => id !== socket.id)
          .map(([id, info]) => ({
            id,
            position: info.position,
            rotation: info.rotation,
            color: info.color
          }));
        socket.emit('existing-players', others);
      });

      socket.on('update-position', ({ position, rotation }) => {
        if (players[socket.id]) {
          players[socket.id].position = position;
          players[socket.id].rotation = rotation;
          socket.broadcast.emit('update-player', {
            id: socket.id,
            position,
            rotation
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔴 Usuario desconectado: ${socket.id}`);
        delete players[socket.id];
        io.emit('remove-player', socket.id);
        io.emit('players-update', players);
      });
    });
    // ======================================

    server.listen(PORT, () => {
      console.log(`✅ Servidor HTTP+WS corriendo en http://localhost:${PORT}`);
    });

    // Cierres limpios
    const shutdown = async () => {
      console.log('\n🛑 Cerrando servidor...');
      await mongoose.connection.close();
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('❌ Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
