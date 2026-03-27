/**
 * DependencyService — Tính toán upstream/downstream dependency và timeline impact
 * cho hệ thống FlowOS ATK.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Kiểu dữ liệu ────────────────────────────────────────────────────────────

export interface CongViecTomTat {
  id: string;
  ten: string;
  trangThai: string;
  ngayBatDau: Date | null;
  ngayKetThuc: Date | null;
  ngayKetThucThucTe: Date | null;
  soNgayTre: number;
  buocQuyTrinh: { id: string; ten: string; ma: string } | null;
  duAn: { id: string; ten: string; ma: string };
  nguoiPhuTrach: { id: string; ten: string; larkUserId?: string | null } | null;
  loaiPhuThuoc?: string;
  soNgayBuffer?: number;
}

export interface CongViecImpact extends CongViecTomTat {
  soNgayBiAnh: number;
  ngayKTMoi: Date | null;
}

export interface CotMocImpact {
  ten: string;
  ngayGoc: Date;
  ngayMoi: Date;
  soNgayLui: number;
}

export interface KetQuaUpstream {
  direct: CongViecTomTat[];
  indirect: CongViecTomTat[];
  trangThai: "day_du" | "chua_xong" | "tre";
}

export interface KetQuaDownstream {
  direct: CongViecImpact[];
  indirect: CongViecImpact[];
  cotMocBiAnh: CotMocImpact[];
}

export interface KetQuaImpact {
  danhSachAnh: { congViecId: string; ten: string; ngayKTGoc: Date | null; ngayKTMoi: Date | null; soNgayLui: number }[];
  cotMocBiAnh: CotMocImpact[];
  launchBiAnh: boolean;
  soNgayLuiLaunch: number;
}

// ─── Câu truy vấn chung ──────────────────────────────────────────────────────

const CV_SELECT = {
  id: true,
  ten: true,
  trangThai: true,
  ngayBatDau: true,
  ngayKetThuc: true,
  ngayKetThucThucTe: true,
  soNgayTre: true,
  buocQuyTrinh: { select: { id: true, ten: true, ma: true } },
  duAn: { select: { id: true, ten: true, ma: true } },
  nguoiPhuTrach: { select: { id: true, ten: true, larkUserId: true } },
} as const;

async function layCongViec(id: string): Promise<CongViecTomTat | null> {
  return prisma.congViec.findUnique({ where: { id }, select: CV_SELECT }) as Promise<CongViecTomTat | null>;
}

// ─── Đệ quy upstream ────────────────────────────────────────────────────────

async function deQuyChaUpstream(
  congViecId: string,
  visited = new Set<string>()
): Promise<CongViecTomTat[]> {
  if (visited.has(congViecId)) return [];
  visited.add(congViecId);

  const rels = await prisma.phuThuocCongViec.findMany({
    where: { congViecId },
    include: {
      phuThuocVao: { select: { ...CV_SELECT } },
    },
  });

  const result: CongViecTomTat[] = [];
  for (const rel of rels) {
    const cv = rel.phuThuocVao as CongViecTomTat;
    cv.loaiPhuThuoc = rel.loai;
    cv.soNgayBuffer = rel.soNgayBuffer;
    result.push(cv);
    const deeper = await deQuyChaUpstream(cv.id, visited);
    result.push(...deeper);
  }
  return result;
}

// ─── Đệ quy downstream ──────────────────────────────────────────────────────

async function deQuyConDownstream(
  congViecId: string,
  soNgayTreGoc: number,
  visited = new Set<string>()
): Promise<CongViecImpact[]> {
  if (visited.has(congViecId)) return [];
  visited.add(congViecId);

  const rels = await prisma.phuThuocCongViec.findMany({
    where: { phuThuocVaoId: congViecId },
    include: {
      congViec: { select: { ...CV_SELECT } },
    },
  });

  const result: CongViecImpact[] = [];
  for (const rel of rels) {
    const cv = rel.congViec as CongViecTomTat;
    const soNgayBiAnh = soNgayTreGoc + rel.soNgayBuffer;
    const ngayKTMoi = cv.ngayKetThuc
      ? new Date(cv.ngayKetThuc.getTime() + soNgayBiAnh * 86400000)
      : null;

    result.push({ ...cv, loaiPhuThuoc: rel.loai, soNgayBuffer: rel.soNgayBuffer, soNgayBiAnh, ngayKTMoi });
    const deeper = await deQuyConDownstream(cv.id, soNgayBiAnh, visited);
    result.push(...deeper);
  }
  return result;
}

// ─── Lấy cột mốc launch của dự án ──────────────────────────────────────────

async function layCotMocLaunch(duAnId: string): Promise<{ ten: string; ngay: Date }[]> {
  const buocs = await prisma.buoc.findMany({
    where: { duAnId, ngayKetThuc: { not: null } },
    orderBy: { ngayKetThuc: "asc" },
    select: { ten: true, ma: true, ngayKetThuc: true },
  });

  return buocs
    .filter((b) => b.ngayKetThuc !== null)
    .map((b) => ({ ten: `${b.ma} — ${b.ten}`, ngay: b.ngayKetThuc! }));
}

// ─── Tính trễ hiện tại ──────────────────────────────────────────────────────

function tinhSoNgayTreHienTai(cv: CongViecTomTat): number {
  const hanGoc = cv.ngayKetThucThucTe ?? cv.ngayKetThuc;
  if (!hanGoc) return 0;
  if (cv.trangThai === "XONG") return 0;
  const today = new Date();
  const diff = Math.floor((today.getTime() - hanGoc.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

// ─── API công khai ───────────────────────────────────────────────────────────

/**
 * Lấy tất cả upstream (phụ thuộc vào) của một công việc
 */
export async function layUpstream(congViecId: string): Promise<KetQuaUpstream> {
  const all = await deQuyChaUpstream(congViecId, new Set());

  const directRels = await prisma.phuThuocCongViec.findMany({
    where: { congViecId },
    select: { phuThuocVaoId: true },
  });
  const directIds = new Set(directRels.map((r) => r.phuThuocVaoId));

  const direct = all.filter((cv) => directIds.has(cv.id));
  const indirect = all.filter((cv) => !directIds.has(cv.id));

  let trangThai: "day_du" | "chua_xong" | "tre" = "day_du";
  for (const cv of all) {
    if (cv.trangThai !== "XONG") {
      const soNgayTre = tinhSoNgayTreHienTai(cv);
      if (soNgayTre > 0) {
        trangThai = "tre";
        break;
      } else {
        trangThai = "chua_xong";
      }
    }
  }

  return { direct, indirect, trangThai };
}

/**
 * Lấy tất cả downstream (bị ảnh hưởng bởi) của một công việc
 * và tính ngày bị lùi nếu task này trễ thêm N ngày
 */
export async function layDownstream(
  congViecId: string,
  soNgayTreHienTai?: number
): Promise<KetQuaDownstream> {
  const cv = await layCongViec(congViecId);
  if (!cv) return { direct: [], indirect: [], cotMocBiAnh: [] };

  const treGoc = soNgayTreHienTai ?? tinhSoNgayTreHienTai(cv);
  const all = await deQuyConDownstream(congViecId, treGoc, new Set());

  const directRels = await prisma.phuThuocCongViec.findMany({
    where: { phuThuocVaoId: congViecId },
    select: { congViecId: true },
  });
  const directIds = new Set(directRels.map((r) => r.congViecId));

  const direct = all.filter((c) => directIds.has(c.id));
  const indirect = all.filter((c) => !directIds.has(c.id));

  // Tính cột mốc bị ảnh hưởng
  const cotMocBiAnh: CotMocImpact[] = [];
  if (treGoc > 0 && cv.duAn) {
    const cotMocs = await layCotMocLaunch(cv.duAn.id);
    for (const cm of cotMocs) {
      cotMocBiAnh.push({
        ten: cm.ten,
        ngayGoc: cm.ngay,
        ngayMoi: new Date(cm.ngay.getTime() + treGoc * 86400000),
        soNgayLui: treGoc,
      });
    }
  }

  return { direct, indirect, cotMocBiAnh };
}

/**
 * Tính impact khi task bị lùi ngày kết thúc sang ngayKTMoi
 */
export async function tinhImpactTimeline(
  congViecId: string,
  ngayKTMoi: Date
): Promise<KetQuaImpact> {
  const cv = await layCongViec(congViecId);
  if (!cv) return { danhSachAnh: [], cotMocBiAnh: [], launchBiAnh: false, soNgayLuiLaunch: 0 };

  const ngayGoc = cv.ngayKetThucThucTe ?? cv.ngayKetThuc;
  const soNgayTre = ngayGoc
    ? Math.max(0, Math.floor((ngayKTMoi.getTime() - ngayGoc.getTime()) / 86400000))
    : 0;

  const allDownstream = await deQuyConDownstream(congViecId, soNgayTre, new Set());

  const danhSachAnh = allDownstream.map((ds) => ({
    congViecId: ds.id,
    ten: ds.ten,
    ngayKTGoc: ds.ngayKetThucThucTe ?? ds.ngayKetThuc,
    ngayKTMoi: ds.ngayKTMoi,
    soNgayLui: ds.soNgayBiAnh,
  }));

  const cotMocBiAnh: CotMocImpact[] = [];
  let launchBiAnh = false;
  let soNgayLuiLaunch = 0;

  if (cv.duAn && soNgayTre > 0) {
    const cotMocs = await layCotMocLaunch(cv.duAn.id);
    for (const cm of cotMocs) {
      const ngayMoi = new Date(cm.ngay.getTime() + soNgayTre * 86400000);
      const soNgayLui = soNgayTre;
      cotMocBiAnh.push({ ten: cm.ten, ngayGoc: cm.ngay, ngayMoi, soNgayLui });
      if (cm.ten.toLowerCase().includes("launch") || cm.ten.toLowerCase().includes("ra mắt")) {
        launchBiAnh = true;
        soNgayLuiLaunch = Math.max(soNgayLuiLaunch, soNgayLui);
      }
    }
  }

  return { danhSachAnh, cotMocBiAnh, launchBiAnh, soNgayLuiLaunch };
}

/**
 * Batch cập nhật ngayKetThucThucTe cho danh sách công việc downstream
 */
export async function batChCapNhatDownstream(
  danhSachAnh: { congViecId: string; ngayKTMoi: Date | null }[]
): Promise<void> {
  await Promise.all(
    danhSachAnh
      .filter((item) => item.ngayKTMoi !== null)
      .map((item) =>
        prisma.congViec.update({
          where: { id: item.congViecId },
          data: { ngayKetThucThucTe: item.ngayKTMoi! },
        })
      )
  );
}
