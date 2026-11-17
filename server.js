const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function makeCode() {
  let code;
  do {
    code = Array.from({length: 4}, () => CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}
function members(room) {
  return [...room.members].map(id => {
    const s = io.sockets.sockets.get(id);
    return s ? { id, name: s.data.playerName || "Player" } : null;
  }).filter(Boolean);
}
function updateRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("lobby-updated", {
    code,
    hostId: room.hostId,
    players: members(room).map(p => ({ id: p.id }))
  });
}
function removeFromRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;
  if (!room) return;
  room.members.delete(socket.id);
  if (room.hostId === socket.id) {
    io.to(code).emit("lobby-closed", { reason: "The host left. The lobby has closed." });
    for (const id of room.members) {
      const peer = io.sockets.sockets.get(id);
      if (peer) peer.data.roomCode = null;
    }
    rooms.delete(code);
  } else {
    if (room.members.size === 0) rooms.delete(code);
    else updateRoom(code);
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "Street Soccer multiplayer" }));
app.use(express.static(path.join(__dirname)));

io.on("connection", socket => {
  socket.on("create-lobby", (payload, ack) => {
    if (socket.data.roomCode) removeFromRoom(socket);
    const code = makeCode();
    const room = { hostId: socket.id, members: new Set([socket.id]) };
    rooms.set(code, room);
    socket.data.playerName = String(payload?.name || "Host").slice(0, 20);
    socket.data.roomCode = code;
    socket.join(code);
    if (typeof ack === "function") ack({ ok: true, lobby: { code, hostId: socket.id } });
    updateRoom(code);
  });

  socket.on("join-lobby", (payload, ack) => {
    const code = String(payload?.code || "").toUpperCase().replace(/[^A-Z]/g, "");
    const room = rooms.get(code);
    if (!room) return typeof ack === "function" && ack({ ok: false, error: "Lobby not found. Check the code." });
    if (room.members.size >= 20) return typeof ack === "function" && ack({ ok: false, error: "This lobby is full." });
    if (socket.data.roomCode) removeFromRoom(socket);
    socket.data.playerName = String(payload?.name || "Player").slice(0, 20);
    socket.data.roomCode = code;
    room.members.add(socket.id);
    socket.join(code);
    if (typeof ack === "function") ack({ ok: true, lobby: { code, hostId: room.hostId } });
    updateRoom(code);
  });

  socket.on("game-event", packet => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code) || !packet || typeof packet.event !== "string") return;
    // Relay gameplay/lobby messages to everyone else in the same room.
    socket.to(code).emit("game-event", { event: packet.event, data: packet.data, peer: socket.id });
  });

  socket.on("leave-lobby", ack => {
    removeFromRoom(socket);
    if (typeof ack === "function") ack({ ok: true });
  });
  socket.on("disconnect", () => removeFromRoom(socket));
});

server.listen(PORT, "0.0.0.0", () => console.log(`Street Soccer server listening on ${PORT}`));
