import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface YeuCauXacThuc extends Request {
  nguoiDungId?: string;
  capQuyen?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "flowos-atk-secret-key-2026";

export function yeuCauDangNhap(
  req: YeuCauXacThuc,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ thongBao: "Bạn chưa đăng nhập" });
    return;
  }
  try {
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET) as {
      nguoiDungId: string;
      capQuyen: string;
    };
    req.nguoiDungId = payload.nguoiDungId;
    req.capQuyen = payload.capQuyen;
    next();
  } catch {
    res.status(401).json({ thongBao: "Phiên đăng nhập không hợp lệ" });
  }
}

export function chiQuanTri(
  req: YeuCauXacThuc,
  res: Response,
  next: NextFunction
): void {
  if (req.capQuyen !== "QUAN_TRI_VIEN") {
    res.status(403).json({ thongBao: "Bạn không có quyền thực hiện thao tác này" });
    return;
  }
  next();
}
