import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const router: Router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "flowos-atk-secret-key-2026";

interface YeuCauXacThuc extends Request {
  nguoiDungId?: string;
}

function kyToken(payload: { nguoiDungId: string; email: string; capQuyen: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function yeuCauDangNhap(req: YeuCauXacThuc, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ thongBao: "Bạn chưa đăng nhập" });
    return;
  }
  try {
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET) as { nguoiDungId: string };
    req.nguoiDungId = payload.nguoiDungId;
    next();
  } catch {
    res.status(401).json({ thongBao: "Phiên đăng nhập không hợp lệ" });
  }
}

router.post("/dang-nhap", async (req, res) => {
  try {
    const { email, matKhau } = req.body;
    if (!email || !matKhau) {
      res.status(400).json({ thongBao: "Vui lòng nhập email và mật khẩu" });
      return;
    }

    const nguoiDung = await prisma.nguoiDung.findUnique({ where: { email } });
    if (!nguoiDung) {
      res.status(401).json({ thongBao: "Email hoặc mật khẩu không đúng" });
      return;
    }

    const hopLe = await bcrypt.compare(matKhau, nguoiDung.matKhau);
    if (!hopLe) {
      res.status(401).json({ thongBao: "Email hoặc mật khẩu không đúng" });
      return;
    }

    const token = kyToken({
      nguoiDungId: nguoiDung.id,
      email: nguoiDung.email,
      capQuyen: nguoiDung.capQuyen,
    });

    res.json({
      token,
      nguoiDung: {
        id: nguoiDung.id,
        ten: nguoiDung.ten,
        email: nguoiDung.email,
        capQuyen: nguoiDung.capQuyen,
        mauAvatar: nguoiDung.mauAvatar,
      },
    });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

router.post("/dang-xuat", (_req, res) => {
  res.json({ thongBao: "Đăng xuất thành công" });
});

router.get("/toi", yeuCauDangNhap, async (req: YeuCauXacThuc, res) => {
  try {
    const nguoiDung = await prisma.nguoiDung.findUnique({
      where: { id: req.nguoiDungId },
    });
    if (!nguoiDung) {
      res.status(404).json({ thongBao: "Không tìm thấy người dùng" });
      return;
    }
    res.json({
      id: nguoiDung.id,
      ten: nguoiDung.ten,
      email: nguoiDung.email,
      capQuyen: nguoiDung.capQuyen,
      mauAvatar: nguoiDung.mauAvatar,
    });
  } catch (err) {
    console.error("Lỗi lấy thông tin:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
