/**
 * Route: /api/cong-viec
 * CRUD + Dependency + Timeline Impact cho công việc
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { yeuCauDangNhap, chiQuanTri } from "../middleware/xac-thuc.js";
import {
  quyenTaoCongViec,
  quyenSuaCongViec,
  quyenXoaCongViec,
  quyenKhoiPhucCongViec,
} from "../middleware/quyen-cong-viec.js";
import {
  layUpstream,
  layDownstream,
  tinhImpactTimeline,
  batChCapNhatDownstream,
} from "../services/dependency.service.js";
import { guiThongBaoTimeline } from "../services/lark.service.js";
import {
  phatCongViecMoi,
  phatCapNhatCongViec,
  phatXoaCongViec,
  phatBuocTienDo,
} from "../lib/socket.js";

const router = Router();
const prisma = new PrismaClient();

const CV_SELECT_FULL = {
  id: true,
  ten: true,
  trangThai: true,
  mucUuTien: true,
  dinhNghiaHoanThanh: true,
  ngayBatDau: true,
  ngayKetThuc: true,
  ngayKetThucThucTe: true,
  soNgayTre: true,
  soNgayDuKien: true,
  buocQuyTrinh: { select: { id: true, ten: true, ma: true } },
  duAn: { select: { id: true, ten: true, ma: true } },
  nguoiPhuTrach: { select: { id: true, ten: true, larkUserId: true } },
  canTro: { select: { id: true, ten: true, trangThai: true } },
  phuThuocVao: {
    select: {
      loai: true,
      soNgayBuffer: true,
      phuThuocVao: { select: { id: true, ten: true, trangThai: true, ngayKetThuc: true, nguoiPhuTrach: { select: { id: true, ten: true } }, buocQuyTrinh: { select: { id: true, ten: true, ma: true } }, duAn: { select: { id: true, ten: true, ma: true } } } },
    },
  },
  caCongViecPhuThuoc: {
    select: {
      loai: true,
      soNgayBuffer: true,
      congViec: { select: { id: true, ten: true, trangThai: true, ngayKetThuc: true, nguoiPhuTrach: { select: { id: true, ten: true } }, buocQuyTrinh: { select: { id: true, ten: true, ma: true } }, duAn: { select: { id: true, ten: true, ma: true } } } },
    },
  },
} as const;

// ─── GET /api/cong-viec — Danh sách + filter + grouped by buoc ─────────────

router.get("/", yeuCauDangNhap, async (req, res) => {
  try {
    const {
      q, duAnId, trangThai, inchargeId,
      tuNgay, denNgay, grouped,
    } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { daXoa: false };
    if (duAnId)     where.duAnId          = duAnId;
    if (inchargeId) where.nguoiPhuTrachId = inchargeId;
    if (q) where.ten = { contains: q, mode: "insensitive" };

    // Filter trạng thái (có thể là comma-separated: DANG_LAM,BI_CHAN)
    if (trangThai) {
      const list = trangThai.split(",").map(s => s.trim()).filter(Boolean);
      if (list.length === 1) where.trangThai = list[0];
      else where.trangThai = { in: list };
    }

    // Date range filter
    if (tuNgay || denNgay) {
      const dateFilter: Record<string, Date> = {};
      if (tuNgay) dateFilter.gte = new Date(tuNgay);
      if (denNgay) dateFilter.lte = new Date(denNgay);
      where.ngayKetThuc = dateFilter;
    }

    const items = await prisma.congViec.findMany({
      where,
      select: {
        id: true, ten: true, trangThai: true,
        mucUuTien: true,
        moTa: true, dinhNghiaHoanThanh: true,
        ngayBatDau: true, ngayKetThuc: true, ngayKetThucThucTe: true,
        soNgayTre: true,
        duAn: { select: { id: true, ten: true, ma: true } },
        sanPham: { select: { id: true, ten: true, maSp: true } },
        nguoiPhuTrach: { select: { id: true, ten: true, larkUserId: true } },
        buocQuyTrinh: {
          select: {
            id: true, ten: true, ma: true,
            trangThai: true,
            ngayBatDau: true, ngayKetThuc: true,
            nguoiPhuTrach: { select: { id: true, ten: true } },
            duAn: { select: { id: true, ten: true, ma: true } },
            congViec: { select: { id: true, trangThai: true } },
          }
        },
        canTro: { where: { trangThai: "MO" }, select: { id: true, ten: true, mucDo: true } },
      },
      orderBy: [{ buocQuyTrinhId: "asc" }, { ngayKetThuc: "asc" }],
      take: 200,
    });

    // Grouped by buoc nếu yêu cầu
    if (grouped === "buoc") {
      const groups: Record<string, {
        buoc: { id: string; ten: string; ma: string; trangThai: string; ngayBatDau: unknown; ngayKetThuc: unknown; nguoiPhuTrach: unknown; duAn: unknown; soXong: number; soCongViec: number } | null;
        congViec: typeof items;
      }> = {};

      for (const cv of items) {
        const key = cv.buocQuyTrinh?.id ?? "__khong_co_buoc__";
        if (!groups[key]) {
          const buocData = cv.buocQuyTrinh;
          groups[key] = {
            buoc: buocData ? {
              id: buocData.id,
              ten: buocData.ten,
              ma: buocData.ma,
              trangThai: buocData.trangThai,
              ngayBatDau: buocData.ngayBatDau,
              ngayKetThuc: buocData.ngayKetThuc,
              nguoiPhuTrach: buocData.nguoiPhuTrach,
              duAn: buocData.duAn,
              soXong: buocData.congViec.filter(c => c.trangThai === "XONG").length,
              soCongViec: buocData.congViec.length,
            } : null,
            congViec: [],
          };
        }
        groups[key].congViec.push(cv);
      }
      return void res.json(Object.values(groups));
    }

    res.json(items);
  } catch (err) {
    console.error("Lỗi lấy danh sách công việc:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/cong-viec/da-xoa — Danh sách đã xóa mềm ──────────────────────

router.get("/da-xoa", yeuCauDangNhap, async (req, res) => {
  try {
    const { duAnId, buocId } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { daXoa: true };
    if (duAnId) where.duAnId = duAnId;
    if (buocId) where.buocQuyTrinhId = buocId;

    const items = await prisma.congViec.findMany({
      where,
      select: {
        id: true, ten: true, trangThai: true, mucUuTien: true,
        ngayXoa: true, lyDoXoa: true,
        duAn: { select: { id: true, ten: true, ma: true } },
        buocQuyTrinh: { select: { id: true, ten: true, ma: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
      },
      orderBy: { ngayXoa: "desc" },
      take: 100,
    });

    res.json(items);
  } catch (err) {
    console.error("Lỗi lấy danh sách đã xóa:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/cong-viec/:id — Chi tiết một công việc ───────────────────────

router.get("/:id", yeuCauDangNhap, async (req, res) => {
  try {
    const cv = await prisma.congViec.findUnique({
      where: { id: req.params.id },
      select: CV_SELECT_FULL,
    });
    if (!cv) return void res.status(404).json({ thongBao: "Không tìm thấy công việc" });
    res.json(cv);
  } catch (err) {
    console.error("Lỗi lấy chi tiết công việc:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/cong-viec/:id/dependency — Upstream + Downstream + tác động ──

router.get("/:id/dependency", yeuCauDangNhap, async (req, res) => {
  try {
    const { id } = req.params;

    const cv = await prisma.congViec.findUnique({
      where: { id },
      select: CV_SELECT_FULL,
    });
    if (!cv) return void res.status(404).json({ thongBao: "Không tìm thấy công việc" });

    // Tính ngày trễ hiện tại
    const hanGoc = (cv as unknown as { ngayKetThucThucTe: Date | null }).ngayKetThucThucTe ?? cv.ngayKetThuc;
    const today = new Date();
    const soNgayTreHienTai = hanGoc && cv.trangThai !== "XONG"
      ? Math.max(0, Math.floor((today.getTime() - hanGoc.getTime()) / 86400000))
      : 0;

    const [upstream, downstream] = await Promise.all([
      layUpstream(id),
      layDownstream(id, soNgayTreHienTai),
    ]);

    res.json({
      congViec: cv,
      upstream,
      downstream,
      cotMocBiAnh: downstream.cotMocBiAnh,
      soNgayTreHienTai,
    });
  } catch (err) {
    console.error("Lỗi lấy dependency:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/cong-viec/:id/cap-nhat-timeline — Tính impact trước khi confirm

router.post("/:id/cap-nhat-timeline", yeuCauDangNhap, async (req, res) => {
  try {
    const { id } = req.params;
    const { ngayKetThucMoi, lyDo } = req.body as { ngayKetThucMoi: string; lyDo?: string };

    if (!ngayKetThucMoi) {
      return void res.status(400).json({ thongBao: "Thiếu ngayKetThucMoi" });
    }

    const ngayMoi = new Date(ngayKetThucMoi);
    const cv = await prisma.congViec.findUnique({
      where: { id },
      select: { id: true, ten: true, ngayKetThuc: true, ngayKetThucThucTe: true },
    });
    if (!cv) return void res.status(404).json({ thongBao: "Không tìm thấy công việc" });

    // Cập nhật ngayKetThucThucTe ngay
    await prisma.congViec.update({
      where: { id },
      data: { ngayKetThucThucTe: ngayMoi },
    });

    // Ghi nhật ký
    const user = (req as unknown as { nguoiDung?: { id: string } }).nguoiDung;
    if (user?.id) {
      await prisma.nhatKy.create({
        data: {
          bangDuLieu: "cong_viec",
          bghiId: id,
          hanhDong: "cap_nhat_timeline",
          nguoiThucHienId: user.id,
          congViecId: id,
          giaTriCu: { ngayKetThucThucTe: cv.ngayKetThucThucTe ?? cv.ngayKetThuc },
          giaTriMoi: { ngayKetThucThucTe: ngayMoi, lyDo },
        },
      });
    }

    // Tính impact
    const impact = await tinhImpactTimeline(id, ngayMoi);

    res.json({
      thongBao: "Đã cập nhật hạn mới",
      impact,
    });
  } catch (err) {
    console.error("Lỗi cập nhật timeline:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/cong-viec/:id/confirm-impact — Xác nhận + gửi Lark ──────────

router.post("/:id/confirm-impact", yeuCauDangNhap, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      danhSachAnh,
      guiThongBao = true,
    } = req.body as {
      danhSachAnh: { congViecId: string; ngayKTMoi: string | null; soNgayLui: number; ten: string }[];
      guiThongBao: boolean;
    };

    const cv = await prisma.congViec.findUnique({
      where: { id },
      select: {
        id: true, ten: true,
        ngayKetThucThucTe: true, ngayKetThuc: true,
        duAn: { select: { id: true, ten: true } },
        buocQuyTrinh: { select: { ten: true, ma: true } },
      },
    });
    if (!cv) return void res.status(404).json({ thongBao: "Không tìm thấy công việc" });

    const hanGoc = cv.ngayKetThucThucTe ?? cv.ngayKetThuc;
    const soNgayTre = danhSachAnh[0]?.soNgayLui ?? 0;

    // Batch cập nhật downstream
    await batChCapNhatDownstream(
      danhSachAnh.map((item) => ({
        congViecId: item.congViecId,
        ngayKTMoi: item.ngayKTMoi ? new Date(item.ngayKTMoi) : null,
      }))
    );

    // Tính lại impact để kiểm tra launch
    const impact = await tinhImpactTimeline(id, hanGoc ?? new Date());

    // Gửi Lark nếu yêu cầu
    if (guiThongBao) {
      for (const item of danhSachAnh) {
        const cvDs = await prisma.congViec.findUnique({
          where: { id: item.congViecId },
          select: {
            nguoiPhuTrach: { select: { larkUserId: true } },
            buocQuyTrinh: { select: { ten: true, ma: true } },
          },
        });
        await guiThongBaoTimeline({
          tenTaskNguon: cv.ten,
          soNgayTre,
          tenTaskBiAnh: item.ten,
          ngayKTGoc: item.ngayKTMoi ? new Date(new Date(item.ngayKTMoi).getTime() - item.soNgayLui * 86400000) : null,
          ngayKTMoi: item.ngayKTMoi ? new Date(item.ngayKTMoi) : null,
          tenBuoc: cvDs?.buocQuyTrinh ? `${cvDs.buocQuyTrinh.ma} ${cvDs.buocQuyTrinh.ten}` : "—",
          larkUserIdNguoiNhan: cvDs?.nguoiPhuTrach?.larkUserId,
          launchBiAnh: impact.launchBiAnh,
        });
      }
    }

    res.json({
      thongBao: `Đã cập nhật ${danhSachAnh.length} công việc downstream`,
      guiLark: guiThongBao,
      launchBiAnh: impact.launchBiAnh,
    });
  } catch (err) {
    console.error("Lỗi confirm impact:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/cong-viec/:id/them-phu-thuoc — Thêm quan hệ phụ thuộc ────────

router.post("/:id/them-phu-thuoc", yeuCauDangNhap, async (req, res) => {
  try {
    const { id } = req.params;
    const { phuThuocVaoId, loai = "FINISH_TO_START", soNgayBuffer = 0 } = req.body as {
      phuThuocVaoId: string; loai?: string; soNgayBuffer?: number;
    };
    if (!phuThuocVaoId) return void res.status(400).json({ thongBao: "Thiếu phuThuocVaoId" });

    const created = await prisma.phuThuocCongViec.create({
      data: {
        congViecId: id,
        phuThuocVaoId,
        loai: loai as "FINISH_TO_START" | "START_TO_START",
        soNgayBuffer,
      },
    });
    res.json(created);
  } catch (err: unknown) {
    const msg = (err as { code?: string }).code === "P2002"
      ? "Quan hệ phụ thuộc đã tồn tại"
      : "Lỗi máy chủ";
    res.status(msg.includes("Lỗi") ? 500 : 409).json({ thongBao: msg });
  }
});

// ─── DELETE /api/cong-viec/:id/xoa-phu-thuoc/:depId — Xóa phụ thuộc ─────────

router.delete("/:id/xoa-phu-thuoc/:depId", yeuCauDangNhap, async (req, res) => {
  try {
    await prisma.phuThuocCongViec.delete({ where: { id: req.params.depId } });
    res.json({ thongBao: "Đã xóa quan hệ phụ thuộc" });
  } catch (err) {
    console.error("Lỗi xóa phụ thuộc:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/cong-viec/:id/notify-downstream — Gửi Lark DM ngay ─────────

router.post("/:id/notify-downstream", yeuCauDangNhap, async (req, res) => {
  try {
    const { id } = req.params;
    const cv = await prisma.congViec.findUnique({
      where: { id },
      select: { id: true, ten: true, ngayKetThuc: true, ngayKetThucThucTe: true },
    });
    if (!cv) return void res.status(404).json({ thongBao: "Không tìm thấy công việc" });

    const hanGoc = cv.ngayKetThucThucTe ?? cv.ngayKetThuc;
    const soNgayTre = hanGoc
      ? Math.max(0, Math.floor((Date.now() - hanGoc.getTime()) / 86400000))
      : 0;

    const downstream = await layDownstream(id, soNgayTre);
    let soGuiThanhCong = 0;

    for (const ds of downstream.direct) {
      const cvDs = await prisma.congViec.findUnique({
        where: { id: ds.id },
        select: {
          nguoiPhuTrach: { select: { larkUserId: true } },
          buocQuyTrinh: { select: { ten: true, ma: true } },
          ngayKetThuc: true,
        },
      });
      if (cvDs?.nguoiPhuTrach?.larkUserId) {
        await guiThongBaoTimeline({
          tenTaskNguon: cv.ten,
          soNgayTre,
          tenTaskBiAnh: ds.ten,
          ngayKTGoc: cvDs.ngayKetThuc,
          ngayKTMoi: ds.ngayKTMoi,
          tenBuoc: cvDs.buocQuyTrinh ? `${cvDs.buocQuyTrinh.ma} ${cvDs.buocQuyTrinh.ten}` : "—",
          larkUserIdNguoiNhan: cvDs.nguoiPhuTrach.larkUserId,
          launchBiAnh: false,
        });
        soGuiThanhCong++;
      }
    }

    res.json({
      thongBao: `Đã gửi thông báo Lark cho ${soGuiThanhCong} người`,
      soNguoiNhan: soGuiThanhCong,
    });
  } catch (err) {
    console.error("Lỗi gửi thông báo downstream:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── PATCH /api/cong-viec/:id — Cập nhật nhiều field (có phân quyền) ─────────

router.patch("/:id", yeuCauDangNhap, quyenSuaCongViec, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const {
      ngayBatDau, ngayKetThuc, trangThai, ngayKetThucThucTe,
      ten, moTa, dinhNghiaHoanThanh, mucUuTien, ghiChu,
      nguoiPhuTrachId, nguoiPhoiId,
      nguoiPhoiHop, sanPhamIds,
    } = body as Record<string, string | string[] | undefined>;

    const data: Record<string, unknown> = {};
    if (ten                !== undefined) data.ten                = ten;
    if (moTa               !== undefined) data.moTa               = moTa;
    if (dinhNghiaHoanThanh !== undefined) data.dinhNghiaHoanThanh = dinhNghiaHoanThanh;
    if (ghiChu             !== undefined) data.ghiChu             = ghiChu;
    if (mucUuTien          !== undefined) data.mucUuTien          = mucUuTien;
    if (nguoiPhuTrachId    !== undefined) data.nguoiPhuTrachId    = nguoiPhuTrachId || null;
    if (nguoiPhoiId        !== undefined) data.nguoiPhoiId        = nguoiPhoiId || null;
    if (Array.isArray(nguoiPhoiHop))      data.nguoiPhoiHop       = nguoiPhoiHop;
    if (Array.isArray(sanPhamIds))         data.sanPhamIds         = sanPhamIds;
    if (ngayBatDau        !== undefined)  data.ngayBatDau         = ngayBatDau  ? new Date(ngayBatDau as string)  : null;
    if (ngayKetThuc       !== undefined)  data.ngayKetThuc        = ngayKetThuc ? new Date(ngayKetThuc as string) : null;
    if (ngayKetThucThucTe !== undefined)  data.ngayKetThucThucTe  = ngayKetThucThucTe ? new Date(ngayKetThucThucTe as string) : null;
    if (trangThai         !== undefined)  data.trangThai          = trangThai;

    const reqAny = req as unknown as { nguoiDungId?: string };
    const nguoiThucHienId = reqAny.nguoiDungId;

    const updated = await prisma.congViec.update({
      where: { id: req.params["id"] },
      data,
      select: {
        id: true, ten: true, trangThai: true,
        moTa: true, dinhNghiaHoanThanh: true, ghiChu: true, mucUuTien: true,
        nguoiPhoiHop: true, sanPhamIds: true,
        ngayBatDau: true, ngayKetThuc: true, ngayKetThucThucTe: true,
        duAnId: true,
        nguoiPhuTrach: { select: { id: true, ten: true } },
        buocQuyTrinh: { select: { id: true, ten: true, ma: true } },
        duAn: { select: { id: true, ten: true, ma: true } },
      },
    });

    // Ghi nhật ký trang thái nếu thay đổi
    if (trangThai && nguoiThucHienId) {
      await prisma.nhatKy.create({
        data: {
          bangDuLieu: "cong_viec",
          bghiId: updated.id,
          hanhDong: "doi_trang_thai",
          nguoiThucHienId,
          congViecId: updated.id,
          giaTriMoi: { trangThai },
        },
      }).catch(() => { /* ignore log errors */ });
    }

    // Tự động cập nhật tiến độ bước
    if (trangThai && updated.buocQuyTrinh?.id) {
      const buocId = updated.buocQuyTrinh.id;
      const allCv = await prisma.congViec.findMany({
        where: { buocQuyTrinhId: buocId, daXoa: false },
        select: { trangThai: true },
      });
      const soXong = allCv.filter(c => c.trangThai === "XONG").length;
      phatBuocTienDo(updated.duAnId, {
        buocId,
        soXong,
        soCongViec: allCv.length,
      });
    }

    phatCapNhatCongViec(updated.duAnId, updated);
    res.json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật công việc:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── DELETE /api/cong-viec/:id — Xóa mềm (soft delete) ──────────────────────

router.delete("/:id", yeuCauDangNhap, quyenXoaCongViec, async (req, res) => {
  try {
    const { id } = req.params;
    const { lyDoXoa } = req.body as { lyDoXoa?: string };
    const reqAny = req as unknown as { nguoiDungId?: string };
    const nguoiXoaId = reqAny.nguoiDungId;

    const cv = await prisma.congViec.findUnique({
      where: { id },
      select: {
        id: true, ten: true, daXoa: true, duAnId: true,
        buocQuyTrinhId: true,
        caCongViecPhuThuoc: { select: { congViecId: true } },
        phuThuocVao: { select: { phuThuocVaoId: true } },
      },
    });
    if (!cv) return void res.status(404).json({ thongBao: "Không tìm thấy công việc" });
    if (cv.daXoa) return void res.status(409).json({ thongBao: "Công việc đã bị xóa trước đó" });

    const soDownstream = cv.caCongViecPhuThuoc.length;

    const updated = await prisma.congViec.update({
      where: { id },
      data: {
        daXoa: true,
        ngayXoa: new Date(),
        nguoiXoaId: nguoiXoaId ?? null,
        lyDoXoa: lyDoXoa ?? null,
      },
      select: { id: true, ten: true, duAnId: true, buocQuyTrinhId: true },
    });

    // Xóa các liên kết dependency liên quan
    await prisma.phuThuocCongViec.deleteMany({
      where: { OR: [{ congViecId: id }, { phuThuocVaoId: id }] },
    });

    // Ghi nhật ký
    if (nguoiXoaId) {
      await prisma.nhatKy.create({
        data: {
          bangDuLieu: "cong_viec",
          bghiId: id,
          hanhDong: "xoa",
          nguoiThucHienId: nguoiXoaId,
          congViecId: id,
          giaTriMoi: { lyDoXoa, ngayXoa: new Date() },
        },
      }).catch(() => { /* ignore */ });
    }

    phatXoaCongViec(updated.duAnId, {
      id: updated.id,
      ten: updated.ten,
      buocQuyTrinhId: updated.buocQuyTrinhId,
    });

    res.json({ thongBao: "Đã xóa công việc", soDownstreamBiAnh: soDownstream });
  } catch (err) {
    console.error("Lỗi xóa công việc:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/cong-viec/:id/khoi-phuc — Khôi phục (chỉ quản trị viên) ──────

router.post("/:id/khoi-phuc", yeuCauDangNhap, quyenKhoiPhucCongViec, async (req, res) => {
  try {
    const { id } = req.params;

    const cv = await prisma.congViec.findUnique({
      where: { id },
      select: { id: true, daXoa: true, duAnId: true, ten: true },
    });
    if (!cv) return void res.status(404).json({ thongBao: "Không tìm thấy công việc" });
    if (!cv.daXoa) return void res.status(409).json({ thongBao: "Công việc chưa bị xóa" });

    const restored = await prisma.congViec.update({
      where: { id },
      data: { daXoa: false, ngayXoa: null, nguoiXoaId: null, lyDoXoa: null },
      select: {
        id: true, ten: true, trangThai: true, mucUuTien: true,
        ngayBatDau: true, ngayKetThuc: true, duAnId: true,
        buocQuyTrinh: { select: { id: true, ten: true, ma: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
      },
    });

    phatCongViecMoi(restored.duAnId, restored);
    res.json({ thongBao: "Đã khôi phục công việc", congViec: restored });
  } catch (err) {
    console.error("Lỗi khôi phục công việc:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
