/**
 * Hook Socket.io cho FlowOS
 * Kết nối tới /api/socket.io, tham gia phòng theo duAnId
 * Lắng nghe: CONG_VIEC_CREATED, CONG_VIEC_UPDATED, CONG_VIEC_DELETED, BUOC_TIENDO_CHANGED
 */

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAppStore } from "@/lib/store";

interface SuKienCongViec {
  id: string;
  ten: string;
  trangThai?: string;
  mucUuTien?: string;
  ngayBatDau?: string | null;
  ngayKetThuc?: string | null;
  buocQuyTrinh?: { id: string; ten: string; ma: string } | null;
  nguoiPhuTrach?: { id: string; ten: string } | null;
  duAnId?: string;
}

interface SuKienBuocTienDo {
  buocId: string;
  soXong: number;
  soCongViec: number;
}

interface TuyChonDungSocket {
  duAnId: string | null | undefined;
  onCongViecMoi?: (cv: SuKienCongViec) => void;
  onCapNhatCongViec?: (cv: SuKienCongViec) => void;
  onXoaCongViec?: (data: { id: string; ten: string; buocQuyTrinhId?: string | null }) => void;
  onBuocTienDo?: (data: SuKienBuocTienDo) => void;
}

export function dungSocket(tuyChon: TuyChonDungSocket): void {
  const { duAnId, onCongViecMoi, onCapNhatCongViec, onXoaCongViec, onBuocTienDo } = tuyChon;
  const socketRef = useRef<Socket | null>(null);
  const token = useAppStore((s) => s.token);

  useEffect(() => {
    if (!duAnId || !token) return;

    const socketUrl = window.location.origin;
    const socket = io(socketUrl, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("thamGia:duAn", duAnId);
    });

    if (onCongViecMoi)      socket.on("CONG_VIEC_CREATED",      onCongViecMoi);
    if (onCapNhatCongViec)  socket.on("CONG_VIEC_UPDATED",      onCapNhatCongViec);
    if (onXoaCongViec)      socket.on("CONG_VIEC_DELETED",      onXoaCongViec);
    if (onBuocTienDo)       socket.on("BUOC_TIENDO_CHANGED",   onBuocTienDo);

    return () => {
      socket.emit("roiDi:duAn", duAnId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [duAnId, token]);
}
