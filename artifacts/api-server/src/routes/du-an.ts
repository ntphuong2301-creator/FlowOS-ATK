/**
 * Route: /api/du-an
 * Danh sách dự án (dùng cho dropdown và filter)
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { yeuCauDangNhap } from "../middleware/xac-thuc.js";

const router = Router();
const prisma = new PrismaClient();

router.get("/", yeuCauDangNhap, async (_req, res) => {
  try {
    const duAn = await prisma.duAn.findMany({
      select: {
        id: true,
        ma: true,
        ten: true,
        trangThai: true,
        truongNhom: { select: { id: true, ten: true } },
      },
      orderBy: { ma: "asc" },
    });
    res.json(duAn);
  } catch (err) {
    console.error("Lỗi lấy danh sách dự án:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
