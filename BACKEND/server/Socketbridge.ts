import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { redisSub } from "../redis/redis.js";

let io: SocketIOServer;

export function initSocketBridge(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*" }, // tighten for production
  });

  io.on("connection", (socket) => {
    socket.on("join-group", (groupId: string) => {
      socket.join(`group:${groupId}`);
    });
    socket.on("leave-group", (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });
  });

  // One subscription covers every group's channel. This is what lets the
  // worker process (which has no socket connections of its own) broadcast
  // to clients connected to the API process — same bridge pattern as
  // StreamForge's Redis pub/sub -> WebSocket relay.
  redisSub.psubscribe("group-broadcast:*");
  redisSub.on("pmessage", (_pattern, channel, raw) => {
    const groupId = channel.replace("group-broadcast:", "");
    try {
      const message = JSON.parse(raw);
      io.to(`group:${groupId}`).emit("new-message", message);
    } catch (err) {
      console.error("[socketBridge] failed to parse broadcast payload", err);
    }
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.IO not initialized — call initSocketBridge first");
  return io;
}