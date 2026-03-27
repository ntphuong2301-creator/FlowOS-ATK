/**
 * Route: /api/can-tro
 * Quản lý cản trở — dùng Prisma, tích hợp Lark
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { yeuCauDangNhap, type YeuCauXacThuc } from "../middleware/xac-thuc.js";
import {
  guiCanhBaoCanTro,
  guiDaGiaiQuyet,
} from "../services/lark.service.js";

const router = Router();
const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function phanTrangSo(v: unknown, mac = 20): number {
  const n = parseInt(String(v));
  return isNaN(n) || n < 1 ? mac : n;
}

// ─── GET /api/can-tro — Danh sách (có filter) ────────────────────────────────
router.get("/", yeuCauDangNhap, async (req, res) => {
  try {
    const { trangThai, mucDo, duAnId, trang, gioi_han } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (trangThai) where.trangThai = trangThai;
    if (mucDo)     where.mucDo    = mucDo;
    if (duAnId)    where.duAnId   = duAnId;

    const limit = phanTrangSo(gioi_han, 50);
    const page  = phanTrangSo(trang, 1);
    const skip  = (page - 1) * limit;

    const [items, tong] = await Promise.all([
      prisma.canTro.findMany({
        where,
        include: {
          duAn:          { select: { id: true, ten: true, ma: true } },
          buocBiChan:    { select: { id: true, ten: true, ma: true } },
          congViecBiChan:{ select: { id: true, ten: true } },
          nguoiGap:      { select: { id: true, ten: true, email: true } },
          nguoiXuLy:     { select: { id: true, ten: true, email: true } },
          capNhat:       { orderBy: { taoLuc: "desc" }, take: 3 },
        },
        orderBy: [{ trangThai: "asc" }, { mucDo: "asc" }, { ngayPhatSinh: "desc" }],
        skip,
        take: limit,
      }),
      prisma.canTro.count({ where }),
    ]);

    res.json({ items, tong, trang: page, gioi_han: limit });
  } catch (err) {
    console.error("Lỗi danh sách cản trở:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/can-tro/thong-ke — Số liệu tổng quan ──────────────────────────
router.get("/thong-ke", yeuCauDangNhap, async (_req, res) => {
  try {
    const [dangMo, ratNghiemTrong, daGiaiQuyet, tatCa] = await Promise.all([
      prisma.canTro.count({ where: { trangThai: "MO" } }),
      prisma.canTro.count({ where: { mucDo: "RAT_NGHIEM_TRONG", trangThai: { not: "DA_GIAI_QUYET" } } }),
      prisma.canTro.count({
        where: {
          trangThai: "DA_GIAI_QUYET",
          ngayXuLy: { gte: new Date(Date.now() - 7 * 86400_000) },
        },
      }),
      prisma.canTro.findMany({
        where: { trangThai: { not: "DA_GIAI_QUYET" }, ngayPhatSinh: { not: undefined } },
        select: { ngayPhatSinh: true },
      }),
    ]);

    const tongNgayKet = tatCa.reduce((acc, ct) => {
      const ngay = Math.floor((Date.now() - new Date(ct.ngayPhatSinh).getTime()) / 86400_000);
      return acc + ngay;
    }, 0);
    const trungBinhNgayKet = tatCa.length ? Math.round(tongNgayKet / tatCa.length) : 0;

    res.json({ dangMo, ratNghiemTrong, daGiaiQuyetTuan: daGiaiQuyet, trungBinhNgayKet });
  } catch (err) {
    console.error("Lỗi thống kê cản trở:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/can-tro — Tạo mới ─────────────────────────────────────────────
router.post("/", yeuCauDangNhap, async (req: YeuCauXacThuc, res) => {
  try {
    const {
      ten,
      mucDo = "VUA_PHAI",
      duAnId,
      buocBiChanId,
      congViecBiChanId,
      nguoiXuLyId,
      hanXuLy,
      larkChatId,
      guiLark = true,
    } = req.body;

    if (!ten || !duAnId) {
      res.status(400).json({ thongBao: "Thiếu hạng mục hoặc dự án" });
      return;
    }

    const nguoiGapId = req.nguoiDungId!;

    const canTro = await prisma.canTro.create({
      data: {
        ten,
        mucDo,
        duAnId,
        buocBiChanId:     buocBiChanId     || null,
        congViecBiChanId: congViecBiChanId || null,
        nguoiGapId,
        nguoiXuLyId:  nguoiXuLyId || null,
        hanXuLy:      hanXuLy ? new Date(hanXuLy) : null,
        larkChatId:   larkChatId || null,
        ngayPhatSinh: new Date(),
      },
      include: {
        duAn:          { select: { id: true, ten: true } },
        congViecBiChan:{ select: { id: true, ten: true } },
        nguoiGap:      { select: { id: true, ten: true, email: true } },
        nguoiXuLy:     { select: { id: true, ten: true, email: true, larkUserId: true } },
      },
    });

    // Gửi Lark sau khi tạo (không block response)
    if (guiLark !== false && guiLark !== "false") {
      guiCanhBaoCanTro(
        canTro,
        canTro.congViecBiChan,
        canTro.duAn,
        canTro.nguoiXuLy,
        larkChatId
      )
        .then(async (msgId) => {
          if (msgId) {
            await prisma.canTro.update({
              where: { id: canTro.id },
              data: { larkMessageId: msgId },
            });
          }
        })
        .catch((err) => console.warn("[Lark] Lỗi gửi cảnh báo:", err));
    }

    res.status(201).json(canTro);
  } catch (err) {
    console.error("Lỗi tạo cản trở:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/can-tro/:id ─────────────────────────────────────────────────────
router.get("/:id", yeuCauDangNhap, async (req, res) => {
  try {
    const canTro = await prisma.canTro.findUnique({
      where: { id: req.params.id },
      include: {
        duAn:          { select: { id: true, ten: true, ma: true } },
        buocBiChan:    { select: { id: true, ten: true } },
        congViecBiChan:{ select: { id: true, ten: true } },
        nguoiGap:      { select: { id: true, ten: true, email: true } },
        nguoiXuLy:     { select: { id: true, ten: true, email: true } },
        capNhat:       { orderBy: { taoLuc: "desc" } },
      },
    });
    if (!canTro) {
      res.status(404).json({ thongBao: "Không tìm thấy cản trở" });
      return;
    }
    res.json(canTro);
  } catch (err) {
    console.error("Lỗi lấy cản trở:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── PATCH /api/can-tro/:id — Cập nhật ───────────────────────────────────────
router.patch("/:id", yeuCauDangNhap, async (req: YeuCauXacThuc, res) => {
  try {
    const { trangThai, mucDo, nguoiXuLyId, hanXuLy, giaiPhap, ...rest } = req.body;

    const truoc = await prisma.canTro.findUnique({
      where: { id: req.params.id },
      include: {
        nguoiXuLy: { select: { id: true, ten: true, email: true } },
      },
    });
    if (!truoc) {
      res.status(404).json({ thongBao: "Không tìm thấy cản trở" });
      return;
    }

    const data: Record<string, unknown> = { ...rest };
    if (trangThai)    data.trangThai    = trangThai;
    if (mucDo)        data.mucDo        = mucDo;
    if (nguoiXuLyId !== undefined) data.nguoiXuLyId = nguoiXuLyId || null;
    if (hanXuLy !== undefined)     data.hanXuLy     = hanXuLy ? new Date(hanXuLy) : null;
    if (giaiPhap !== undefined)    data.giaiPhap    = giaiPhap;
    if (trangThai === "DA_GIAI_QUYET") data.ngayXuLy = new Date();

    const capNhat = await prisma.canTro.update({
      where: { id: req.params.id },
      data,
      include: {
        duAn:     { select: { id: true, ten: true } },
        nguoiGap: { select: { id: true, ten: true, email: true } },
        nguoiXuLy:{ select: { id: true, ten: true, email: true, larkUserId: true } },
      },
    });

    // Gửi Lark khi đánh dấu đã giải quyết
    if (trangThai === "DA_GIAI_QUYET" && truoc.trangThai !== "DA_GIAI_QUYET") {
      const nguoiGiaiQuyet = capNhat.nguoiXuLy ?? {
        ten: "Hệ thống",
        email: "",
        larkUserId: null,
      };
      guiDaGiaiQuyet(capNhat, nguoiGiaiQuyet).catch((err) =>
        console.warn("[Lark] Lỗi gửi đã giải quyết:", err)
      );
    }

    res.json(capNhat);
  } catch (err) {
    console.error("Lỗi cập nhật cản trở:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/can-tro/:id/cap-nhat — Thêm nhật ký ──────────────────────────
router.post("/:id/cap-nhat", yeuCauDangNhap, async (req: YeuCauXacThuc, res) => {
  try {
    const { noiDung } = req.body;
    if (!noiDung) {
      res.status(400).json({ thongBao: "Thiếu nội dung cập nhật" });
      return;
    }

    const ct = await prisma.capNhatCanTro.create({
      data: {
        canTroId:    req.params.id,
        nguoiDungId: req.nguoiDungId!,
        noiDung,
      },
      include: {
        nguoiDung: { select: { id: true, ten: true } },
      },
    });

    res.status(201).json(ct);
  } catch (err) {
    console.error("Lỗi thêm cập nhật:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
