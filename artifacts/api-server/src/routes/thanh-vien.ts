/**
 * Route: /api/thanh-vien
 * Quản trị thành viên — chỉ QUAN_TRI_VIEN
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { yeuCauDangNhap, chiQuanTri } from "../middleware/xac-thuc.js";

const router = Router();
const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

const ND_SELECT = {
  id: true,
  ten: true,
  email: true,
  capQuyen: true,
  boPhan: true,
  mauAvatar: true,
  larkUserId: true,
  trangThai: true,
  taoLuc: true,
  phanQuyenDuAn: {
    select: {
      id: true,
      duAnId: true,
      xem: true,
      sua: true,
      taoBuoc: true,
      taoCongViec: true,
      duAn: { select: { id: true, ten: true, ma: true, mau: true } },
    },
  },
  // Thống kê dự án liên quan
  duAnTruong: { select: { id: true, ten: true, ma: true, mau: true } },
  nhatKy: {
    select: {
      id: true,
      bangDuLieu: true,
      hanhDong: true,
      giaTriMoi: true,
      taoLuc: true,
      duAn: { select: { ten: true, ma: true } },
    },
    orderBy: { taoLuc: "desc" as const },
    take: 10,
  },
};

// ─── GET /api/thanh-vien ────────────────────────────────────────────────────
router.get("/", yeuCauDangNhap, chiQuanTri, async (req, res) => {
  try {
    const { trangThai } = req.query;
    const where: { trangThai?: boolean } = {};
    if (trangThai === "hoat-dong") where.trangThai = true;
    else if (trangThai === "vo-hieu") where.trangThai = false;

    const members = await prisma.nguoiDung.findMany({
      where,
      select: {
        ...ND_SELECT,
        // Đếm công việc được giao
        _count: { select: { congViecPhuTrach: true } },
      },
      orderBy: [{ trangThai: "desc" }, { ten: "asc" }],
    });

    // Lấy danh sách dự án để tính số dự án mỗi người
    const allDuAn = await prisma.duAn.findMany({
      select: { id: true, ten: true, ma: true, mau: true, trangThai: true },
      orderBy: { ten: "asc" },
    });

    res.json({ thanhVien: members, danhSachDuAn: allDuAn });
  } catch (err) {
    console.error("Lỗi lấy danh sách thành viên:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/thanh-vien ───────────────────────────────────────────────────
router.post("/", yeuCauDangNhap, chiQuanTri, async (req, res) => {
  try {
    const { ten, email, matKhau, capQuyen, boPhan, mauAvatar } = req.body;
    if (!ten || !email || !matKhau) {
      res.status(400).json({ thongBao: "Thiếu thông tin bắt buộc" });
      return;
    }
    const exists = await prisma.nguoiDung.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ thongBao: "Email này đã được sử dụng" });
      return;
    }
    const hash = await bcrypt.hash(matKhau, 10);
    const member = await prisma.nguoiDung.create({
      data: { ten, email, matKhau: hash, capQuyen: capQuyen ?? "THANH_VIEN", boPhan, mauAvatar },
      select: ND_SELECT,
    });
    res.status(201).json(member);
  } catch (err) {
    console.error("Lỗi tạo thành viên:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── PATCH /api/thanh-vien/:id ──────────────────────────────────────────────
router.patch("/:id", yeuCauDangNhap, chiQuanTri, async (req, res) => {
  try {
    const { id } = req.params;
    const { ten, email, boPhan, mauAvatar, larkUserId, capQuyen } = req.body;

    if (email) {
      const exists = await prisma.nguoiDung.findFirst({ where: { email, NOT: { id } } });
      if (exists) {
        res.status(409).json({ thongBao: "Email này đã được sử dụng" });
        return;
      }
    }

    const updated = await prisma.nguoiDung.update({
      where: { id },
      data: {
        ...(ten !== undefined && { ten }),
        ...(email !== undefined && { email }),
        ...(boPhan !== undefined && { boPhan }),
        ...(mauAvatar !== undefined && { mauAvatar }),
        ...(larkUserId !== undefined && { larkUserId }),
        ...(capQuyen !== undefined && { capQuyen }),
      },
      select: ND_SELECT,
    });
    res.json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật thành viên:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/thanh-vien/:id/phan-quyen ───────────────────────────────────
router.post("/:id/phan-quyen", yeuCauDangNhap, chiQuanTri, async (req, res) => {
  try {
    const { id } = req.params;
    const { capQuyen, danhSachQuyenDuAn } = req.body;
    // capQuyen: string | undefined
    // danhSachQuyenDuAn: Array<{ duAnId, xem, sua, taoBuoc, taoCongViec }>

    const updates: Promise<unknown>[] = [];

    if (capQuyen) {
      updates.push(prisma.nguoiDung.update({ where: { id }, data: { capQuyen } }));
    }

    if (Array.isArray(danhSachQuyenDuAn)) {
      for (const q of danhSachQuyenDuAn) {
        updates.push(
          prisma.phanQuyenDuAn.upsert({
            where: { nguoiDungId_duAnId: { nguoiDungId: id, duAnId: q.duAnId } },
            update: { xem: q.xem, sua: q.sua, taoBuoc: q.taoBuoc, taoCongViec: q.taoCongViec, capNhat: new Date() },
            create: { nguoiDungId: id, duAnId: q.duAnId, xem: q.xem ?? true, sua: q.sua ?? false, taoBuoc: q.taoBuoc ?? false, taoCongViec: q.taoCongViec ?? false },
          })
        );
      }
    }

    await Promise.all(updates);

    const member = await prisma.nguoiDung.findUnique({ where: { id }, select: ND_SELECT });
    res.json(member);
  } catch (err) {
    console.error("Lỗi phân quyền:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/thanh-vien/:id/vo-hieu-hoa ──────────────────────────────────
router.post("/:id/vo-hieu-hoa", yeuCauDangNhap, chiQuanTri, async (req, res) => {
  try {
    const { id } = req.params;
    const member = await prisma.nguoiDung.findUnique({ where: { id }, select: { trangThai: true } });
    if (!member) {
      res.status(404).json({ thongBao: "Không tìm thấy thành viên" });
      return;
    }
    const updated = await prisma.nguoiDung.update({
      where: { id },
      data: { trangThai: !member.trangThai },
      select: ND_SELECT,
    });
    res.json(updated);
  } catch (err) {
    console.error("Lỗi vô hiệu hóa:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
