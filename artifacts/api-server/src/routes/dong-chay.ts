/**
 * Route: /api/dong-chay
 * Trả về toàn bộ dữ liệu cho màn hình Dòng chảy dự án (Gantt swimlane)
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { yeuCauDangNhap } from "../middleware/xac-thuc.js";

const router = Router();
const prisma = new PrismaClient();

const DAY_MS = 86_400_000;

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

// Gán ngày ước tính cho các bước chưa có ngày (sequential per DA)
function ganNgayUocTinh(
  buocs: { id: string; duAnId: string; ngayBatDau: Date | null; ngayKetThuc: Date | null; soNgayDuKien: number | null }[]
): Map<string, { start: Date; end: Date }> {
  const result = new Map<string, { start: Date; end: Date }>();
  const byDA = new Map<string, typeof buocs>();

  for (const b of buocs) {
    const list = byDA.get(b.duAnId) ?? [];
    list.push(b);
    byDA.set(b.duAnId, list);
  }

  const projectStart = new Date();
  projectStart.setDate(projectStart.getDate() - 14);

  byDA.forEach((list) => {
    let cursor = new Date(projectStart);
    for (const b of list) {
      const days = b.soNgayDuKien ?? 7;
      const start = b.ngayBatDau ? new Date(b.ngayBatDau) : cursor;
      const end   = b.ngayKetThuc ? new Date(b.ngayKetThuc) : addDays(start, days);
      result.set(b.id, { start, end });
      cursor = addDays(end, 2);
    }
  });

  return result;
}

// Tìm critical path đơn giản: DFS từ node cuối, đánh dấu các cạnh trên đường dài nhất
function timCriticalPath(
  buocIds: string[],
  phuThuoc: { buocId: string; phuThuocVaoId: string }[],
  ngayMap: Map<string, { start: Date; end: Date }>
): Set<string> {
  // duration of each node
  const duration = new Map<string, number>();
  for (const id of buocIds) {
    const d = ngayMap.get(id);
    if (d) {
      duration.set(id, Math.max(1, Math.round((d.end.getTime() - d.start.getTime()) / DAY_MS)));
    } else {
      duration.set(id, 7);
    }
  }

  // successors
  const succs = new Map<string, string[]>();
  for (const id of buocIds) succs.set(id, []);
  for (const pt of phuThuoc) {
    // buocId depends on phuThuocVaoId → phuThuocVaoId → buocId
    const list = succs.get(pt.phuThuocVaoId) ?? [];
    list.push(pt.buocId);
    succs.set(pt.phuThuocVaoId, list);
  }

  // longest path from each node
  const memo = new Map<string, number>();
  function dp(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const s = succs.get(id) ?? [];
    const maxSucc = s.length ? Math.max(...s.map(dp)) : 0;
    const val = (duration.get(id) ?? 7) + maxSucc;
    memo.set(id, val);
    return val;
  }
  for (const id of buocIds) dp(id);

  const criticalEdges = new Set<string>();
  for (const pt of phuThuoc) {
    const pred = pt.phuThuocVaoId;
    const succ = pt.buocId;
    const predVal = dp(pred);
    const succVal = dp(succ);
    if (predVal === (duration.get(pred) ?? 7) + succVal) {
      criticalEdges.add(`${pred}→${succ}`);
    }
  }
  return criticalEdges;
}

router.get("/", yeuCauDangNhap, async (req, res) => {
  try {
    const { duAnId, trangThai, kenh, sanPhamId } = req.query as Record<string, string>;

    // Nếu lọc theo kênh hoặc sản phẩm → tìm danh sách duAnId liên quan
    let duAnIdSet: Set<string> | null = null;
    if (kenh || sanPhamId) {
      const whereSP: Record<string, unknown> = {};
      if (kenh)      whereSP.kenh = kenh;
      if (sanPhamId) whereSP.id   = sanPhamId;
      const sanPhams = await prisma.sanPham.findMany({
        where: whereSP,
        select: { duAnId: true },
      });
      duAnIdSet = new Set(sanPhams.map((sp) => sp.duAnId));
    }

    // 1. DuAn
    const whereDA: Record<string, unknown> = {};
    if (duAnId)         whereDA.id = duAnId;
    if (duAnIdSet)      whereDA.id = { in: Array.from(duAnIdSet) };

    const duAns = await prisma.duAn.findMany({
      where: whereDA,
      select: {
        id: true,
        ma: true,
        ten: true,
        trangThai: true,
        truongNhom: { select: { id: true, ten: true } },
      },
      orderBy: { ma: "asc" },
    });

    // 2. Buoc
    const whereBuoc: Record<string, unknown> = {};
    if (duAnId)    whereBuoc.duAnId    = duAnId;
    if (duAnIdSet) whereBuoc.duAnId    = { in: Array.from(duAnIdSet) };
    if (trangThai) whereBuoc.trangThai = trangThai;

    const buocsRaw = await prisma.buoc.findMany({
      where: whereBuoc,
      select: {
        id: true,
        ma: true,
        ten: true,
        diaDiemHoanThanh: true,
        soNgayDuKien: true,
        duAnId: true,
        ngayBatDau: true,
        ngayKetThuc: true,
        trangThai: true,
        ghiChu: true,
        nguoiPhuTrach: { select: { id: true, ten: true, email: true, mauAvatar: true } },
        _count: { select: { congViec: true, canTro: { where: { trangThai: { not: "DA_GIAI_QUYET" } } } } },
      },
      orderBy: [{ duAnId: "asc" }, { ngayBatDau: "asc" }, { taoLuc: "asc" }],
    });

    // 3. Phụ thuộc
    const phuThuoc = await prisma.phuThuocBuoc.findMany({
      select: {
        id: true,
        buocId: true,
        phuThuocVaoId: true,
        loai: true,
        soNgayTre: true,
      },
    });

    // 4. Cột mốc từ SanPham + danh sách sản phẩm cho filter
    const sanPhamAll = await prisma.sanPham.findMany({
      select: {
        id: true, ten: true, maSp: true,
        kenh: true, ngayLaunch: true, duAnId: true,
      },
    });

    const cotMoc = sanPhamAll
      .filter((sp) => sp.ngayLaunch)
      .map((sp) => ({
        id: sp.id,
        ten: sp.ten,
        ma: sp.maSp ?? "",
        ngay: sp.ngayLaunch!.toISOString(),
        loai: "LAUNCH" as const,
        duAnId: sp.duAnId ?? null,
      }));

    const sanPhamList = sanPhamAll.map((sp) => ({
      id: sp.id, ten: sp.ten, maSp: sp.maSp, kenh: sp.kenh, duAnId: sp.duAnId,
    }));

    // 4b. Đếm công việc đã xong theo bước
    const xongGroups = await prisma.congViec.groupBy({
      by: ["buocQuyTrinhId"],
      where: {
        trangThai: "XONG",
        buocQuyTrinhId: { in: buocsRaw.map((b) => b.id) },
      },
      _count: { id: true },
    });
    const xongMap = new Map(xongGroups.map((g) => [g.buocQuyTrinhId, g._count.id]));

    // 5. Tính ngày ước tính cho buoc chưa có ngày
    const ngayMap = ganNgayUocTinh(buocsRaw);

    // 6. Critical path
    const criticalEdges = timCriticalPath(
      buocsRaw.map((b) => b.id),
      phuThuoc,
      ngayMap
    );

    // 7. Build response
    const buocs = buocsRaw.map((b) => {
      const uocTinh = ngayMap.get(b.id);
      return {
        id: b.id,
        ma: b.ma,
        ten: b.ten,
        diaDiemHoanThanh: b.diaDiemHoanThanh,
        soNgayDuKien: b.soNgayDuKien ?? 7,
        duAnId: b.duAnId,
        ngayBatDau: b.ngayBatDau?.toISOString() ?? uocTinh?.start.toISOString() ?? null,
        ngayKetThuc: b.ngayKetThuc?.toISOString() ?? uocTinh?.end.toISOString() ?? null,
        laUocTinh: !b.ngayBatDau,
        trangThai: b.trangThai,
        ghiChu: b.ghiChu,
        nguoiPhuTrach: b.nguoiPhuTrach,
        soCanTro: b._count.canTro,
        soCongViec: b._count.congViec,
        soXong: xongMap.get(b.id) ?? 0,
      };
    });

    const phuThuocOutput = phuThuoc.map((pt) => ({
      ...pt,
      laCritical: criticalEdges.has(`${pt.phuThuocVaoId}→${pt.buocId}`),
    }));

    res.json({ duAn: duAns, buoc: buocs, phuThuoc: phuThuocOutput, cotMoc, sanPham: sanPhamList });
  } catch (err) {
    console.error("Lỗi dong-chay:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// Route lấy chi tiết bước (công việc + phụ thuộc)
router.get("/buoc/:id", yeuCauDangNhap, async (req, res) => {
  try {
    const buoc = await prisma.buoc.findUnique({
      where: { id: req.params.id },
      include: {
        duAn: { select: { id: true, ma: true, ten: true } },
        nguoiPhuTrach: { select: { id: true, ten: true, email: true } },
        congViec: {
          select: {
            id: true,
            ten: true,
            trangThai: true,
            ngayBatDau: true,
            ngayKetThuc: true,
            nguoiPhuTrach: { select: { id: true, ten: true } },
            phuThuocVao: {
              include: {
                phuThuocVao: {
                  select: {
                    id: true, ten: true, trangThai: true,
                    ngayBatDau: true, ngayKetThuc: true,
                    buocQuyTrinhId: true,
                    buocQuyTrinh: {
                      select: {
                        id: true, ma: true, ten: true, duAnId: true,
                        duAn: { select: { id: true, ma: true, ten: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { ngayBatDau: "asc" },
        },
        canTro: {
          where: { trangThai: { not: "DA_GIAI_QUYET" } },
          select: { id: true, ten: true, mucDo: true, trangThai: true },
        },
        phuThuocVao: {
          include: { phuThuocVao: { select: { id: true, ma: true, ten: true, trangThai: true } } },
        },
        cacBuocPhuThuoc: {
          include: { buoc: { select: { id: true, ma: true, ten: true, trangThai: true } } },
        },
      },
    });

    if (!buoc) { res.status(404).json({ thongBao: "Không tìm thấy bước" }); return; }
    res.json(buoc);
  } catch (err) {
    console.error("Lỗi chi tiết bước:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
