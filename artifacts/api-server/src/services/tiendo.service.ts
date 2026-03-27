/**
 * TiendoService — Tính tiến độ realtime từ DB
 * Không đọc % từ Excel. Toàn bộ tính từ trạng thái Buoc.
 *
 * Quy ước mã bước ATK:
 *   RD*    → R&D
 *   NAP*   → Nắp (tổng cố định 13 bước)
 *   BBC*   → Bao bì chai
 *   BBNH*  → Bao bì nhãn
 *   PCSPB* → Pháp chế (tổng cố định 7)
 *   SXCN*  → Sản xuất công nghiệp (tổng cố định 6)
 */
import { PrismaClient, TrangThaiBuoc, MucDoCanTro, TrangThaiCanTro } from "@prisma/client";

const prisma = new PrismaClient();
const DAY_MS = 86_400_000;

// ─── Return types ──────────────────────────────────────────────────────────────

export interface TiendoCoBan {
  phanTram: number;
  buocXong: number;
  tongBuoc: number;
}
export interface TiendoRD extends TiendoCoBan {
  buocHienTai: string | null;
}
export interface TiendoNap {
  phanTram: number;
  buocHienTai: string | null;
  tongBuoc: 13;
}
export interface TiendoBaoBi extends TiendoCoBan {
  chiTiet: { chai: TiendoCoBan; nhan: TiendoCoBan };
}

export interface ChiTietTiendoSanPham {
  rd:      TiendoRD;
  nap:     TiendoNap;
  baoBi:   TiendoBaoBi;
  phapChe: TiendoCoBan;
  sxcn:    TiendoCoBan;
}

export interface TiendoSanPhamDayDu {
  sanPhamId:   string;
  maSp:        string;
  ten:         string;
  kenh:        string;
  tongTienDo:  number;
  trangThaiTong: string;
  conNgay:     number | null;
  chiTiet:     ChiTietTiendoSanPham;
  canTroHienTai: Array<{
    id: string; ten: string; mucDo: string; trangThai: string; ngayPhatSinh: Date;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Trích số thứ tự từ mã bước: "NAP3B" → 3, "SXCN12" → 12 */
function soThuTu(ma: string, prefix: string): number {
  const s = ma.replace(new RegExp(`^${prefix}`, "i"), "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

// ─── Lấy duAnId của sản phẩm ─────────────────────────────────────────────────

async function getDuAnId(sanPhamId: string): Promise<string | null> {
  const sp = await prisma.sanPham.findUnique({
    where: { id: sanPhamId },
    select: { duAnId: true },
  });
  return sp?.duAnId ?? null;
}

// ─── 1. Tiến độ R&D ──────────────────────────────────────────────────────────

export async function tinhTiendoRD(sanPhamId: string): Promise<TiendoRD> {
  const duAnId = await getDuAnId(sanPhamId);
  if (!duAnId) return { phanTram: 0, buocXong: 0, tongBuoc: 0, buocHienTai: null };

  const buocs = await prisma.buoc.findMany({
    where: {
      duAnId,
      ma: { startsWith: "RD", mode: "insensitive" },
    },
    select: { id: true, ma: true, ten: true, trangThai: true },
    orderBy: { ma: "asc" },
  });

  if (buocs.length === 0) return { phanTram: 0, buocXong: 0, tongBuoc: 0, buocHienTai: null };

  const buocXong = buocs.filter((b) => b.trangThai === TrangThaiBuoc.XONG).length;
  const tongBuoc = buocs.length;
  const phanTram = round1((buocXong / tongBuoc) * 100);

  // Bước hiện tại = bước đang làm hoặc bước xong cuối
  const buocDangLam = buocs.find((b) => b.trangThai === TrangThaiBuoc.DANG_LAM);
  const buocHienTai =
    buocDangLam?.ten ??
    (buocXong > 0 ? buocs.filter((b) => b.trangThai === TrangThaiBuoc.XONG).at(-1)?.ten ?? null : null);

  return { phanTram, buocXong, tongBuoc, buocHienTai };
}

// ─── 2. Tiến độ Nắp ─────────────────────────────────────────────────────────

export async function tinhTiendoNap(sanPhamId: string): Promise<TiendoNap> {
  const TONG_BUOC_NAP = 13;
  const duAnId = await getDuAnId(sanPhamId);
  if (!duAnId) return { phanTram: 0, buocHienTai: null, tongBuoc: TONG_BUOC_NAP };

  const buocs = await prisma.buoc.findMany({
    where: {
      duAnId,
      ma: { startsWith: "NAP", mode: "insensitive" },
    },
    select: { ma: true, ten: true, trangThai: true },
  });

  if (buocs.length === 0) return { phanTram: 0, buocHienTai: null, tongBuoc: TONG_BUOC_NAP };

  // Sắp theo số thứ tự (NAP1 → 1, NAP2 → 2, NAP13 → 13)
  const sorted = buocs
    .map((b) => ({ ...b, stt: soThuTu(b.ma, "NAP") }))
    .sort((a, b) => a.stt - b.stt);

  // Bước hiện tại = bước có STT cao nhất đang XONG hoặc DANG_LAM
  const tienHanh = sorted.filter(
    (b) => b.trangThai === TrangThaiBuoc.XONG || b.trangThai === TrangThaiBuoc.DANG_LAM
  );

  if (tienHanh.length === 0) {
    return { phanTram: 0, buocHienTai: null, tongBuoc: TONG_BUOC_NAP };
  }

  const buocHienTaiObj = tienHanh.at(-1)!;
  const phanTram = round1((buocHienTaiObj.stt / TONG_BUOC_NAP) * 100);

  return {
    phanTram: Math.min(phanTram, 100),
    buocHienTai: buocHienTaiObj.ten,
    tongBuoc: TONG_BUOC_NAP,
  };
}

// ─── 3. Tiến độ Bao bì ──────────────────────────────────────────────────────

export async function tinhTiendoBaoBi(sanPhamId: string): Promise<TiendoBaoBi> {
  const duAnId = await getDuAnId(sanPhamId);
  const empty: TiendoCoBan = { phanTram: 0, buocXong: 0, tongBuoc: 0 };
  if (!duAnId) return { phanTram: 0, buocXong: 0, tongBuoc: 0, chiTiet: { chai: empty, nhan: empty } };

  const [chai, nhan] = await Promise.all([
    prisma.buoc.findMany({
      where: { duAnId, ma: { startsWith: "BBC", mode: "insensitive" } },
      select: { trangThai: true },
    }),
    prisma.buoc.findMany({
      where: { duAnId, ma: { startsWith: "BBNH", mode: "insensitive" } },
      select: { trangThai: true },
    }),
  ]);

  const calcBaoBi = (buocs: Array<{ trangThai: TrangThaiBuoc }>): TiendoCoBan => {
    if (buocs.length === 0) return { phanTram: 0, buocXong: 0, tongBuoc: 0 };
    const xong = buocs.filter((b) => b.trangThai === TrangThaiBuoc.XONG).length;
    return { phanTram: round1((xong / buocs.length) * 100), buocXong: xong, tongBuoc: buocs.length };
  };

  const chiaiResult = calcBaoBi(chai);
  const nhanResult  = calcBaoBi(nhan);

  const tongBuoc = chiaiResult.tongBuoc + nhanResult.tongBuoc;
  const buocXong = chiaiResult.buocXong + nhanResult.buocXong;
  const phanTram = tongBuoc > 0 ? round1((buocXong / tongBuoc) * 100) : 0;

  return {
    phanTram,
    buocXong,
    tongBuoc,
    chiTiet: { chai: chiaiResult, nhan: nhanResult },
  };
}

// ─── 4. Tiến độ Pháp chế ────────────────────────────────────────────────────

export async function tinhTiendoPhapChe(sanPhamId: string): Promise<TiendoCoBan> {
  const TONG_BUOC = 7;
  const duAnId = await getDuAnId(sanPhamId);
  if (!duAnId) return { phanTram: 0, buocXong: 0, tongBuoc: TONG_BUOC };

  const buocs = await prisma.buoc.findMany({
    where: { duAnId, ma: { startsWith: "PCSPB", mode: "insensitive" } },
    select: { trangThai: true },
  });

  const buocXong = buocs.filter((b) => b.trangThai === TrangThaiBuoc.XONG).length;
  const tongBuoc = Math.max(buocs.length, TONG_BUOC); // không nhỏ hơn 7
  return { phanTram: round1((buocXong / tongBuoc) * 100), buocXong, tongBuoc };
}

// ─── 5. Tiến độ Sản xuất công nghiệp ────────────────────────────────────────

export async function tinhTiendoSXCN(sanPhamId: string): Promise<TiendoCoBan> {
  const TONG_BUOC = 6;
  const duAnId = await getDuAnId(sanPhamId);
  if (!duAnId) return { phanTram: 0, buocXong: 0, tongBuoc: TONG_BUOC };

  const buocs = await prisma.buoc.findMany({
    where: { duAnId, ma: { startsWith: "SXCN", mode: "insensitive" } },
    select: { trangThai: true },
  });

  const buocXong = buocs.filter((b) => b.trangThai === TrangThaiBuoc.XONG).length;
  const tongBuoc = Math.max(buocs.length, TONG_BUOC);
  return { phanTram: round1((buocXong / tongBuoc) * 100), buocXong, tongBuoc };
}

// ─── 6. Tổng tiến độ có trọng số ────────────────────────────────────────────

export function tinhTongTienDo(chiTiet: ChiTietTiendoSanPham): number {
  const { rd, nap, baoBi, phapChe, sxcn } = chiTiet;
  const tongPhanTram =
    rd.phanTram      * 0.30 +
    nap.phanTram     * 0.25 +
    baoBi.phanTram   * 0.20 +
    phapChe.phanTram * 0.15 +
    sxcn.phanTram    * 0.10;
  return round1(tongPhanTram);
}

// ─── 7. Tình trạng tổng (theo ưu tiên) ───────────────────────────────────────

export async function tinhTrangThaiTong(
  sanPhamId: string,
  ngayLaunch: Date | null,
  chiTiet: ChiTietTiendoSanPham
): Promise<string> {
  const duAnId = await getDuAnId(sanPhamId);

  // Ưu tiên 1: Bước BI_CHAN + cản trở RAT_NGHIEM_TRONG
  if (duAnId) {
    const canTroNghiemTrong = await prisma.canTro.count({
      where: {
        duAnId,
        mucDo: MucDoCanTro.RAT_NGHIEM_TRONG,
        trangThai: { not: TrangThaiCanTro.DA_GIAI_QUYET },
        buocBiChan: { trangThai: TrangThaiBuoc.BI_CHAN },
      },
    });
    if (canTroNghiemTrong > 0) return "🔴 Bị cản trở";
  }

  // Ưu tiên 2: Còn < 30 ngày đến launch mà bất kỳ % < 30%
  if (ngayLaunch) {
    const conNgay = Math.ceil((ngayLaunch.getTime() - Date.now()) / DAY_MS);
    if (conNgay > 0 && conNgay < 30) {
      const { rd, nap, baoBi, phapChe, sxcn } = chiTiet;
      const min = Math.min(rd.phanTram, nap.phanTram, baoBi.phanTram, phapChe.phanTram, sxcn.phanTram);
      if (min < 30) return "🔴 Nguy hiểm";
    }
  }

  // Ưu tiên 3: Bất kỳ % < 50%
  const { rd, nap, baoBi, phapChe, sxcn } = chiTiet;
  const allPcts = [rd.phanTram, nap.phanTram, baoBi.phanTram, phapChe.phanTram, sxcn.phanTram];
  if (allPcts.some((p) => p < 50)) return "🟡 Rủi ro";

  // Ưu tiên 4: Tất cả > 80%
  if (allPcts.every((p) => p > 80)) return "🟢 Chạy mượt";

  return "🟢 Chạy mượt";
}

// ─── Hàm tổng hợp đầy đủ ────────────────────────────────────────────────────

export async function tinhTiendoSanPham(sanPhamId: string): Promise<TiendoSanPhamDayDu | null> {
  const sp = await prisma.sanPham.findUnique({
    where: { id: sanPhamId },
    select: {
      id: true, maSp: true, ten: true, kenh: true,
      ngayLaunch: true, duAnId: true,
    },
  });
  if (!sp) return null;

  // Tính song song tất cả các nhóm
  const [rd, nap, baoBi, phapChe, sxcn] = await Promise.all([
    tinhTiendoRD(sanPhamId),
    tinhTiendoNap(sanPhamId),
    tinhTiendoBaoBi(sanPhamId),
    tinhTiendoPhapChe(sanPhamId),
    tinhTiendoSXCN(sanPhamId),
  ]);

  const chiTiet: ChiTietTiendoSanPham = { rd, nap, baoBi, phapChe, sxcn };
  const tongTienDo = tinhTongTienDo(chiTiet);
  const trangThaiTong = await tinhTrangThaiTong(sanPhamId, sp.ngayLaunch, chiTiet);

  const conNgay = sp.ngayLaunch
    ? Math.ceil((sp.ngayLaunch.getTime() - Date.now()) / DAY_MS)
    : null;

  // Cản trở hiện tại (đang mở)
  const canTroHienTai = await prisma.canTro.findMany({
    where: {
      duAnId: sp.duAnId,
      trangThai: { not: TrangThaiCanTro.DA_GIAI_QUYET },
    },
    select: {
      id: true, ten: true,
      mucDo: true, trangThai: true, ngayPhatSinh: true,
    },
    orderBy: [{ mucDo: "asc" }, { ngayPhatSinh: "desc" }],
    take: 10,
  });

  return {
    sanPhamId: sp.id,
    maSp: sp.maSp,
    ten: sp.ten,
    kenh: sp.kenh,
    tongTienDo,
    trangThaiTong,
    conNgay,
    chiTiet,
    canTroHienTai,
  };
}

// ─── Hàm tính nhanh (chỉ % tổng + trạng thái) dùng cho list ─────────────────

export interface TiendoNhanh {
  sanPhamId: string;
  tongTienDo: number;
  trangThaiTong: string;
  conNgay: number | null;
}

export async function tinhTiendoNhanh(sanPhamId: string, ngayLaunch: Date | null): Promise<TiendoNhanh> {
  const [rd, nap, baoBi, phapChe, sxcn] = await Promise.all([
    tinhTiendoRD(sanPhamId),
    tinhTiendoNap(sanPhamId),
    tinhTiendoBaoBi(sanPhamId),
    tinhTiendoPhapChe(sanPhamId),
    tinhTiendoSXCN(sanPhamId),
  ]);
  const chiTiet: ChiTietTiendoSanPham = { rd, nap, baoBi, phapChe, sxcn };
  const tongTienDo = tinhTongTienDo(chiTiet);
  const trangThaiTong = await tinhTrangThaiTong(sanPhamId, ngayLaunch, chiTiet);
  const conNgay = ngayLaunch
    ? Math.ceil((ngayLaunch.getTime() - Date.now()) / DAY_MS)
    : null;
  return { sanPhamId, tongTienDo, trangThaiTong, conNgay };
}
