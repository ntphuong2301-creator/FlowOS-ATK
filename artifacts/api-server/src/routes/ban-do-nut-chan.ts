/**
 * Route: /api/ban-do-nut-chan
 * Thuật toán CPM → trả về các nút chặn trên critical path
 */
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { yeuCauDangNhap } from "../middleware/xac-thuc.js";

const router = Router();
const prisma = new PrismaClient();
const DAY_MS = 86_400_000;

interface BuocCPM {
  id: string; ma: string; ten: string;
  duAnId: string; duAnMa: string; duAnTen: string;
  trangThai: string;
  nguoiPhuTrachId: string | null; nguoiPhuTrachTen: string | null;
  ngayBatDau: Date | null; ngayKetThuc: Date | null;
  soNgayDuKien: number;
  soCanTro: number;
  canTro: Array<{ id: string; ten: string; mucDo: string }>;
  // CPM computed fields
  ES: number; EF: number; LS: number; LF: number; float: number;
  laCritical: boolean; laNutChan: boolean;
}

function runCPM(
  buocs: Array<{
    id: string; ngayBatDau: Date | null; ngayKetThuc: Date | null; soNgayDuKien: number;
  }>,
  phuThuoc: Array<{ buocId: string; phuThuocVaoId: string }>,
  projectStart: Date
): Map<string, { ES: number; EF: number; LS: number; LF: number; float: number }> {

  const dur = new Map<string, number>();
  const fixedStart = new Map<string, number>();
  const fixedEnd   = new Map<string, number>();
  const ps = projectStart.getTime();

  for (const b of buocs) {
    const d = Math.max(1, b.soNgayDuKien);
    dur.set(b.id, d);
    if (b.ngayBatDau) fixedStart.set(b.id, Math.round((b.ngayBatDau.getTime() - ps) / DAY_MS));
    if (b.ngayKetThuc) fixedEnd.set(b.id, Math.round((b.ngayKetThuc.getTime() - ps) / DAY_MS));
  }

  // Adjacency lists
  const succs  = new Map<string, string[]>(); // id → list of ids that depend on it
  const preds  = new Map<string, string[]>(); // id → list of ids it depends on

  for (const b of buocs) { succs.set(b.id, []); preds.set(b.id, []); }
  for (const pt of phuThuoc) {
    succs.get(pt.phuThuocVaoId)?.push(pt.buocId);
    preds.get(pt.buocId)?.push(pt.phuThuocVaoId);
  }

  // Forward pass (ES, EF)
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();

  const topo = topologicalSort(buocs.map(b => b.id), phuThuoc);
  for (const id of topo) {
    const d   = dur.get(id) ?? 7;
    const ps_ = preds.get(id) ?? [];
    let es = fixedStart.get(id) ?? 0;
    if (ps_.length > 0 && !fixedStart.has(id)) {
      es = Math.max(...ps_.map((p) => EF.get(p) ?? 0));
    }
    const ef = fixedEnd.has(id) ? fixedEnd.get(id)! : es + d;
    ES.set(id, es);
    EF.set(id, ef);
  }

  // Backward pass (LF, LS)
  const LF = new Map<string, number>();
  const LS = new Map<string, number>();
  const projectEnd = Math.max(...Array.from(EF.values()));

  for (const id of [...topo].reverse()) {
    const d   = dur.get(id) ?? 7;
    const ss_ = succs.get(id) ?? [];
    let lf = fixedEnd.get(id) ?? projectEnd;
    if (ss_.length > 0 && !fixedEnd.has(id)) {
      lf = Math.min(...ss_.map((s) => LS.get(s) ?? projectEnd));
    }
    const ls = lf - d;
    LF.set(id, lf);
    LS.set(id, ls);
  }

  const result = new Map<string, { ES: number; EF: number; LS: number; LF: number; float: number }>();
  for (const b of buocs) {
    const es = ES.get(b.id) ?? 0;
    const ef = EF.get(b.id) ?? 0;
    const ls = LS.get(b.id) ?? 0;
    const lf = LF.get(b.id) ?? 0;
    result.set(b.id, { ES: es, EF: ef, LS: ls, LF: lf, float: ls - es });
  }
  return result;
}

function topologicalSort(ids: string[], phuThuoc: Array<{ buocId: string; phuThuocVaoId: string }>): string[] {
  const inDeg = new Map<string, number>(ids.map(id => [id, 0]));
  const adj   = new Map<string, string[]>(ids.map(id => [id, []]));
  for (const pt of phuThuoc) {
    adj.get(pt.phuThuocVaoId)?.push(pt.buocId);
    inDeg.set(pt.buocId, (inDeg.get(pt.buocId) ?? 0) + 1);
  }
  const queue = ids.filter(id => (inDeg.get(id) ?? 0) === 0);
  const result: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    result.push(cur);
    for (const nxt of (adj.get(cur) ?? [])) {
      const nd = (inDeg.get(nxt) ?? 0) - 1;
      inDeg.set(nxt, nd);
      if (nd === 0) queue.push(nxt);
    }
  }
  return result;
}

router.get("/", yeuCauDangNhap, async (req, res) => {
  try {
    const now = new Date();
    const projectStart = new Date(now.getTime() - 90 * DAY_MS);

    const buocsRaw = await prisma.buoc.findMany({
      include: {
        duAn: { select: { id: true, ma: true, ten: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
        canTro: {
          where: { trangThai: { not: "DA_GIAI_QUYET" } },
          select: { id: true, ten: true, mucDo: true },
        },
        _count: { select: { canTro: { where: { trangThai: { not: "DA_GIAI_QUYET" } } } } },
      },
    });

    const phuThuoc = await prisma.phuThuocBuoc.findMany({
      select: { buocId: true, phuThuocVaoId: true },
    });

    const cotMoc = await prisma.sanPham.findMany({
      where: { ngayLaunch: { not: null } },
      select: { id: true, maSp: true, ten: true, ngayLaunch: true, duAnId: true },
    });

    // Run CPM
    const cpmResult = runCPM(
      buocsRaw.map(b => ({
        id: b.id,
        ngayBatDau: b.ngayBatDau,
        ngayKetThuc: b.ngayKetThuc,
        soNgayDuKien: b.soNgayDuKien ?? 7,
      })),
      phuThuoc,
      projectStart
    );

    // Build response
    const buocs: BuocCPM[] = buocsRaw.map((b) => {
      const cpm = cpmResult.get(b.id) ?? { ES: 0, EF: 0, LS: 0, LF: 0, float: 99 };
      const tre = b.ngayKetThuc && now > b.ngayKetThuc && b.trangThai !== "XONG";
      const laNutChan = cpm.float <= 0 && (b.trangThai === "BI_CHAN" || !!tre);
      return {
        id: b.id, ma: b.ma, ten: b.ten,
        duAnId: b.duAn.id, duAnMa: b.duAn.ma, duAnTen: b.duAn.ten,
        trangThai: b.trangThai,
        nguoiPhuTrachId: b.nguoiPhuTrach?.id ?? null,
        nguoiPhuTrachTen: b.nguoiPhuTrach?.ten ?? null,
        ngayBatDau: b.ngayBatDau,
        ngayKetThuc: b.ngayKetThuc,
        soNgayDuKien: b.soNgayDuKien ?? 7,
        soCanTro: b._count.canTro,
        canTro: b.canTro,
        ...cpm,
        laCritical: cpm.float <= 0,
        laNutChan,
      };
    });

    const phuThuocOutput = phuThuoc;

    const launches = cotMoc.map(cm => ({
      id: cm.id, ma: cm.maSp, ten: cm.ten,
      ngay: cm.ngayLaunch!.toISOString(), duAnId: cm.duAnId,
    }));

    res.json({ buoc: buocs, phuThuoc: phuThuocOutput, cotMoc: launches });
  } catch (err) {
    console.error("Lỗi ban-do-nut-chan:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// POST /:id/goi-y — AI gợi ý giải quyết nút chặn + dự báo nếu unblock hôm nay
router.post("/:id/goi-y", yeuCauDangNhap, async (req, res) => {
  try {
    const { id } = req.params;
    const { float, ES, EF, LS, LF, cotMocNgay, soNgayDuKien } = req.body as {
      float: number; ES: number; EF: number; LS: number; LF: number;
      cotMocNgay?: string; soNgayDuKien?: number;
    };

    const buocRaw = await prisma.buoc.findUnique({
      where: { id },
      include: {
        duAn: { select: { ma: true, ten: true } },
        nguoiPhuTrach: { select: { ten: true } },
        canTro: {
          where: { trangThai: { not: "DA_GIAI_QUYET" } },
          select: { ten: true, mucDo: true },
        },
      },
    });

    if (!buocRaw) { res.status(404).json({ thongBao: "Không tìm thấy" }); return; }

    const canTroStr = buocRaw.canTro.length > 0
      ? buocRaw.canTro.map((ct, i) => `${i + 1}. ${ct.ten} (${ct.mucDo === "RAT_NGHIEM_TRONG" ? "Rất nghiêm trọng" : ct.mucDo === "VUA_PHAI" ? "Vừa phải" : "Nhẹ"})`).join("\n")
      : "Không có cản trở cụ thể được ghi nhận";

    const prompt = `Bạn là chuyên gia tư vấn quản lý dự án cho công ty ATK (dược phẩm Việt Nam).
Hãy phân tích bước đang bị chặn trên critical path và đưa ra gợi ý thực tế.

THÔNG TIN BƯỚC:
- Mã/Tên: ${buocRaw.ma} - ${buocRaw.ten}
- Dự án: ${buocRaw.duAn.ma} - ${buocRaw.duAn.ten}
- Người phụ trách: ${buocRaw.nguoiPhuTrach?.ten ?? "Chưa chỉ định"}
- Float hiện tại: ${float <= 0 ? "0 ngày (ĐÃ CRITICAL - mỗi ngày trễ = trễ launch)" : `${float} ngày đệm còn lại`}
- Thời gian dự kiến: ${soNgayDuKien ?? "?"} ngày
${cotMocNgay ? `- Cột mốc launch: ${cotMocNgay}` : ""}

CÁC CẢN TRỞ HIỆN TẠI:
${canTroStr}

Hãy đưa ra ĐÚNG 3 gợi ý ngắn gọn (mỗi gợi ý 1–2 câu), với format:
**1. [Hành động ngay 24h]** nội dung
**2. [Người cần quyết định]** nội dung
**3. [Rủi ro nếu trễ]** nội dung

Trả lời bằng tiếng Việt. Không thêm giải thích thừa.`;

    let goiY: string;
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
      const response = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      goiY = response.content[0].type === "text" ? response.content[0].text : "";
    } catch {
      goiY = "";
    }

    if (!goiY) {
      const mucDoUuTien = buocRaw.canTro[0]?.mucDo === "RAT_NGHIEM_TRONG" ? "rất nghiêm trọng" : "cần xử lý";
      goiY = `**1. [Hành động ngay 24h]** Yêu cầu ${buocRaw.nguoiPhuTrach?.ten ?? "người phụ trách"} báo cáo tình trạng cản trở và cam kết thời hạn giải quyết cụ thể.\n**2. [Người cần quyết định]** Trưởng nhóm ${buocRaw.duAn.ten} cần chủ trì cuộc họp khẩn để tháo gỡ ${buocRaw.canTro.length > 0 ? `${buocRaw.canTro.length} cản trở ${mucDoUuTien}` : "blocker"}.\n**3. [Rủi ro nếu trễ]** Float = ${float <= 0 ? "0 ngày" : `${float} ngày`} — mỗi ngày chậm sẽ trực tiếp đẩy lùi cột mốc launch của sản phẩm.`;
    }

    res.json({ goiY });
  } catch (err) {
    console.error("Lỗi goi-y nut-chan:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
