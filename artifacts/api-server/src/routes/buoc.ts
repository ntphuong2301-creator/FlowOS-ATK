/**
 * Route: /api/buoc
 * Quản lý bước quy trình + thêm công việc vào bước
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { yeuCauDangNhap } from "../middleware/xac-thuc.js";
import { quyenTaoCongViec } from "../middleware/quyen-cong-viec.js";
import { phatCongViecMoi } from "../lib/socket.js";

const router = Router();
const prisma = new PrismaClient();

// ─── GET /api/buoc/dependencies — Lấy tất cả liên kết bước ─────────────────

router.get("/dependencies", yeuCauDangNhap, async (req, res) => {
  try {
    const records = await prisma.phuThuocBuoc.findMany({
      select: { id: true, phuThuocVaoId: true, buocId: true },
      orderBy: { buocId: "asc" },
    });
    res.json(records.map(r => ({
      id: r.id,
      fromBuocId: r.phuThuocVaoId,
      toBuocId: r.buocId,
    })));
  } catch (err) {
    console.error("Lỗi lấy dependencies:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/buoc/dependencies — Tạo liên kết bước mới ────────────────────

router.post("/dependencies", yeuCauDangNhap, async (req, res) => {
  try {
    const { fromBuocId, toBuocId } = req.body as { fromBuocId: string; toBuocId: string };
    if (!fromBuocId || !toBuocId) {
      return void res.status(400).json({ thongBao: "Thiếu fromBuocId hoặc toBuocId" });
    }
    if (fromBuocId === toBuocId) {
      return void res.status(400).json({ thongBao: "Không thể liên kết bước với chính nó" });
    }
    const reverseCycle = await prisma.phuThuocBuoc.findFirst({
      where: { phuThuocVaoId: toBuocId, buocId: fromBuocId },
    });
    if (reverseCycle) {
      return void res.status(400).json({ thongBao: "Liên kết sẽ tạo vòng lặp trực tiếp" });
    }
    const existing = await prisma.phuThuocBuoc.findFirst({
      where: { phuThuocVaoId: fromBuocId, buocId: toBuocId },
    });
    if (existing) {
      return void res.status(400).json({ thongBao: "Liên kết đã tồn tại" });
    }
    const created = await prisma.phuThuocBuoc.create({
      data: { phuThuocVaoId: fromBuocId, buocId: toBuocId, loai: "FS", soNgayTre: 0 },
      select: { id: true, phuThuocVaoId: true, buocId: true },
    });
    res.status(201).json({
      id: created.id,
      fromBuocId: created.phuThuocVaoId,
      toBuocId: created.buocId,
    });
  } catch (err) {
    console.error("Lỗi tạo dependency:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── DELETE /api/buoc/dependencies/:depId — Xóa liên kết bước ───────────────

router.delete("/dependencies/:depId", yeuCauDangNhap, async (req, res) => {
  try {
    await prisma.phuThuocBuoc.delete({ where: { id: req.params.depId } });
    res.json({ thongBao: "Đã xóa liên kết" });
  } catch (err) {
    console.error("Lỗi xóa dependency:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/buoc/:id/cong-viec — Thêm công việc vào bước ─────────────────

router.post("/:id/cong-viec", yeuCauDangNhap, quyenTaoCongViec, async (req, res) => {
  try {
    const { id: buocId } = req.params;
    const body = req.body as Record<string, unknown>;
    const {
      ten, inchargeId, nguoiPhuTrachId,
      ngayKetThuc, ngayBatDau,
      moTa, dinhNghiaHoanThanh, ghiChu,
      mucUuTien = "TRUNG_BINH",
      nguoiPhoiHop, sanPhamIds,
    } = body as {
      ten: string;
      inchargeId?: string;
      nguoiPhuTrachId?: string;
      ngayKetThuc: string;
      ngayBatDau?: string;
      moTa?: string;
      dinhNghiaHoanThanh?: string;
      ghiChu?: string;
      mucUuTien?: string;
      nguoiPhoiHop?: string[];
      sanPhamIds?: string[];
    };

    if (!ten || !ngayKetThuc) {
      return void res.status(400).json({ thongBao: "Thiếu tên và hạn hoàn thành" });
    }

    const buoc = await prisma.buoc.findUnique({
      where: { id: buocId },
      select: { id: true, duAnId: true, ten: true, ma: true },
    });
    if (!buoc) return void res.status(404).json({ thongBao: "Không tìm thấy bước" });

    const phuTrachId = inchargeId ?? nguoiPhuTrachId;

    const cv = await prisma.congViec.create({
      data: {
        ten,
        duAnId: buoc.duAnId,
        buocQuyTrinhId: buocId,
        nguoiPhuTrachId: phuTrachId || null,
        ngayKetThuc: new Date(ngayKetThuc),
        ngayBatDau: ngayBatDau ? new Date(ngayBatDau) : null,
        moTa: moTa || null,
        dinhNghiaHoanThanh: dinhNghiaHoanThanh || null,
        ghiChu: ghiChu || null,
        mucUuTien: mucUuTien as "THAP" | "TRUNG_BINH" | "CAO" | "KHAN_CAP",
        trangThai: "CHUA_LAM",
        nguoiPhoiHop: Array.isArray(nguoiPhoiHop) ? nguoiPhoiHop : [],
        sanPhamIds: Array.isArray(sanPhamIds) ? sanPhamIds : [],
      },
      select: {
        id: true, ten: true, trangThai: true,
        mucUuTien: true, ngayBatDau: true, ngayKetThuc: true,
        moTa: true, dinhNghiaHoanThanh: true, ghiChu: true,
        nguoiPhoiHop: true, sanPhamIds: true,
        duAnId: true,
        nguoiPhuTrach: { select: { id: true, ten: true } },
        buocQuyTrinh: { select: { id: true, ten: true, ma: true } },
        duAn: { select: { id: true, ten: true, ma: true } },
      },
    });

    // Tự động cập nhật trạng thái bước → DANG_LAM nếu đang CHUA_LAM
    const buocHienTai = await prisma.buoc.findUnique({
      where: { id: buocId },
      select: { trangThai: true },
    });
    if (buocHienTai?.trangThai === "CHUA_LAM") {
      await prisma.buoc.update({
        where: { id: buocId },
        data: { trangThai: "DANG_LAM" },
      });
    }

    phatCongViecMoi(buoc.duAnId, cv);
    res.status(201).json(cv);
  } catch (err) {
    console.error("Lỗi thêm công việc vào bước:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── PATCH /api/buoc/:id/danh-dau-xong — Leader đánh dấu bước xong ──────────

router.patch("/:id/danh-dau-xong", yeuCauDangNhap, async (req, res) => {
  try {
    const { id: buocId } = req.params;

    const buoc = await prisma.buoc.findUnique({
      where: { id: buocId },
      select: { id: true, ten: true, ma: true },
    });
    if (!buoc) return void res.status(404).json({ thongBao: "Không tìm thấy bước" });

    const updated = await prisma.buoc.update({
      where: { id: buocId },
      data: { trangThai: "XONG" },
      select: { id: true, ten: true, ma: true, trangThai: true },
    });

    res.json({
      thongBao: `Đã đánh dấu bước ${buoc.ma} xong`,
      buoc: updated,
    });
  } catch (err) {
    console.error("Lỗi đánh dấu bước xong:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/buoc/:id — Chi tiết bước (dùng từ panel) ──────────────────────

router.get("/:id", yeuCauDangNhap, async (req, res) => {
  try {
    const buoc = await prisma.buoc.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, ten: true, ma: true, trangThai: true,
        ngayBatDau: true, ngayKetThuc: true,
        diaDiemHoanThanh: true,
        duAn: { select: { id: true, ten: true, ma: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
        congViec: {
          where: { daXoa: false },
          select: {
            id: true, ten: true, trangThai: true,
            ngayKetThuc: true, ngayKetThucThucTe: true,
            nguoiPhuTrach: { select: { id: true, ten: true } },
          },
          orderBy: { ngayKetThuc: "asc" },
        },
      },
    });
    if (!buoc) return void res.status(404).json({ thongBao: "Không tìm thấy bước" });
    res.json(buoc);
  } catch (err) {
    console.error("Lỗi lấy bước:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
