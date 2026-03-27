/**
 * Middleware phân quyền cho công việc (CongViec)
 *
 * QUAN_TRI_VIEN : toàn quyền
 * TRUONG_NHOM   : tạo / sửa bất kỳ / xóa bất kỳ
 * THANH_VIEN    : tạo, sửa công việc do mình phụ trách, KHÔNG được xóa
 * QUAN_SAT      : chỉ đọc
 */

import type { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import type { YeuCauXacThuc } from "./xac-thuc.js";

const prisma = new PrismaClient();

// ─── Tạo công việc ────────────────────────────────────────────────────────────

export function quyenTaoCongViec(
  req: YeuCauXacThuc,
  res: Response,
  next: NextFunction
): void {
  const cap = req.capQuyen;
  if (cap === "QUAN_SAT") {
    res.status(403).json({ thongBao: "Quan sát viên không được tạo công việc" });
    return;
  }
  next();
}

// ─── Sửa công việc ────────────────────────────────────────────────────────────

export async function quyenSuaCongViec(
  req: YeuCauXacThuc,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cap = req.capQuyen;
  if (cap === "QUAN_SAT") {
    res.status(403).json({ thongBao: "Quan sát viên không được sửa công việc" });
    return;
  }
  if (cap === "QUAN_TRI_VIEN" || cap === "TRUONG_NHOM") {
    next();
    return;
  }
  // THANH_VIEN: chỉ sửa công việc do mình phụ trách
  try {
    const cv = await prisma.congViec.findUnique({
      where: { id: req.params["id"] },
      select: { nguoiPhuTrachId: true },
    });
    if (!cv) {
      res.status(404).json({ thongBao: "Không tìm thấy công việc" });
      return;
    }
    if (cv.nguoiPhuTrachId !== req.nguoiDungId) {
      res.status(403).json({ thongBao: "Bạn chỉ có thể sửa công việc do mình phụ trách" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ thongBao: "Lỗi kiểm tra quyền" });
  }
}

// ─── Xóa công việc ────────────────────────────────────────────────────────────

export function quyenXoaCongViec(
  req: YeuCauXacThuc,
  res: Response,
  next: NextFunction
): void {
  const cap = req.capQuyen;
  if (cap !== "QUAN_TRI_VIEN" && cap !== "TRUONG_NHOM") {
    res.status(403).json({ thongBao: "Chỉ quản trị viên hoặc trưởng nhóm mới được xóa công việc" });
    return;
  }
  next();
}

// ─── Khôi phục công việc đã xóa ───────────────────────────────────────────────

export function quyenKhoiPhucCongViec(
  req: YeuCauXacThuc,
  res: Response,
  next: NextFunction
): void {
  if (req.capQuyen !== "QUAN_TRI_VIEN") {
    res.status(403).json({ thongBao: "Chỉ quản trị viên mới được khôi phục công việc đã xóa" });
    return;
  }
  next();
}
