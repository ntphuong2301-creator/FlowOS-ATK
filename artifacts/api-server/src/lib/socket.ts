/**
 * Socket.io singleton — dùng chung cho toàn bộ routes
 * Khởi tạo trong index.ts, export io để routes emit sự kiện
 */

import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";

let io: Server | null = null;

export function khoiTaoSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
    path: "/api/socket.io",
  });

  io.on("connection", (socket) => {
    // Client tham gia phòng theo duAnId
    socket.on("thamGia:duAn", (duAnId: string) => {
      socket.join(`duAn:${duAnId}`);
    });

    socket.on("roiDi:duAn", (duAnId: string) => {
      socket.leave(`duAn:${duAnId}`);
    });
  });

  return io;
}

export function layIo(): Server {
  if (!io) throw new Error("Socket.io chưa được khởi tạo");
  return io;
}

// ─── Tiện ích emit sự kiện công việc ─────────────────────────────────────────

export function phatCongViecMoi(duAnId: string, data: unknown): void {
  try { layIo().to(`duAn:${duAnId}`).emit("CONG_VIEC_CREATED", data); }
  catch { /* socket chưa init (test mode) */ }
}

export function phatCapNhatCongViec(duAnId: string, data: unknown): void {
  try { layIo().to(`duAn:${duAnId}`).emit("CONG_VIEC_UPDATED", data); }
  catch { /* ignore */ }
}

export function phatXoaCongViec(duAnId: string, data: unknown): void {
  try { layIo().to(`duAn:${duAnId}`).emit("CONG_VIEC_DELETED", data); }
  catch { /* ignore */ }
}

export function phatBuocTienDo(duAnId: string, data: unknown): void {
  try { layIo().to(`duAn:${duAnId}`).emit("BUOC_TIENDO_CHANGED", data); }
  catch { /* ignore */ }
}
