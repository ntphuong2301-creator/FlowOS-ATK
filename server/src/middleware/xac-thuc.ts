import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "flowos-atk-secret-key-2026";

export interface PayloadJWT {
  nguoiDungId: string;
  email: string;
  capQuyen: string;
}

export interface YeuCauXacThuc extends Request {
  nguoiDungId?: string;
  email?: string;
  capQuyen?: string;
}

export function kyToken(payload: PayloadJWT): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function xacMinhToken(token: string): PayloadJWT {
  return jwt.verify(token, JWT_SECRET) as PayloadJWT;
}

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

  const token = authHeader.split(" ")[1];
  try {
    const payload = xacMinhToken(token);
    req.nguoiDungId = payload.nguoiDungId;
    req.email = payload.email;
    req.capQuyen = payload.capQuyen;
    next();
  } catch {
    res.status(401).json({ thongBao: "Phiên đăng nhập không hợp lệ" });
  }
}
