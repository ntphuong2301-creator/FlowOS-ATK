/**
 * FormTaoViec — Form tạo công việc đầy đủ (thay thế FormThemCV cũ)
 *
 * Tính năng:
 * - Tên công việc (bắt buộc)
 * - Người phụ trách (lọc theo role: admin/leader thấy tất cả, member chỉ thấy mình)
 * - Người phối hợp (chọn nhiều)
 * - Ngày bắt đầu / Hạn hoàn thành (bắt buộc)
 * - Mức ưu tiên
 * - Sản phẩm liên quan (chọn nhiều)
 * - Ghi chú
 * - Định nghĩa hoàn thành
 */

import { useState, useEffect } from "react";
import { X, Plus, Loader2, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { goiApi } from "@/lib/api";

interface NguoiDung { id: string; ten: string; capQuyen?: string }
interface SanPham { id: string; ten: string; maSp?: string | null }

interface CongViecMoi {
  id: string; ten: string; trangThai: string; mucUuTien: string;
  ngayBatDau?: string | null; ngayKetThuc?: string | null;
  moTa?: string | null; dinhNghiaHoanThanh?: string | null;
  ghiChu?: string | null; nguoiPhoiHop?: string[]; sanPhamIds?: string[];
  nguoiPhuTrach?: { id: string; ten: string } | null;
  buocQuyTrinh?: { id: string; ten: string; ma: string } | null;
  duAn?: { id: string; ten: string; ma: string } | null;
}

interface PropsFormTaoViec {
  buocId: string;
  duAnId?: string;
  onHuy: () => void;
  onTao: (cv: CongViecMoi) => void;
}

const UU_TIEN_OPTS = [
  { value: "THAP",      label: "Thấp",      color: "#6B7280" },
  { value: "TRUNG_BINH",label: "Trung bình",color: "#0C447C" },
  { value: "CAO",       label: "Cao",       color: "#EF9F27" },
  { value: "KHAN_CAP",  label: "Khẩn cấp", color: "#E24B4A" },
];

export function FormTaoViec({ buocId, duAnId, onHuy, onTao }: PropsFormTaoViec) {
  const user = useAppStore((s) => s.user);
  const cap = (user as unknown as { role?: string })?.role ?? "";

  const [ten, setTen] = useState("");
  const [inchargeId, setInchargeId] = useState(
    cap === "THANH_VIEN" ? (user?.id ?? "") : ""
  );
  const [nguoiPhoiHop, setNguoiPhoiHop] = useState<string[]>([]);
  const [ngayBatDau, setNgayBatDau] = useState("");
  const [ngayKetThuc, setNgayKetThuc] = useState("");
  const [mucUuTien, setMucUuTien] = useState("TRUNG_BINH");
  const [sanPhamIds, setSanPhamIds] = useState<string[]>([]);
  const [ghiChu, setGhiChu] = useState("");
  const [dinhNghiaHoanThanh, setDinhNghiaHoanThanh] = useState("");
  const [moTa, setMoTa] = useState("");
  const [dangMo, setDangMo] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [nangCao, setNangCao] = useState(false);

  const [nguoiDungList, setNguoiDungList] = useState<NguoiDung[]>([]);
  const [sanPhamList, setSanPhamList] = useState<SanPham[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      goiApi("/api/nguoi-dung").catch(() => []),
      goiApi("/api/san-pham").catch(() => []),
    ]).then(([nd, sp]) => {
      if (!active) return;
      setNguoiDungList(Array.isArray(nd) ? nd : []);
      setSanPhamList(Array.isArray(sp) ? sp.map((s: { id: string; ten: string; maSp?: string | null }) => ({
        id: s.id, ten: s.ten, maSp: s.maSp ?? null,
      })) : []);
    });
    return () => { active = false; };
  }, []);

  const nguoiDungHienThi = cap === "THANH_VIEN"
    ? nguoiDungList.filter(u => u.id === user?.id)
    : nguoiDungList;

  async function tao() {
    if (!ten.trim() || !ngayKetThuc) return;
    setDangGui(true);
    try {
      const cv = await goiApi(`/api/buoc/${buocId}/cong-viec`, {
        method: "POST",
        body: JSON.stringify({
          ten: ten.trim(),
          inchargeId: inchargeId || undefined,
          ngayKetThuc,
          ngayBatDau: ngayBatDau || undefined,
          mucUuTien,
          moTa: moTa || undefined,
          dinhNghiaHoanThanh: dinhNghiaHoanThanh || undefined,
          ghiChu: ghiChu || undefined,
          nguoiPhoiHop: nguoiPhoiHop.length > 0 ? nguoiPhoiHop : undefined,
          sanPhamIds: sanPhamIds.length > 0 ? sanPhamIds : undefined,
        }),
      });
      onTao(cv as CongViecMoi);
    } catch { /* show nothing — keep form open */ }
    finally { setDangGui(false); }
  }

  function batNguoiPhoi(uid: string) {
    setNguoiPhoiHop(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  }

  function batSanPham(sid: string) {
    setSanPhamIds(prev =>
      prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]
    );
  }

  const canSubmit = ten.trim().length > 0 && ngayKetThuc.length > 0 && !dangGui;

  return (
    <div style={{
      margin: "6px 0 4px 20px",
      padding: "16px",
      background: "#F8FFFE",
      border: "1.5px solid #008264",
      borderRadius: 12,
      display: "flex", flexDirection: "column", gap: 10,
      boxShadow: "0 2px 8px rgba(0,130,100,0.10)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#008264" }}>
          ＋ Thêm công việc
        </span>
        <button onClick={onHuy} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      {/* Tên công việc */}
      <input
        autoFocus
        value={ten}
        onChange={e => setTen(e.target.value)}
        placeholder="Tên công việc *"
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && tao()}
        style={styleInput}
      />

      {/* Row 1: Người phụ trách + Hạn */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={inchargeId}
          onChange={e => setInchargeId(e.target.value)}
          disabled={cap === "THANH_VIEN" && nguoiDungHienThi.length === 1}
          style={{ ...styleInput, flex: 2, minWidth: 140 }}
        >
          <option value="">— Người phụ trách —</option>
          {nguoiDungHienThi.map(u => (
            <option key={u.id} value={u.id}>{u.ten}</option>
          ))}
        </select>
        <input
          type="date"
          value={ngayKetThuc}
          onChange={e => setNgayKetThuc(e.target.value)}
          placeholder="Hạn *"
          style={{ ...styleInput, flex: 1, minWidth: 120 }}
        />
      </div>

      {/* Row 2: Ưu tiên + Ngày bắt đầu */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={mucUuTien}
          onChange={e => setMucUuTien(e.target.value)}
          style={{ ...styleInput, flex: 1, minWidth: 120 }}
        >
          {UU_TIEN_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={ngayBatDau}
          onChange={e => setNgayBatDau(e.target.value)}
          placeholder="Ngày bắt đầu"
          style={{ ...styleInput, flex: 1, minWidth: 120 }}
        />
      </div>

      {/* Tuỳ chọn nâng cao */}
      <button
        onClick={() => setNangCao(p => !p)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "#008264", padding: "2px 0", fontFamily: "inherit",
        }}
      >
        {nangCao ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {nangCao ? "Thu gọn" : "Thêm thông tin"}
      </button>

      {nangCao && (
        <>
          {/* Người phối hợp (multi-select) */}
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={11} /> Người phối hợp
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {nguoiDungList.filter(u => u.id !== inchargeId).map(u => (
                <button
                  key={u.id}
                  onClick={() => batNguoiPhoi(u.id)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    border: "1.5px solid",
                    borderColor: nguoiPhoiHop.includes(u.id) ? "#008264" : "#D1D5DB",
                    background: nguoiPhoiHop.includes(u.id) ? "#E8FFF8" : "#fff",
                    color: nguoiPhoiHop.includes(u.id) ? "#008264" : "#374151",
                    fontWeight: nguoiPhoiHop.includes(u.id) ? 600 : 400,
                  }}
                >
                  {u.ten}
                </button>
              ))}
            </div>
          </div>

          {/* Sản phẩm liên quan */}
          {sanPhamList.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Sản phẩm</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sanPhamList.map(sp => (
                  <button
                    key={sp.id}
                    onClick={() => batSanPham(sp.id)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      border: "1.5px solid",
                      borderColor: sanPhamIds.includes(sp.id) ? "#534AB7" : "#D1D5DB",
                      background: sanPhamIds.includes(sp.id) ? "#F0EEFF" : "#fff",
                      color: sanPhamIds.includes(sp.id) ? "#534AB7" : "#374151",
                      fontWeight: sanPhamIds.includes(sp.id) ? 600 : 400,
                    }}
                  >
                    {sp.maSp ? `${sp.maSp} ` : ""}{sp.ten}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mô tả */}
          <textarea
            value={moTa}
            onChange={e => setMoTa(e.target.value)}
            placeholder="Mô tả công việc"
            rows={2}
            style={{ ...styleInput, resize: "vertical" }}
          />

          {/* Ghi chú */}
          <input
            value={ghiChu}
            onChange={e => setGhiChu(e.target.value)}
            placeholder="Ghi chú"
            style={styleInput}
          />

          {/* Định nghĩa hoàn thành */}
          <input
            value={dinhNghiaHoanThanh}
            onChange={e => setDinhNghiaHoanThanh(e.target.value)}
            placeholder="Định nghĩa hoàn thành (điều kiện nghiệm thu)"
            style={styleInput}
          />
        </>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onHuy} style={styleHuyBtn}>Hủy</button>
        <button
          onClick={tao}
          disabled={!canSubmit}
          style={{
            ...styleTaoBtn,
            background: canSubmit ? "#008264" : "#D1D5DB",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {dangGui
            ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
            : <Plus size={12} />
          }
          Thêm công việc
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styleInput: React.CSSProperties = {
  border: "1px solid #D1D5DB",
  borderRadius: 7,
  padding: "6px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
};

const styleHuyBtn: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: 8,
  background: "none",
  border: "1.5px solid #D1D5DB",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "#374151",
};

const styleTaoBtn: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: 8,
  color: "#fff",
  border: "none",
  fontSize: 12,
  fontFamily: "inherit",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 4,
};
