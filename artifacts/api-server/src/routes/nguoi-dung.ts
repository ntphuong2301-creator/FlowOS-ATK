/**
 * Route: /api/nguoi-dung
 * Danh sách thành viên (dùng cho dropdown, không cần quyền đặc biệt)
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { yeuCauDangNhap } from "../middleware/xac-thuc.js";

const router = Router();
const prisma = new PrismaClient();

router.get("/", yeuCauDangNhap, async (_req, res) => {
  try {
    const members = await prisma.nguoiDung.findMany({
      where: { trangThai: true },
      select: {
        id: true,
        ten: true,
        email: true,
        capQuyen: true,
        mauAvatar: true,
        larkUserId: true,
      },
      orderBy: { ten: "asc" },
    });
    res.json(members);
  } catch (err) {
    console.error("Lỗi lấy danh sách thành viên:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
