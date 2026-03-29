import express from 'express';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveBattle, generateBotTeam, generateBossTeam, resolveEncoreBattle } from './src/game/battleEngine';
import { CardData } from './src/types';
import { getWeekNumber } from './src/game/generator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  const PORT = 3000;

  // Matchmaking queues
  let singleQueue: { id: string, username: string, deck: CardData[], rating: number }[] = [];
  let teamQueue: { id: string, username: string, deck: CardData[], rating: number }[] = [];
  const activeSockets = new Map<string, string>(); // socketId -> username

  const broadcastOnlineUsers = () => {
    const onlineUsers = Array.from(activeSockets.values());
    io.emit('online_users', onlineUsers);
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('set_username', (username: string) => {
      activeSockets.set(socket.id, username);
      broadcastOnlineUsers();
    });

    socket.on('join_queue', ({ mode, deck, username, rating }) => {
      activeSockets.set(socket.id, username || 'Player');
      broadcastOnlineUsers();
      
      const pRating = rating || 0;

      if (mode === 'single') {
        // Remove existing entry if any
        singleQueue = singleQueue.filter(p => p.id !== socket.id);
        
        // Try to find a match within 1000 rating difference
        const matchIndex = singleQueue.findIndex(p => Math.abs(p.rating - pRating) <= 1000);
        if (matchIndex !== -1) {
          const p1 = singleQueue.splice(matchIndex, 1)[0];
          const p2 = { id: socket.id, username: username || 'Player', deck, rating: pRating };
          startPvPBattle(p1, p2, 'single');
        } else {
          singleQueue.push({ id: socket.id, username: username || 'Player', deck, rating: pRating });
        }
      } else if (mode === 'team') {
        // Remove existing entry if any
        teamQueue = teamQueue.filter(p => p.id !== socket.id);
        
        const matchIndex = teamQueue.findIndex(p => Math.abs(p.rating - pRating) <= 1000);
        if (matchIndex !== -1) {
          const p1 = teamQueue.splice(matchIndex, 1)[0];
          const p2 = { id: socket.id, username: username || 'Player', deck, rating: pRating };
          startPvPBattle(p1, p2, 'team');
        } else {
          teamQueue.push({ id: socket.id, username: username || 'Player', deck, rating: pRating });
        }
      }
    });

    socket.on('leave_queue', () => {
      singleQueue = singleQueue.filter(p => p.id !== socket.id);
      teamQueue = teamQueue.filter(p => p.id !== socket.id);
    });

    socket.on('start_pve', ({ mode, deck, username, rating }) => {
      activeSockets.set(socket.id, username || 'Player');
      broadcastOnlineUsers();
      
      const pRating = rating || 0;
      const isBoss = mode === 'boss';
      const botDeck = isBoss ? generateBossTeam(pRating) : generateBotTeam(mode === 'single' ? 1 : 3, pRating);
      const weekNumber = getWeekNumber();
      const result = resolveBattle(deck, botDeck, username || 'Player', isBoss ? '__BOSS__' : '__BOT__', weekNumber, isBoss);
      socket.emit('battle_result', { ...result, myRole: username || 'Player', opponentName: isBoss ? '__BOSS__' : '__BOT__', opponentDeck: botDeck, myDeck: deck });
    });

    socket.on('start_encore', ({ deck, username, rating }) => {
      activeSockets.set(socket.id, username || 'Player');
      broadcastOnlineUsers();
      
      const pRating = rating || 0;
      const weekNumber = getWeekNumber();
      const result = resolveEncoreBattle(deck, username || 'Player', pRating, weekNumber);
      socket.emit('battle_result', { ...result, myRole: username || 'Player', opponentName: '__ENCORE__', opponentDeck: [], myDeck: deck });
    });

    socket.on('disconnect', () => {
      singleQueue = singleQueue.filter(p => p.id !== socket.id);
      teamQueue = teamQueue.filter(p => p.id !== socket.id);
      activeSockets.delete(socket.id);
      broadcastOnlineUsers();
    });
  });

  function startPvPBattle(p1: { id: string, username: string, deck: CardData[] }, p2: { id: string, username: string, deck: CardData[] }, mode: string) {
    const weekNumber = getWeekNumber();
    const result = resolveBattle(p1.deck, p2.deck, p1.username, p2.username, weekNumber, false, true);
    
    io.to(p1.id).emit('battle_result', { ...result, myRole: p1.username, opponentName: p2.username, opponentDeck: p2.deck, myDeck: p1.deck });
    io.to(p2.id).emit('battle_result', { ...result, myRole: p2.username, opponentName: p1.username, opponentDeck: p1.deck, myDeck: p2.deck });
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
