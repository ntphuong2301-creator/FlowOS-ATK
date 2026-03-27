import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle, Plus, X, RefreshCw, ChevronDown, Search,
  Calendar, User, Building2, Flag, CheckCircle2, Clock
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MucDo = "RAT_NGHIEM_TRONG" | "VUA_PHAI" | "NHE";
type TrangThai = "MO" | "DANG_XU_LY" | "DA_GIAI_QUYET";

interface CanTro {
  id: string;
  ten: string;
  mucDo: MucDo;
  trangThai: TrangThai;
  ngayPhatSinh: string;
  hanXuLy?: string | null;
  ngayXuLy?: string | null;
  giaiPhap?: string | null;
  duAn: { id: string; ten: string; ma: string };
  congViecBiChan?: { id: string; ten: string } | null;
  nguoiGap: { id: string; ten: string };
  nguoiXuLy?: { id: string; ten: string } | null;
  capNhat?: { id: string; noiDung: string; taoLuc: string }[];
}

interface ThongKe {
  dangMo: number;
  ratNghiemTrong: number;
  daGiaiQuyetTuan: number;
  trungBinhNgayKet: number;
}

interface NguoiDung { id: string; ten: string; email: string }
interface CongViec  { id: string; ten: string; duAn?: { ten: string } }
interface DuAn      { id: string; ma: string; ten: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const MUCDO_CONFIG: Record<MucDo, { nhan: string; mauNen: string; mauChu: string; icon: string }> = {
  RAT_NGHIEM_TRONG: { nhan: "Rất nghiêm trọng", mauNen: "bg-red-50",    mauChu: "text-red-700",    icon: "🔴" },
  VUA_PHAI:         { nhan: "Vừa phải",          mauNen: "bg-yellow-50", mauChu: "text-yellow-700", icon: "🟡" },
  NHE:              { nhan: "Nhẹ",               mauNen: "bg-green-50",  mauChu: "text-green-700",  icon: "🟢" },
};

const TRANGTHAI_CONFIG: Record<TrangThai, { nhan: string; mau: string }> = {
  MO:            { nhan: "Đang mở",    mau: "bg-red-100 text-red-700" },
  DANG_XU_LY:   { nhan: "Đang xử lý", mau: "bg-blue-100 text-blue-700" },
  DA_GIAI_QUYET:{ nhan: "Đã xử lý",   mau: "bg-green-100 text-green-700" },
};

const NHOM_LARK = ["SOS", "R&D", "DA Nắp", "Tất cả"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ngay(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function soNgayKet(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

async function goiApi(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { thongBao?: string }).thongBao ?? "Lỗi không xác định");
  }
  return res.json();
}

// ─── Component chính ──────────────────────────────────────────────────────────

export default function QuanLyCanTro() {
  const [items, setItems]       = useState<CanTro[]>([]);
  const [thongKe, setThongKe]   = useState<ThongKe | null>(null);
  const [dangTai, setDangTai]   = useState(true);
  const [loiTai, setLoiTai]     = useState("");

  // Filters
  const [locTrangThai, setLocTrangThai] = useState("");
  const [locMucDo, setLocMucDo]         = useState("");
  const [locDuAn, setLocDuAn]           = useState("");
  const [timKiem, setTimKiem]           = useState("");

  // Modal
  const [hienModal, setHienModal] = useState(false);

  // Data cho dropdown
  const [nguoiDungs, setNguoiDungs] = useState<NguoiDung[]>([]);
  const [congViecs, setCongViecs]   = useState<CongViec[]>([]);
  const [duAns, setDuAns]           = useState<DuAn[]>([]);

  // Form state
  const [form, setForm] = useState({
    ten: "",
    mucDo: "VUA_PHAI" as MucDo,
    duAnId: "",
    congViecBiChanId: "",
    nguoiXuLyId: "",
    hanXuLy: "",
    guiLark: true,
    larkChatId: "Tất cả",
  });
  const [dangLuu, setDangLuu]  = useState(false);
  const [loiForm, setLoiForm]  = useState("");
  const [timCV, setTimCV]      = useState("");

  // Chi tiết & cập nhật trạng thái
  const [chiTietId, setChiTietId]         = useState<string | null>(null);
  const [chiTietItem, setChiTietItem]     = useState<CanTro | null>(null);
  const [noiDungCapNhat, setNoiDungCapNhat] = useState("");

  const taiDuLieu = useCallback(async () => {
    setDangTai(true);
    setLoiTai("");
    try {
      const params = new URLSearchParams();
      if (locTrangThai) params.set("trangThai", locTrangThai);
      if (locMucDo)     params.set("mucDo", locMucDo);
      if (locDuAn)      params.set("duAnId", locDuAn);

      const [data, tk] = await Promise.all([
        goiApi(`/api/can-tro?${params}`),
        goiApi("/api/can-tro/thong-ke"),
      ]);
      setItems(data.items ?? []);
      setThongKe(tk);
    } catch (e) {
      setLoiTai((e as Error).message);
    } finally {
      setDangTai(false);
    }
  }, [locTrangThai, locMucDo, locDuAn]);

  useEffect(() => { taiDuLieu(); }, [taiDuLieu]);

  useEffect(() => {
    Promise.all([
      goiApi("/api/nguoi-dung"),
      goiApi("/api/du-an"),
    ]).then(([nd, da]) => {
      setNguoiDungs(nd);
      setDuAns(da);
    }).catch(console.warn);
  }, []);

  useEffect(() => {
    if (!form.duAnId && !timCV) return;
    const params = new URLSearchParams();
    if (form.duAnId) params.set("duAnId", form.duAnId);
    if (timCV)       params.set("q", timCV);
    goiApi(`/api/cong-viec?${params}`).then(setCongViecs).catch(console.warn);
  }, [form.duAnId, timCV]);

  // Tải chi tiết khi chọn item
  useEffect(() => {
    if (!chiTietId) { setChiTietItem(null); return; }
    goiApi(`/api/can-tro/${chiTietId}`).then(setChiTietItem).catch(console.warn);
  }, [chiTietId]);

  const itemsFiltered = items.filter((ct) =>
    !timKiem ||
    ct.ten.toLowerCase().includes(timKiem.toLowerCase()) ||
    ct.congViecBiChan?.ten.toLowerCase().includes(timKiem.toLowerCase())
  );

  // ── Tạo cản trở mới ────────────────────────────────────────────────────────
  const xuLyTao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ten.trim()) { setLoiForm("Vui lòng nhập hạng mục"); return; }
    if (!form.duAnId)     { setLoiForm("Vui lòng chọn dự án"); return; }
    setLoiForm("");
    setDangLuu(true);
    try {
      await goiApi("/api/can-tro", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          congViecBiChanId: form.congViecBiChanId || undefined,
          nguoiXuLyId:      form.nguoiXuLyId      || undefined,
          hanXuLy:          form.hanXuLy           || undefined,
        }),
      });
      setHienModal(false);
      setForm({ ten: "", mucDo: "VUA_PHAI", duAnId: "", congViecBiChanId: "", nguoiXuLyId: "", hanXuLy: "", guiLark: true, larkChatId: "Tất cả" });
      taiDuLieu();
    } catch (e) {
      setLoiForm((e as Error).message);
    } finally {
      setDangLuu(false);
    }
  };

  // ── Cập nhật trạng thái ────────────────────────────────────────────────────
  const doiTrangThai = async (id: string, trangThai: TrangThai) => {
    try {
      await goiApi(`/api/can-tro/${id}`, { method: "PATCH", body: JSON.stringify({ trangThai }) });
      taiDuLieu();
      if (chiTietId === id) {
        goiApi(`/api/can-tro/${id}`).then(setChiTietItem).catch(console.warn);
      }
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const guiCapNhat = async (id: string) => {
    if (!noiDungCapNhat.trim()) return;
    try {
      await goiApi(`/api/can-tro/${id}/cap-nhat`, { method: "POST", body: JSON.stringify({ noiDung: noiDungCapNhat }) });
      setNoiDungCapNhat("");
      goiApi(`/api/can-tro/${id}`).then(setChiTietItem).catch(console.warn);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A1A]">Quản lý cản trở</h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5">Theo dõi và xử lý các vấn đề cản trở tiến độ</p>
        </div>
        <button
          onClick={() => setHienModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "#008264" }}
        >
          <Plus size={16} /> Thêm cản trở
        </button>
      </div>

      {/* Thẻ số liệu */}
      {thongKe && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { nhan: "Đang mở", gia: thongKe.dangMo, icon: <AlertCircle size={18} />, mau: "#EF4444", mauNen: "bg-red-50", doiMau: thongKe.dangMo > 0 },
            { nhan: "Rất nghiêm trọng", gia: thongKe.ratNghiemTrong, icon: <Flag size={18} />, mau: "#F59E0B", mauNen: "bg-amber-50", doiMau: false },
            { nhan: "Trung bình ngày bị chặn", gia: thongKe.trungBinhNgayKet + " ngày", icon: <Clock size={18} />, mau: "#6B6B6B", mauNen: "bg-gray-50", doiMau: false },
            { nhan: "Đã xử lý tuần này", gia: thongKe.daGiaiQuyetTuan, icon: <CheckCircle2 size={18} />, mau: "#008264", mauNen: "bg-emerald-50", doiMau: false },
          ].map((t) => (
            <div key={t.nhan} className={`${t.mauNen} rounded-xl p-4 border border-white`}>
              <div className="flex items-center gap-2 mb-2" style={{ color: t.mau }}>
                {t.icon}
              </div>
              <div className={`text-2xl font-bold ${t.doiMau ? "text-red-600" : "text-[#1A1A1A]"}`}>
                {t.gia}
              </div>
              <div className="text-xs text-[#6B6B6B] mt-0.5">{t.nhan}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[#E0E0DD] bg-white text-sm flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="text-[#9B9B98] shrink-0" />
          <input
            value={timKiem}
            onChange={(e) => setTimKiem(e.target.value)}
            placeholder="Tìm kiếm cản trở..."
            className="flex-1 outline-none text-[#1A1A1A] placeholder:text-[#9B9B98] bg-transparent"
          />
        </div>

        <select
          value={locTrangThai}
          onChange={(e) => setLocTrangThai(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[#E0E0DD] bg-white text-sm text-[#1A1A1A] outline-none cursor-pointer"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="MO">Đang mở</option>
          <option value="DANG_XU_LY">Đang xử lý</option>
          <option value="DA_GIAI_QUYET">Đã xử lý</option>
        </select>

        <select
          value={locMucDo}
          onChange={(e) => setLocMucDo(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[#E0E0DD] bg-white text-sm text-[#1A1A1A] outline-none cursor-pointer"
        >
          <option value="">Tất cả mức độ</option>
          <option value="RAT_NGHIEM_TRONG">Rất nghiêm trọng</option>
          <option value="VUA_PHAI">Vừa phải</option>
          <option value="NHE">Nhẹ</option>
        </select>

        <select
          value={locDuAn}
          onChange={(e) => setLocDuAn(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[#E0E0DD] bg-white text-sm text-[#1A1A1A] outline-none cursor-pointer"
        >
          <option value="">Tất cả dự án</option>
          {duAns.map((da) => (
            <option key={da.id} value={da.id}>{da.ma} — {da.ten}</option>
          ))}
        </select>

        <button
          onClick={taiDuLieu}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E0E0DD] bg-white text-[#6B6B6B] hover:bg-[#F3F3F1] transition-colors"
        >
          <RefreshCw size={15} className={dangTai ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Bảng */}
      {loiTai ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{loiTai}</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E0E0DD] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E0E0DD] bg-[#F8F8F7]">
                  {["Mức độ", "Hạng mục", "Công việc bị chặn", "Dự án", "Người xử lý", "Hạn xử lý", "Ngày kẹt", "Trạng thái", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#6B6B6B] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dangTai ? (
                  <tr><td colSpan={9} className="text-center py-12 text-[#9B9B98]">Đang tải...</td></tr>
                ) : itemsFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16">
                      <AlertCircle size={32} className="mx-auto mb-2 text-[#BDBDBA]" />
                      <div className="text-[#9B9B98]">Không có cản trở nào</div>
                    </td>
                  </tr>
                ) : (
                  itemsFiltered.map((ct) => {
                    const md = MUCDO_CONFIG[ct.mucDo];
                    const tt = TRANGTHAI_CONFIG[ct.trangThai];
                    const ngayKet = soNgayKet(ct.ngayPhatSinh);
                    const quaHan = ct.hanXuLy && new Date(ct.hanXuLy) < new Date() && ct.trangThai !== "DA_GIAI_QUYET";
                    return (
                      <tr
                        key={ct.id}
                        onClick={() => setChiTietId(ct.id)}
                        className={[
                          "border-b border-[#F0F0EE] hover:bg-[#FAFAF9] cursor-pointer transition-colors",
                          ct.mucDo === "RAT_NGHIEM_TRONG" ? "bg-red-50/50" : ct.mucDo === "VUA_PHAI" ? "bg-yellow-50/30" : "",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${md.mauNen} ${md.mauChu}`}>
                            {md.icon} {md.nhan}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="font-medium text-[#1A1A1A] line-clamp-2">{ct.ten}</div>
                        </td>
                        <td className="px-4 py-3 text-[#6B6B6B] max-w-[160px]">
                          <div className="truncate">{ct.congViecBiChan?.ten ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-[#6B6B6B] whitespace-nowrap">
                          <span className="text-xs bg-[#F3F3F1] px-2 py-0.5 rounded-full">{ct.duAn.ma}</span>
                        </td>
                        <td className="px-4 py-3 text-[#6B6B6B] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: "#008264" }}>
                              {ct.nguoiXuLy?.ten?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            {ct.nguoiXuLy?.ten ?? <span className="text-[#BDBDBA]">Chưa chỉ định</span>}
                          </div>
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-xs ${quaHan ? "text-red-600 font-semibold" : "text-[#6B6B6B]"}`}>
                          {ngay(ct.hanXuLy)}
                          {quaHan && <span className="ml-1">⚠️</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold ${ngayKet > 7 ? "text-red-600" : ngayKet > 3 ? "text-amber-600" : "text-[#6B6B6B]"}`}>
                            {ngayKet}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tt.mau}`}>{tt.nhan}</span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {ct.trangThai !== "DA_GIAI_QUYET" && (
                            <div className="relative group">
                              <button className="flex items-center gap-1 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] px-2 py-1 rounded border border-[#E0E0DD] hover:border-[#008264] transition-colors">
                                Cập nhật <ChevronDown size={12} />
                              </button>
                              <div className="absolute right-0 top-8 z-10 bg-white border border-[#E0E0DD] rounded-lg shadow-lg py-1 min-w-[140px] hidden group-hover:block">
                                {ct.trangThai === "MO" && (
                                  <button
                                    onClick={() => doiTrangThai(ct.id, "DANG_XU_LY")}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F3F3F1] text-blue-600"
                                  >
                                    → Đang xử lý
                                  </button>
                                )}
                                <button
                                  onClick={() => doiTrangThai(ct.id, "DA_GIAI_QUYET")}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#F3F3F1] text-green-600"
                                >
                                  ✅ Đã giải quyết
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Tạo cản trở mới ─────────────────────────────────────────── */}
      {hienModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setHienModal(false)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl border border-[#E0E0DD] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E0E0DD]">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500" />
                <h2 className="font-semibold text-[#1A1A1A]">Thêm cản trở mới</h2>
              </div>
              <button onClick={() => setHienModal(false)} className="text-[#9B9B98] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={xuLyTao} className="px-6 py-5 space-y-4">
              {loiForm && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{loiForm}</div>
              )}

              {/* 1. Hạng mục */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  Hạng mục bị cản trở <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.ten}
                  onChange={(e) => setForm({ ...form, ten: e.target.value })}
                  placeholder="Mô tả vấn đề đang cản trở..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] focus:border-[#008264] focus:ring-2 focus:ring-[#008264]/10 outline-none resize-none"
                />
              </div>

              {/* 2. Mức độ */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">Mức độ</label>
                <div className="flex gap-2">
                  {(["RAT_NGHIEM_TRONG", "VUA_PHAI", "NHE"] as MucDo[]).map((md) => {
                    const cfg = MUCDO_CONFIG[md];
                    const sel = form.mucDo === md;
                    return (
                      <button
                        key={md}
                        type="button"
                        onClick={() => setForm({ ...form, mucDo: md })}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                          sel ? `${cfg.mauNen} ${cfg.mauChu} border-current` : "border-[#E0E0DD] text-[#6B6B6B] hover:border-[#BDBDBA]"
                        }`}
                      >
                        {cfg.icon} {cfg.nhan}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Dự án */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  <Building2 size={12} className="inline mr-1" />Dự án <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.duAnId}
                  onChange={(e) => setForm({ ...form, duAnId: e.target.value, congViecBiChanId: "" })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] focus:border-[#008264] outline-none"
                >
                  <option value="">Chọn dự án...</option>
                  {duAns.map((da) => (
                    <option key={da.id} value={da.id}>{da.ma} — {da.ten}</option>
                  ))}
                </select>
              </div>

              {/* 4. Công việc bị chặn */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  <Search size={12} className="inline mr-1" />Công việc bị chặn
                </label>
                <input
                  value={timCV}
                  onChange={(e) => setTimCV(e.target.value)}
                  placeholder="Tìm công việc..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] focus:border-[#008264] outline-none mb-1"
                />
                <select
                  value={form.congViecBiChanId}
                  onChange={(e) => setForm({ ...form, congViecBiChanId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] focus:border-[#008264] outline-none"
                >
                  <option value="">Không chọn</option>
                  {congViecs.map((cv) => (
                    <option key={cv.id} value={cv.id}>{cv.ten}</option>
                  ))}
                </select>
              </div>

              {/* 5. Người xử lý */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  <User size={12} className="inline mr-1" />Người xử lý
                </label>
                <select
                  value={form.nguoiXuLyId}
                  onChange={(e) => setForm({ ...form, nguoiXuLyId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] focus:border-[#008264] outline-none"
                >
                  <option value="">Chưa chỉ định</option>
                  {nguoiDungs.map((nd) => (
                    <option key={nd.id} value={nd.id}>{nd.ten}</option>
                  ))}
                </select>
              </div>

              {/* 6. Hạn xử lý */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  <Calendar size={12} className="inline mr-1" />Hạn xử lý
                </label>
                <input
                  type="date"
                  value={form.hanXuLy}
                  onChange={(e) => setForm({ ...form, hanXuLy: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] focus:border-[#008264] outline-none"
                />
              </div>

              {/* 7. Lark */}
              <div className="bg-[#F8F8F7] rounded-xl p-4 space-y-3 border border-[#E0E0DD]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                    <span className="text-base">🤖</span> Gửi thông báo Lark
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, guiLark: !form.guiLark })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.guiLark ? "bg-[#008264]" : "bg-[#BDBDBA]"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.guiLark ? "left-5" : "left-0.5"}`}
                    />
                  </button>
                </div>

                {form.guiLark && (
                  <div>
                    <label className="block text-xs text-[#6B6B6B] mb-1">Chọn nhóm Lark</label>
                    <select
                      value={form.larkChatId}
                      onChange={(e) => setForm({ ...form, larkChatId: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] bg-white focus:border-[#008264] outline-none"
                    >
                      {NHOM_LARK.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setHienModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[#E0E0DD] text-sm text-[#6B6B6B] hover:bg-[#F3F3F1] transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={dangLuu}
                  className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: "#008264" }}
                >
                  {dangLuu ? "Đang lưu..." : "Tạo cản trở"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Panel chi tiết (slide-in từ phải) ────────────────────────────── */}
      {chiTietItem && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setChiTietId(null)}>
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="relative bg-white w-full max-w-md h-full shadow-2xl border-l border-[#E0E0DD] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0DD]">
              <div className="flex items-center gap-2">
                <span className="text-lg">{MUCDO_CONFIG[chiTietItem.mucDo].icon}</span>
                <span className="font-semibold text-[#1A1A1A] text-sm line-clamp-1">{chiTietItem.ten}</span>
              </div>
              <button onClick={() => setChiTietId(null)} className="text-[#9B9B98] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Trạng thái + hành động */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TRANGTHAI_CONFIG[chiTietItem.trangThai].mau}`}>
                  {TRANGTHAI_CONFIG[chiTietItem.trangThai].nhan}
                </span>
                {chiTietItem.trangThai !== "DA_GIAI_QUYET" && (
                  <>
                    {chiTietItem.trangThai === "MO" && (
                      <button
                        onClick={() => doiTrangThai(chiTietItem.id, "DANG_XU_LY")}
                        className="text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        → Đang xử lý
                      </button>
                    )}
                    <button
                      onClick={() => doiTrangThai(chiTietItem.id, "DA_GIAI_QUYET")}
                      className="text-xs px-3 py-1 rounded-full border border-green-300 text-green-600 hover:bg-green-50"
                    >
                      ✅ Đã xử lý
                    </button>
                  </>
                )}
              </div>

              {/* Thông tin */}
              <div className="space-y-2 text-sm">
                {[
                  { nhan: "Dự án", gia: `${chiTietItem.duAn.ma} — ${chiTietItem.duAn.ten}` },
                  { nhan: "Công việc bị chặn", gia: chiTietItem.congViecBiChan?.ten ?? "—" },
                  { nhan: "Người gặp", gia: chiTietItem.nguoiGap.ten },
                  { nhan: "Người xử lý", gia: chiTietItem.nguoiXuLy?.ten ?? "Chưa chỉ định" },
                  { nhan: "Ngày phát sinh", gia: ngay(chiTietItem.ngayPhatSinh) },
                  { nhan: "Hạn xử lý", gia: ngay(chiTietItem.hanXuLy) },
                  { nhan: "Ngày xử lý", gia: ngay(chiTietItem.ngayXuLy) },
                ].map((r) => (
                  <div key={r.nhan} className="flex justify-between gap-3">
                    <span className="text-[#6B6B6B] shrink-0">{r.nhan}</span>
                    <span className="font-medium text-[#1A1A1A] text-right">{r.gia}</span>
                  </div>
                ))}
              </div>

              {chiTietItem.giaiPhap && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="text-xs font-semibold text-green-700 mb-1">Giải pháp</div>
                  <div className="text-sm text-green-800">{chiTietItem.giaiPhap}</div>
                </div>
              )}

              {/* Lịch sử cập nhật */}
              {(chiTietItem.capNhat?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[#6B6B6B] mb-2">Cập nhật gần đây</div>
                  <div className="space-y-2">
                    {chiTietItem.capNhat?.map((cu) => (
                      <div key={cu.id} className="bg-[#F8F8F7] rounded-lg px-3 py-2 text-sm">
                        <div className="text-[#1A1A1A]">{cu.noiDung}</div>
                        <div className="text-xs text-[#9B9B98] mt-0.5">{ngay(cu.taoLuc)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thêm cập nhật */}
              <div>
                <div className="text-xs font-semibold text-[#6B6B6B] mb-2">Thêm cập nhật</div>
                <textarea
                  rows={3}
                  value={noiDungCapNhat}
                  onChange={(e) => setNoiDungCapNhat(e.target.value)}
                  placeholder="Ghi chú tiến độ xử lý..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E0E0DD] focus:border-[#008264] outline-none resize-none"
                />
                <button
                  onClick={() => guiCapNhat(chiTietItem.id)}
                  disabled={!noiDungCapNhat.trim()}
                  className="mt-2 w-full py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
                  style={{ background: "#008264" }}
                >
                  Gửi cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
