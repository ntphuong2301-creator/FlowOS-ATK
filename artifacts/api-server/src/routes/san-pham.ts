/**
 * Route: /api/san-pham
 * Danh sách sản phẩm + tiến độ realtime
 */
import { Router } from "express";
import { PrismaClient, TrangThaiBuoc, TrangThaiCanTro } from "@prisma/client";
import { yeuCauDangNhap } from "../middleware/xac-thuc.js";
import {
  tinhTiendoSanPham,
  tinhTiendoNhanh,
} from "../services/tiendo.service.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const prisma = new PrismaClient();

// ─── GET /api/san-pham — Danh sách 13 SKU + % realtime ───────────────────────

router.get("/", yeuCauDangNhap, async (req, res) => {
  try {
    const { kenh } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (kenh) where.kenh = kenh;

    const sanPhams = await prisma.sanPham.findMany({
      where,
      select: {
        id: true, maSp: true, ten: true, kenh: true,
        huongVi: true, dungTichMl: true, phLevel: true,
        ngayLaunch: true, trangThai: true,
        duAn: { select: { id: true, ma: true, ten: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
      },
      orderBy: [{ kenh: "asc" }, { maSp: "asc" }],
    });

    // Tính tiến độ nhanh song song
    const tienDoList = await Promise.all(
      sanPhams.map((sp) => tinhTiendoNhanh(sp.id, sp.ngayLaunch))
    );

    const tienDoMap = new Map(tienDoList.map((t) => [t.sanPhamId, t]));

    const result = sanPhams.map((sp) => {
      const td = tienDoMap.get(sp.id);
      return {
        ...sp,
        tongTienDo:    td?.tongTienDo    ?? 0,
        trangThaiTong: td?.trangThaiTong ?? "🟢 Chạy mượt",
        conNgay:       td?.conNgay       ?? null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Lỗi danh sách sản phẩm:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/san-pham/tong-quan — CEO Dashboard summary ──────────────────────

router.get("/tong-quan", yeuCauDangNhap, async (req, res) => {
  try {
    const sanPhams = await prisma.sanPham.findMany({
      select: {
        id: true, maSp: true, ten: true, kenh: true,
        ngayLaunch: true, trangThai: true,
      },
      orderBy: [{ kenh: "asc" }, { maSp: "asc" }],
    });

    const tienDoList = await Promise.all(
      sanPhams.map((sp) => tinhTiendoNhanh(sp.id, sp.ngayLaunch))
    );

    const tienDoMap = new Map(tienDoList.map((t) => [t.sanPhamId, t]));

    // Thống kê tổng quan
    let soLuongBiCanTro    = 0;
    let soLuongNguyHiem    = 0;
    let soLuongRuiRo       = 0;
    let soLuongChanMuot    = 0;
    let tongTienDoTrungBinh = 0;

    const danhSach = sanPhams.map((sp) => {
      const td = tienDoMap.get(sp.id);
      const ts = td?.trangThaiTong ?? "🟢 Chạy mượt";
      if (ts.includes("Bị cản trở"))   soLuongBiCanTro++;
      else if (ts.includes("Nguy hiểm")) soLuongNguyHiem++;
      else if (ts.includes("Rủi ro"))    soLuongRuiRo++;
      else                               soLuongChanMuot++;
      tongTienDoTrungBinh += td?.tongTienDo ?? 0;
      return {
        id: sp.id, maSp: sp.maSp, ten: sp.ten, kenh: sp.kenh,
        ngayLaunch: sp.ngayLaunch,
        tongTienDo:    td?.tongTienDo    ?? 0,
        trangThaiTong: ts,
        conNgay:       td?.conNgay       ?? null,
      };
    });

    const tb = sanPhams.length > 0 ? Math.round(tongTienDoTrungBinh / sanPhams.length) : 0;

    // Phân nhóm kênh
    const nhomKenh: Record<string, typeof danhSach> = {};
    for (const sp of danhSach) {
      const k = sp.kenh;
      nhomKenh[k] = nhomKenh[k] ?? [];
      nhomKenh[k].push(sp);
    }

    res.json({
      tongQuan: {
        tongSoSanPham:      sanPhams.length,
        soLuongBiCanTro,
        soLuongNguyHiem,
        soLuongRuiRo,
        soLuongChanMuot,
        tongTienDoTrungBinh: tb,
      },
      danhSach,
      nhomKenh,
    });
  } catch (err) {
    console.error("Lỗi tổng quan sản phẩm:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/san-pham/:id/tien-do — Chi tiết tiến độ ──────────────────────

router.get("/:id/tien-do", yeuCauDangNhap, async (req, res) => {
  try {
    const result = await tinhTiendoSanPham(req.params.id);
    if (!result) {
      return res.status(404).json({ thongBao: "Không tìm thấy sản phẩm" });
    }
    res.json(result);
  } catch (err) {
    console.error("Lỗi tính tiến độ sản phẩm:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/san-pham/:id/buoc-chi-tiet — Danh sách bước theo nhóm ──────────

router.get("/:id/buoc-chi-tiet", yeuCauDangNhap, async (req, res) => {
  try {
    const sp = await prisma.sanPham.findUnique({
      where: { id: req.params.id },
      select: { id: true, maSp: true, ten: true, duAnId: true },
    });
    if (!sp || !sp.duAnId) return res.status(404).json({ thongBao: "Không tìm thấy sản phẩm" });

    const buocs = await prisma.buoc.findMany({
      where: { duAnId: sp.duAnId },
      select: {
        id: true, ma: true, ten: true,
        trangThai: true, ngayKetThuc: true, ngayBatDau: true,
        nguoiPhuTrach: { select: { id: true, ten: true } },
      },
      orderBy: { ma: "asc" },
    });

    // Phân nhóm theo tiền tố mã bước
    const PREFIX_MAP: Record<string, string> = {
      BBNH: "baoBiNhan", BBC: "baoBiChai",
      RD: "rd", NAP: "nap", PCSPB: "phapChe", SXCN: "sxcn",
    };
    const nhomMap: Record<string, typeof buocs> = {
      rd: [], nap: [], baoBiChai: [], baoBiNhan: [], phapChe: [], sxcn: [], khac: [],
    };

    for (const b of buocs) {
      const maUp = b.ma.toUpperCase();
      let matched = false;
      for (const [prefix, key] of Object.entries(PREFIX_MAP)) {
        if (maUp.startsWith(prefix)) {
          nhomMap[key].push(b);
          matched = true;
          break;
        }
      }
      if (!matched) nhomMap.khac.push(b);
    }

    res.json({ sanPhamId: sp.id, maSp: sp.maSp, ten: sp.ten, nhom: nhomMap });
  } catch (err) {
    console.error("Lỗi buoc-chi-tiet:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── POST /api/san-pham/:id/goi-y-buoc-tiep — AI gợi ý bước tiếp theo ────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

router.post("/:id/goi-y-buoc-tiep", yeuCauDangNhap, async (req, res) => {
  try {
    const td = await tinhTiendoSanPham(req.params.id);
    if (!td) return res.status(404).json({ thongBao: "Không tìm thấy sản phẩm" });

    const { chiTiet, trangThaiTong, canTroHienTai, conNgay, maSp, ten } = td;

    // Ngữ cảnh cho AI
    const context = [
      `Sản phẩm: ${maSp} — ${ten}`,
      `Trạng thái: ${trangThaiTong}`,
      `Còn ${conNgay ?? "?"} ngày đến launch`,
      `R&D: ${chiTiet.rd.phanTram}% (${chiTiet.rd.buocXong}/${chiTiet.rd.tongBuoc} bước)`,
      `Nắp: ${chiTiet.nap.phanTram}%`,
      `Bao bì: ${chiTiet.baoBi.phanTram}% (chai ${chiTiet.baoBi.chiTiet.chai.phanTram}%, nhãn ${chiTiet.baoBi.chiTiet.nhan.phanTram}%)`,
      `Pháp chế: ${chiTiet.phapChe.phanTram}% (${chiTiet.phapChe.buocXong}/${chiTiet.phapChe.tongBuoc} bước)`,
      `SXCN: ${chiTiet.sxcn.phanTram}% (${chiTiet.sxcn.buocXong}/${chiTiet.sxcn.tongBuoc} bước)`,
      canTroHienTai.length > 0
        ? `Cản trở đang mở: ${canTroHienTai.map((c) => c.ten).join(", ")}`
        : "Không có cản trở đang mở",
    ].join("\n");

    let goiY = "";
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 200,
        system: `Bạn là chuyên gia tư vấn dự án sản phẩm cho công ty ATK (nước uống).
Phân tích tiến độ và đề xuất 1-2 bước hành động cụ thể ngắn gọn nhất để đẩy nhanh launch.
Trả lời bằng tiếng Việt, tối đa 50 từ, không cần giải thích dài dòng.`,
        messages: [{ role: "user", content: context }],
      });
      goiY = response.content[0]?.type === "text" ? response.content[0].text : "";
    } catch {
      // Fallback thông minh dựa trên data
      const bottleneck = Math.min(
        chiTiet.rd.phanTram, chiTiet.nap.phanTram,
        chiTiet.baoBi.phanTram, chiTiet.phapChe.phanTram, chiTiet.sxcn.phanTram
      );
      if (canTroHienTai.length > 0) {
        goiY = `Giải quyết ${canTroHienTai.length} cản trở đang mở trước, đặc biệt "${canTroHienTai[0].ten}".`;
      } else if (chiTiet.sxcn.phanTram < 30) {
        goiY = `Ưu tiên hoàn thiện SXCN (hiện ${chiTiet.sxcn.phanTram}%) để kịp tiến độ sản xuất.`;
      } else if (chiTiet.phapChe.phanTram < 50) {
        goiY = `Đẩy nhanh pháp chế (hiện ${chiTiet.phapChe.phanTram}%) — đây là điều kiện bắt buộc để launch.`;
      } else {
        goiY = `Tiếp tục hoàn thiện nhóm thấp nhất (${bottleneck}%) để cân bằng toàn bộ tiến độ.`;
      }
    }

    res.json({ sanPhamId: td.sanPhamId, maSp, goiY, trangThaiTong, tongTienDo: td.tongTienDo });
  } catch (err) {
    console.error("Lỗi gợi ý AI:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

// ─── GET /api/san-pham/:id — Chi tiết sản phẩm ───────────────────────────────

router.get("/:id", yeuCauDangNhap, async (req, res) => {
  try {
    const sp = await prisma.sanPham.findUnique({
      where: { id: req.params.id },
      include: {
        duAn: { select: { id: true, ma: true, ten: true } },
        nguoiPhuTrach: { select: { id: true, ten: true } },
      },
    });
    if (!sp) return res.status(404).json({ thongBao: "Không tìm thấy sản phẩm" });
    res.json(sp);
  } catch (err) {
    console.error("Lỗi lấy sản phẩm:", err);
    res.status(500).json({ thongBao: "Lỗi máy chủ" });
  }
});

export default router;
