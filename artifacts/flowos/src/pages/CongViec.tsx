import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, X, ChevronDown, ChevronRight, CheckCircle2, AlertCircle,
  Clock, Users, Flag, Loader2, Calendar, BarChart2,
  Bell, SendHorizonal, Zap, Filter, RefreshCw,
  ArrowRight, LayoutList, Columns, Trash2, RotateCcw,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { goiApi } from "@/lib/api";
import { useUndoRedoGlobal } from "@/hooks/dung-undo";
import { dungSocket } from "@/hooks/dung-socket";
import { FormTaoViec } from "@/components/congviec/FormTaoViec";
import { XoaCongViecModal } from "@/components/congviec/XoaCongViecModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NguoiDung { id: string; ten: string; larkUserId?: string }
interface DuAn { id: string; ten: string; ma: string }

interface CongViecItem {
  id: string; ten: string; trangThai: string; mucUuTien: string;
  moTa?: string | null; dinhNghiaHoanThanh?: string | null;
  ngayBatDau?: string | null; ngayKetThuc?: string | null;
  ngayKetThucThucTe?: string | null; soNgayTre: number;
  nguoiPhuTrach?: NguoiDung | null;
  buocQuyTrinh?: { id: string; ten: string; ma: string; trangThai: string; duAn?: DuAn | null; nguoiPhuTrach?: NguoiDung | null; ngayBatDau?: string | null; ngayKetThuc?: string | null; soXong?: number; soCongViec?: number } | null;
  duAn?: DuAn | null;
  sanPham?: { id: string; ten: string; maSp?: string | null } | null;
  canTro?: { id: string; ten: string; mucDo: string }[];
}

interface NhomBuoc {
  buoc: { id: string; ten: string; ma: string; trangThai: string; ngayBatDau?: string | null; ngayKetThuc?: string | null; nguoiPhuTrach?: NguoiDung | null; duAn?: DuAn | null; soXong: number; soCongViec: number } | null;
  congViec: CongViecItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TT_STYLE: Record<string, { dot: string; bg: string; text: string; badge: string; label: string }> = {
  XONG:     { dot: "#008264", bg: "#E1F5EE", text: "#075740", badge: "#A7F3D0", label: "Xong rồi" },
  DANG_LAM: { dot: "#0C447C", bg: "#EFF6FF", text: "#0C447C", badge: "#BFDBFE", label: "Đang làm" },
  BI_CHAN:  { dot: "#E24B4A", bg: "#FEF2F2", text: "#991B1B", badge: "#FCA5A5", label: "Bị chặn" },
  CHUA_LAM: { dot: "#888888", bg: "#F5F5F3", text: "#555555", badge: "#E8E8E6", label: "Chưa làm" },
  TRE:      { dot: "#EF9F27", bg: "#FFFBEB", text: "#885800", badge: "#FDE68A", label: "Quá hạn" },
};

const DA_MAU: Record<string, string> = {
  DA1: "#378ADD", DA2: "#378ADD", RD: "#378ADD",
  DA3: "#534AB7", NAP: "#534AB7",
  DA4: "#EF9F27", BBC: "#EF9F27",
  DA5: "#0C447C", DC: "#0C447C",
  DA6: "#639922", PC: "#639922",
  DA7: "#444441", SXCN: "#444441",
  DA8: "#BA7517", VON: "#BA7517",
};

const UU_TIEN_LABEL: Record<string, string> = {
  THAP: "Thấp", TRUNG_BINH: "Trung bình", CAO: "Cao", KHAN_CAP: "Khẩn cấp",
};

function mauDuAn(ma: string): string {
  const prefix = ma?.replace(/[0-9,]/g, "").trim() ?? "";
  return DA_MAU[prefix] ?? DA_MAU[ma] ?? "#6B7280";
}

function soNgayTre(ngayKetThuc?: string | null, trangThai?: string): number {
  if (!ngayKetThuc || trangThai === "XONG") return 0;
  const han = new Date(ngayKetThuc);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - han.getTime()) / 86400000));
}

function ngayVN(d: Date): string {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function hienNgay(iso?: string | null): string {
  if (!iso) return "—";
  return ngayVN(new Date(iso));
}

function tinhTT(cv: CongViecItem): string {
  if (cv.trangThai === "XONG") return "XONG";
  if (cv.trangThai === "BI_CHAN") return "BI_CHAN";
  const tre = soNgayTre(cv.ngayKetThucThucTe ?? cv.ngayKetThuc, cv.trangThai);
  if (tre > 0) return "TRE";
  return cv.trangThai;
}

function tuanNay(): { tu: string; den: string } {
  const today = new Date();
  const tu = new Date(today);
  const den = new Date(today);
  den.setDate(den.getDate() + 14);
  return {
    tu: tu.toISOString().slice(0, 10),
    den: den.toISOString().slice(0, 10),
  };
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

const STATUS_PILLS = [
  { key: "DANG_LAM", label: "Đang làm", color: "#0C447C" },
  { key: "BI_CHAN", label: "Bị chặn", color: "#E24B4A" },
  { key: "TRE", label: "Quá hạn", color: "#EF9F27" },
  { key: "CHUA_LAM", label: "Chưa làm", color: "#888888" },
  { key: "XONG", label: "Xong rồi", color: "#008264" },
];

// ─── Task row ─────────────────────────────────────────────────────────────────

function HangCongViec({
  cv, active, onClick, onTrangThaiChange, onXoa, capQuyen,
}: {
  cv: CongViecItem;
  active: boolean;
  onClick: () => void;
  onTrangThaiChange: (id: string, tt: string) => void;
  onXoa?: (id: string, ten: string) => void;
  capQuyen?: string;
}) {
  const tt = tinhTT(cv);
  const style = TT_STYLE[tt] ?? TT_STYLE.CHUA_LAM;
  const tre = soNgayTre(cv.ngayKetThucThucTe ?? cv.ngayKetThuc, cv.trangThai);
  const [ddMo, setDdMo] = useState(false);
  const [hover, setHover] = useState(false);

  const coQuyenXoa = capQuyen === "QUAN_TRI_VIEN" || capQuyen === "TRUONG_NHOM";

  function doiTrangThai(trangThai: string) {
    setDdMo(false);
    onTrangThaiChange(cv.id, trangThai);
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px 8px 24px",
        minHeight: 48,
        background: active ? "#E1F5EE" : "transparent",
        borderLeft: active ? "3px solid #008264" : "3px solid transparent",
        cursor: "pointer", transition: "background 0.12s",
        position: "relative",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Status dot */}
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />

      {/* Tên + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cv.ten}
          {(cv.canTro?.length ?? 0) > 0 && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "#E24B4A" }}>⚡{cv.canTro!.length}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#9B9B98", display: "flex", gap: 8, marginTop: 1, flexWrap: "wrap" }}>
          {cv.nguoiPhuTrach && <span>{cv.nguoiPhuTrach.ten}</span>}
          {cv.ngayKetThuc && (
            <span style={{ color: tre > 0 ? "#EF4444" : "#9B9B98" }}>
              Hạn {hienNgay(cv.ngayKetThucThucTe ?? cv.ngayKetThuc)}
            </span>
          )}
          {tre > 0 && <span style={{ color: "#EF4444", fontWeight: 700 }}>Trễ {tre}d</span>}
        </div>
      </div>

      {/* Nút xóa (hover + role-gated) */}
      {coQuyenXoa && onXoa && hover && (
        <button
          onClick={e => { e.stopPropagation(); onXoa(cv.id, cv.ten); }}
          title="Xóa công việc"
          style={{
            padding: "3px 6px", borderRadius: 6, background: "none",
            border: "1px solid transparent", color: "#9CA3AF",
            cursor: "pointer", display: "flex", alignItems: "center",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2";
            (e.currentTarget as HTMLButtonElement).style.color = "#E24B4A";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#FECACA";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "none";
            (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
          }}
        >
          <Trash2 size={12} />
        </button>
      )}

      {/* Badge trạng thái + dropdown */}
      <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setDdMo(p => !p)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 5, border: "none",
            background: style.badge, color: style.text,
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {style.label}
          <ChevronDown size={10} />
        </button>
        {ddMo && (
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50,
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden", minWidth: 120,
          }}>
            {["CHUA_LAM", "DANG_LAM", "BI_CHAN", "XONG"].map(tt2 => (
              <div
                key={tt2}
                onClick={() => doiTrangThai(tt2)}
                style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#F3F4F6"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ""}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: TT_STYLE[tt2]?.dot }} />
                {TT_STYLE[tt2]?.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group header (bước) ──────────────────────────────────────────────────────

function NhomBuocRow({
  nhom, cvChonId, nguoiDungList, onCvClick, onTrangThaiChange, onThemCV, onXoaCV, capQuyen,
}: {
  nhom: NhomBuoc;
  cvChonId: string | null;
  nguoiDungList: NguoiDung[];
  onCvClick: (id: string) => void;
  onTrangThaiChange: (id: string, tt: string) => void;
  onThemCV: (buocId: string, cv: CongViecItem) => void;
  onXoaCV: (id: string, ten: string) => void;
  capQuyen?: string;
}) {
  const [mo, setMo] = useState(true);
  const [formMo, setFormMo] = useState(false);
  const buoc = nhom.buoc;
  const daMau = buoc?.duAn?.ma ? mauDuAn(buoc.duAn.ma) : "#6B7280";
  const soXong = nhom.congViec.filter(cv => cv.trangThai === "XONG").length;
  const tongSo = nhom.congViec.length;
  const phanTram = tongSo > 0 ? Math.round((soXong / tongSo) * 100) : 0;

  const trangThaiBuocStyle: Record<string, { bg: string; text: string }> = {
    CHUA_LAM: { bg: "#F5F5F3", text: "#555" },
    DANG_LAM: { bg: "#FDE68A", text: "#885800" },
    BI_CHAN: { bg: "#FCA5A5", text: "#991B1B" },
    XONG: { bg: "#A7F3D0", text: "#075740" },
  };
  const bStyle = trangThaiBuocStyle[buoc?.trangThai ?? "CHUA_LAM"] ?? trangThaiBuocStyle.CHUA_LAM;

  if (!buoc) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ padding: "8px 12px", fontSize: 12, color: "#9B9B98", fontStyle: "italic" }}>
          Công việc chưa gán bước
        </div>
        {nhom.congViec.map(cv => (
          <HangCongViec key={cv.id} cv={cv} active={cv.id === cvChonId} onClick={() => onCvClick(cv.id)} onTrangThaiChange={onTrangThaiChange} onXoa={onXoaCV} capQuyen={capQuyen} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header bước */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", background: "#FAFAFA",
        borderBottom: "1px solid #F0F0EE", borderTop: "1px solid #F0F0EE",
      }}>
        <button onClick={() => setMo(p => !p)} style={{ padding: 2, background: "none", border: "none", cursor: "pointer", color: "#9B9B98", display: "flex" }}>
          {mo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* DA badge */}
        <span style={{
          fontSize: 10, fontWeight: 800, color: "#fff",
          background: daMau, borderRadius: 4, padding: "1px 6px", flexShrink: 0,
        }}>
          {buoc.duAn?.ma ?? "—"}
        </span>

        {/* Tên bước */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {buoc.ma} — {buoc.ten}
        </span>

        {/* Progress */}
        <span style={{ fontSize: 11, color: "#6B7280", flexShrink: 0, whiteSpace: "nowrap" }}>{soXong}/{tongSo}</span>

        {/* Trạng thái badge */}
        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: bStyle.bg, color: bStyle.text, flexShrink: 0 }}>
          {TT_STYLE[buoc.trangThai]?.label ?? buoc.trangThai}
        </span>

        {/* Nút thêm */}
        <button
          onClick={e => { e.stopPropagation(); setFormMo(p => !p); setMo(true); }}
          style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 6, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#008264", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}
        >
          <Plus size={11} /> Thêm
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#F0F0EE" }}>
        <div style={{ height: "100%", width: `${phanTram}%`, background: daMau, transition: "width 0.3s" }} />
      </div>

      {/* Task list */}
      {mo && (
        <>
          {nhom.congViec.map(cv => (
            <HangCongViec
              key={cv.id} cv={cv}
              active={cv.id === cvChonId}
              onClick={() => onCvClick(cv.id)}
              onTrangThaiChange={onTrangThaiChange}
              onXoa={onXoaCV}
              capQuyen={capQuyen}
            />
          ))}
          {formMo && (
            <FormTaoViec
              buocId={buoc.id}
              onHuy={() => setFormMo(false)}
              onTao={cv => { onThemCV(buoc.id, cv as unknown as CongViecItem); setFormMo(false); }}
            />
          )}
          {!formMo && capQuyen !== "QUAN_SAT" && (
            <div
              onClick={() => setFormMo(true)}
              style={{ padding: "5px 24px", fontSize: 11, color: "#9B9B98", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.color = "#008264"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.color = "#9B9B98"}
            >
              <Plus size={11} /> Thêm công việc vào {buoc.ma}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Panel phải ───────────────────────────────────────────────────────────────

function PanelPhaiRong() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9B9B98", gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LayoutList size={26} color="#D1D5DB" />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>Chưa chọn công việc</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Click vào một công việc để xem chi tiết</div>
      </div>
    </div>
  );
}

interface DepItem { id: string; ten: string; trangThai: string; ngayKetThuc?: string | null; ngayKTMoi?: Date | null; soNgayLui?: number; nguoiPhuTrach?: NguoiDung | null; buocQuyTrinh?: { ma: string; ten: string } | null }

function PanelChiTietCV({
  cvId, onDong, onTrangThaiChange,
}: {
  cvId: string;
  onDong: () => void;
  onTrangThaiChange: (id: string, tt: string) => void;
}) {
  const { push: pushUndo } = useUndoRedoGlobal();
  const [tab, setTab] = useState<"chitiet" | "lienket">("chitiet");
  const [cv, setCv] = useState<CongViecItem | null>(null);
  const [dep, setDep] = useState<{ upstream: { direct: DepItem[] }; downstream: { direct: DepItem[] }; soNgayTreHienTai: number } | null>(null);
  const [dang, setDang] = useState(true);
  const [dangDep, setDangDep] = useState(false);
  const [capNhatHanMo, setCapNhatHanMo] = useState(false);
  const [hanMoi, setHanMoi] = useState("");

  useEffect(() => {
    setDang(true);
    setDep(null);
    goiApi(`/api/cong-viec/${cvId}`)
      .then(data => { setCv(data); setDang(false); })
      .catch(() => setDang(false));
  }, [cvId]);

  useEffect(() => {
    if (tab !== "lienket") return;
    setDangDep(true);
    goiApi(`/api/cong-viec/${cvId}/dependency`)
      .then(data => { setDep(data); setDangDep(false); })
      .catch(() => setDangDep(false));
  }, [cvId, tab]);

  function doiTT(trangThai: string) {
    if (!cv || cv.trangThai === trangThai) return;
    onTrangThaiChange(cvId, trangThai);
    setCv(prev => prev ? { ...prev, trangThai } : prev);
  }

  async function capNhatHan() {
    if (!hanMoi || !cv) return;
    const oldHan = cv.ngayKetThucThucTe ?? cv.ngayKetThuc;
    const newIso = new Date(hanMoi).toISOString();
    try {
      await goiApi(`/api/cong-viec/${cvId}/cap-nhat-timeline`, {
        method: "POST",
        body: JSON.stringify({ ngayKetThucMoi: hanMoi, lyDo: "Cập nhật từ trang Công việc" }),
      });
      setCv(prev => prev ? { ...prev, ngayKetThucThucTe: newIso } : prev);
      setCapNhatHanMo(false);
      const capturedOld = oldHan;
      const capturedNew = hanMoi;
      const capturedCvId = cvId;
      pushUndo({
        type: "CONG_VIEC_DOI_HAN",
        label: "hạn công việc",
        rollback: async () => {
          if (capturedOld) {
            await goiApi(`/api/cong-viec/${capturedCvId}/cap-nhat-timeline`, {
              method: "POST",
              body: JSON.stringify({ ngayKetThucMoi: capturedOld.slice(0, 10), lyDo: "Hoàn tác đổi hạn" }),
            });
          }
        },
        reapply: async () => {
          await goiApi(`/api/cong-viec/${capturedCvId}/cap-nhat-timeline`, {
            method: "POST",
            body: JSON.stringify({ ngayKetThucMoi: capturedNew, lyDo: "Làm lại đổi hạn" }),
          });
        },
      });
    } catch { /* ignore */ }
  }

  if (dang) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Loader2 size={24} style={{ color: "#008264", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!cv) return <PanelPhaiRong />;

  const tt = tinhTT(cv);
  const ttStyle = TT_STYLE[tt] ?? TT_STYLE.CHUA_LAM;
  const tre = soNgayTre(cv.ngayKetThucThucTe ?? cv.ngayKetThuc, cv.trangThai);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: `2px solid ${ttStyle.dot}`, background: ttStyle.bg }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: ttStyle.text, background: ttStyle.badge, borderRadius: 4, padding: "1px 7px" }}>{ttStyle.label}</span>
              {tre > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#EF4444", borderRadius: 4, padding: "1px 7px" }}>Trễ {tre}d</span>}
              {cv.mucUuTien !== "TRUNG_BINH" && (
                <span style={{ fontSize: 10, color: "#EF9F27", background: "#FDE68A", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                  <Flag size={9} style={{ display: "inline", marginRight: 2 }} />{UU_TIEN_LABEL[cv.mucUuTien]}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.35 }}>{cv.ten}</div>
            {cv.buocQuyTrinh && (
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>
                {cv.buocQuyTrinh.ma} — {cv.buocQuyTrinh.ten}
              </div>
            )}
          </div>
          <button onClick={onDong} style={{ padding: 5, background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 6, cursor: "pointer", color: "#555", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* 3 nút action */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => doiTT("XONG")}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: "#008264", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            <CheckCircle2 size={12} /> Xong rồi
          </button>
          <button
            onClick={() => doiTT("BI_CHAN")}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: "#E24B4A", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            <AlertCircle size={12} /> Báo chặn
          </button>
          <button
            onClick={() => setCapNhatHanMo(p => !p)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: "#EF9F27", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            <Calendar size={12} /> Đổi hạn
          </button>
        </div>

        {/* Inline date picker */}
        {capNhatHanMo && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
            <input type="date" value={hanMoi} onChange={e => setHanMoi(e.target.value)} style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit" }} />
            <button onClick={capNhatHan} disabled={!hanMoi} style={{ padding: "4px 10px", borderRadius: 6, background: "#008264", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Lưu</button>
            <button onClick={() => setCapNhatHanMo(false)} style={{ padding: "4px 10px", borderRadius: 6, background: "none", border: "1px solid #D1D5DB", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Hủy</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>
        {(["chitiet", "lienket"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ padding: "8px 16px", fontSize: 12, fontWeight: tab === t ? 700 : 500, color: tab === t ? "#008264" : "#6B7280", background: "none", border: "none", cursor: "pointer", borderBottom: tab === t ? "2px solid #008264" : "2px solid transparent", fontFamily: "inherit" }}
          >
            {t === "chitiet" ? "Chi tiết" : "Liên kết & Tác động"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "chitiet" && (
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <InfoField icon={<Users size={13} />} label="Người phụ trách">{cv.nguoiPhuTrach?.ten ?? "Chưa chỉ định"}</InfoField>
            <InfoField icon={<Clock size={13} />} label="Hạn kế hoạch">
              {hienNgay(cv.ngayBatDau)} → {hienNgay(cv.ngayKetThuc)}
              {(cv.ngayKetThucThucTe && cv.ngayKetThucThucTe !== cv.ngayKetThuc) && (
                <span style={{ marginLeft: 6, color: "#EF4444", fontWeight: 600, fontSize: 11 }}>
                  Thực tế: {hienNgay(cv.ngayKetThucThucTe)}
                </span>
              )}
            </InfoField>
            {cv.duAn && <InfoField icon={<BarChart2 size={13} />} label="Dự án">{cv.duAn.ma} — {cv.duAn.ten}</InfoField>}
            {cv.sanPham && <InfoField icon={<Flag size={13} />} label="Sản phẩm">{cv.sanPham.ten}</InfoField>}
            {cv.dinhNghiaHoanThanh && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9B9B98", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Khi nào coi là xong</div>
                <div style={{ fontSize: 12, color: "#374151", padding: "8px 10px", background: "#F9FAFB", borderRadius: 7, lineHeight: 1.5 }}>{cv.dinhNghiaHoanThanh}</div>
              </div>
            )}
            {cv.moTa && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9B9B98", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Mô tả</div>
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{cv.moTa}</div>
              </div>
            )}
            {(cv.canTro?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#E24B4A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Cản trở đang mở</div>
                {cv.canTro!.map(ct => (
                  <div key={ct.id} style={{ padding: "6px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#991B1B" }}>{ct.ten}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "lienket" && (
          <div style={{ padding: "14px 16px" }}>
            {dangDep ? (
              <div style={{ textAlign: "center", padding: 24, color: "#9B9B98", fontSize: 13 }}>
                <Loader2 size={18} style={{ color: "#008264", animation: "spin 1s linear infinite", marginBottom: 6 }} />
                <div>Đang tải dữ liệu phụ thuộc...</div>
              </div>
            ) : dep ? (
              <>
                {/* Upstream */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    ⬆ Việc trước tôi ({dep.upstream.direct.length})
                  </div>
                  {dep.upstream.direct.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#9B9B98", fontStyle: "italic" }}>Không có việc phụ thuộc</div>
                  ) : (
                    dep.upstream.direct.map(u => {
                      const uTre = soNgayTre(u.ngayKetThuc, u.trangThai);
                      const uStyle = TT_STYLE[u.trangThai] ?? TT_STYLE.CHUA_LAM;
                      return (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "1px solid #E5E7EB", marginBottom: 5, background: uTre > 0 ? "#FFFBEB" : "#FAFAFA" }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: uStyle.dot, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.ten}</div>
                            <div style={{ fontSize: 10, color: "#9B9B98", display: "flex", gap: 8 }}>
                              {u.nguoiPhuTrach?.ten} · Hạn {hienNgay(u.ngayKetThuc)}
                              {uTre > 0 && <span style={{ color: "#EF4444", fontWeight: 700 }}>Trễ {uTre}d ⚠</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, color: uStyle.text, background: uStyle.badge, borderRadius: 4, padding: "1px 5px", fontWeight: 600, flexShrink: 0 }}>{uStyle.label}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Downstream */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    ⬇ Việc sau tôi ({dep.downstream.direct.length})
                  </div>
                  {dep.downstream.direct.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#9B9B98", fontStyle: "italic" }}>Không có việc phụ thuộc</div>
                  ) : (
                    dep.downstream.direct.map(d => {
                      const dStyle = TT_STYLE[d.trangThai] ?? TT_STYLE.CHUA_LAM;
                      return (
                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "1px solid #E5E7EB", marginBottom: 5, background: "#FAFAFA" }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: dStyle.dot, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.ten}</div>
                            <div style={{ fontSize: 10, color: "#9B9B98", display: "flex", gap: 8 }}>
                              {d.nguoiPhuTrach?.ten} · Hạn {hienNgay(d.ngayKetThuc)}
                              {dep.soNgayTreHienTai > 0 && d.ngayKTMoi && (
                                <span style={{ color: "#EF9F27" }}>→ {ngayVN(new Date(d.ngayKTMoi))} nếu tôi trễ {dep.soNgayTreHienTai}d</span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, color: dStyle.text, background: dStyle.badge, borderRadius: 4, padding: "1px 5px", fontWeight: 600, flexShrink: 0 }}>{dStyle.label}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Nút hành động */}
                {dep.soNgayTreHienTai > 0 && (
                  <div style={{ padding: "10px", background: "#FEF3C7", borderRadius: 8, border: "1px solid #FDE68A", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: "#885800", fontWeight: 600, marginBottom: 6 }}>
                      ⚠ Công việc này đang trễ {dep.soNgayTreHienTai} ngày
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={async () => {
                          await goiApi(`/api/cong-viec/${cvId}/notify-downstream`, { method: "POST", body: "{}" });
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: "#E24B4A", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <Bell size={11} /> Thông báo xuôi dòng
                      </button>
                      <button
                        onClick={() => setCapNhatHanMo(true)}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: "#EF9F27", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <Calendar size={11} /> Cập nhật hạn + tính lại
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: "#9B9B98", fontSize: 12 }}>Không tải được dữ liệu</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ color: "#9B9B98", paddingTop: 1, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9B9B98", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: "#1A1A1A" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Kanban view ──────────────────────────────────────────────────────────────

function KanbanView({
  nhomList, onCvClick, cvChonId,
}: {
  nhomList: NhomBuoc[];
  onCvClick: (id: string) => void;
  cvChonId: string | null;
}) {
  const tatCaCV = nhomList.flatMap(n => n.congViec);
  const cols = [
    { key: "CHUA_LAM", label: "Chưa làm", color: "#888888" },
    { key: "DANG_LAM", label: "Đang làm", color: "#0C447C" },
    { key: "BI_CHAN", label: "Bị chặn", color: "#E24B4A" },
    { key: "XONG", label: "Xong rồi", color: "#008264" },
  ];

  return (
    <div style={{ display: "flex", gap: 10, padding: "0 8px", height: "100%", overflowX: "auto" }}>
      {cols.map(col => {
        const cvs = tatCaCV.filter(cv =>
          col.key === "XONG" ? cv.trangThai === "XONG"
          : col.key === "BI_CHAN" ? cv.trangThai === "BI_CHAN"
          : col.key === "DANG_LAM" ? cv.trangThai === "DANG_LAM"
          : cv.trangThai === "CHUA_LAM"
        );
        return (
          <div key={col.key} style={{ flex: "0 0 220px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 4px", marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A" }}>{col.label}</span>
              <span style={{ fontSize: 11, color: "#9B9B98", marginLeft: "auto" }}>{cvs.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {cvs.map(cv => {
                const tre = soNgayTre(cv.ngayKetThucThucTe ?? cv.ngayKetThuc, cv.trangThai);
                return (
                  <div
                    key={cv.id}
                    onClick={() => onCvClick(cv.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: cv.id === cvChonId ? `2px solid #008264` : "1px solid #E5E7EB",
                      background: cv.id === cvChonId ? "#E1F5EE" : "#fff",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", marginBottom: 5, lineHeight: 1.3 }}>{cv.ten}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {cv.nguoiPhuTrach && (
                        <span style={{ fontSize: 10, color: "#6B7280", display: "flex", alignItems: "center", gap: 2 }}>
                          <Users size={9} /> {cv.nguoiPhuTrach.ten}
                        </span>
                      )}
                      {cv.ngayKetThuc && (
                        <span style={{ fontSize: 10, color: tre > 0 ? "#EF4444" : "#9B9B98", display: "flex", alignItems: "center", gap: 2 }}>
                          <Clock size={9} /> {hienNgay(cv.ngayKetThuc)}
                        </span>
                      )}
                      {tre > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#EF4444", borderRadius: 4, padding: "1px 5px" }}>+{tre}d</span>}
                    </div>
                    {cv.buocQuyTrinh && (
                      <div style={{ marginTop: 5, fontSize: 10, color: "#9B9B98" }}>{cv.buocQuyTrinh.ma}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CongViec() {
  const user = useAppStore(s => s.user);
  const capQuyen = (user as unknown as { role?: string })?.role ?? "";
  const { push: pushUndo } = useUndoRedoGlobal();
  const { tu: tuDf, den: denDf } = tuanNay();

  const [nhomList, setNhomList] = useState<NhomBuoc[]>([]);
  const [duAnList, setDuAnList] = useState<DuAn[]>([]);
  const [nguoiDungList, setNguoiDungList] = useState<NguoiDung[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [cvChonId, setCvChonId] = useState<string | null>(null);
  const [view, setView] = useState<"danh-sach" | "bang-cot">("danh-sach");

  // Xóa công việc
  const [xoaModal, setXoaModal] = useState<{ id: string; ten: string } | null>(null);
  // Undo toast sau khi xóa
  const [undoToast, setUndoToast] = useState<{ id: string; ten: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Filter state
  const [filterToi, setFilterToi] = useState(true);
  const [filterDuAnId, setFilterDuAnId] = useState("");
  const [filterTuNgay, setFilterTuNgay] = useState(tuDf);
  const [filterDenNgay, setFilterDenNgay] = useState(denDf);
  const [filterTrangThai, setFilterTrangThai] = useState<Set<string>>(new Set(["DANG_LAM", "BI_CHAN"]));

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ─── Socket realtime ───────────────────────────────────────────────────────
  const currentDuAnId = filterDuAnId || nhomList[0]?.buoc?.duAn?.id || "";
  dungSocket({
    duAnId: currentDuAnId,
    onCongViecMoi: (cv) => {
      setNhomList(prev => prev.map(nhom => {
        if (nhom.buoc?.id !== cv.buocQuyTrinh?.id) return nhom;
        const exists = nhom.congViec.some(c => c.id === cv.id);
        if (exists) return nhom;
        return { ...nhom, congViec: [...nhom.congViec, cv as unknown as CongViecItem] };
      }));
    },
    onCapNhatCongViec: (cv) => {
      setNhomList(prev => prev.map(nhom => ({
        ...nhom,
        congViec: nhom.congViec.map(c => c.id === cv.id ? { ...c, ...(cv as unknown as Partial<CongViecItem>) } : c),
      })));
    },
    onXoaCongViec: (data) => {
      setNhomList(prev => prev.map(nhom => ({
        ...nhom,
        congViec: nhom.congViec.filter(c => c.id !== data.id),
      })));
    },
  });

  // ─── Hàm xóa công việc (mở modal) ────────────────────────────────────────
  function moModalXoa(id: string, ten: string) {
    setXoaModal({ id, ten });
  }

  function xoaKhoiDanhSach(id: string, ten: string) {
    if (cvChonId === id) setCvChonId(null);
    setNhomList(prev => prev.map(nhom => ({
      ...nhom,
      congViec: nhom.congViec.filter(c => c.id !== id),
    })));

    // Undo toast 5s
    const timer = setTimeout(() => {
      setUndoToast(null);
    }, 5000);
    setUndoToast(prev => {
      if (prev) clearTimeout(prev.timer);
      return { id, ten, timer };
    });
  }

  async function khoiPhucCV(id: string) {
    if (!undoToast) return;
    clearTimeout(undoToast.timer);
    setUndoToast(null);
    try {
      await goiApi(`/api/cong-viec/${id}/khoi-phuc`, { method: "POST" });
      setRefreshKey(k => k + 1);
    } catch {
      // ignore
    }
  }

  const taiDuLieu = useCallback(async () => {
    setDangTai(true);
    try {
      const params = new URLSearchParams({ grouped: "buoc" });
      if (filterToi && user?.id) params.set("inchargeId", user.id);
      if (filterDuAnId) params.set("duAnId", filterDuAnId);
      if (filterTuNgay) params.set("tuNgay", filterTuNgay);
      if (filterDenNgay) params.set("denNgay", filterDenNgay);

      // Lọc trạng thái (bỏ TRE vì đó là computed)
      const ttList = [...filterTrangThai].filter(t => t !== "TRE");
      if (ttList.length > 0 && ttList.length < 4) {
        params.set("trangThai", ttList.join(","));
      }

      const data: NhomBuoc[] = await goiApi(`/api/cong-viec?${params}`);

      // Lọc quá hạn (TRE) nếu cần
      if (filterTrangThai.has("TRE") && !filterTrangThai.has("DANG_LAM")) {
        setNhomList(data.map(nhom => ({
          ...nhom,
          congViec: nhom.congViec.filter(cv => soNgayTre(cv.ngayKetThucThucTe ?? cv.ngayKetThuc, cv.trangThai) > 0),
        })).filter(nhom => nhom.congViec.length > 0));
      } else {
        setNhomList(data);
      }
    } catch { /* ignore */ } finally {
      setDangTai(false);
    }
  }, [filterToi, filterDuAnId, filterTuNgay, filterDenNgay, filterTrangThai, user?.id]);

  useEffect(() => {
    taiDuLieu();
  }, [taiDuLieu, refreshKey]);

  // Auto refresh 3 phút
  useEffect(() => {
    refreshInterval.current = setInterval(() => setRefreshKey(k => k + 1), 3 * 60 * 1000);
    return () => clearInterval(refreshInterval.current);
  }, []);

  // Load meta (danh sách DA + người dùng)
  useEffect(() => {
    goiApi("/api/du-an").then(setDuAnList).catch(() => {});
    goiApi("/api/nguoi-dung").then(setNguoiDungList).catch(() => {});
  }, []);

  function toggleTT(tt: string) {
    setFilterTrangThai(prev => {
      const next = new Set(prev);
      if (next.has(tt)) next.delete(tt); else next.add(tt);
      return next;
    });
  }

  async function doiTrangThaiCV(id: string, trangThai: string) {
    let oldTT = trangThai;
    for (const nhom of nhomList) {
      const cv = nhom.congViec.find(c => c.id === id);
      if (cv) { oldTT = cv.trangThai; break; }
    }
    if (oldTT === trangThai) return;

    // Optimistic UI update
    setNhomList(prev => prev.map(nhom => ({
      ...nhom,
      congViec: nhom.congViec.map(cv => cv.id === id ? { ...cv, trangThai } : cv),
    })));

    try {
      await goiApi(`/api/cong-viec/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ trangThai }),
      });
      // Push undo AFTER successful API call
      const capturedOld = oldTT;
      const capturedNew = trangThai;
      pushUndo({
        type: "CONG_VIEC_DOI_TRANG_THAI",
        label: "trạng thái công việc",
        rollback: async () => {
          setNhomList(prev => prev.map(nhom => ({
            ...nhom,
            congViec: nhom.congViec.map(cv => cv.id === id ? { ...cv, trangThai: capturedOld } : cv),
          })));
          await goiApi(`/api/cong-viec/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ trangThai: capturedOld }),
          });
        },
        reapply: async () => {
          setNhomList(prev => prev.map(nhom => ({
            ...nhom,
            congViec: nhom.congViec.map(cv => cv.id === id ? { ...cv, trangThai: capturedNew } : cv),
          })));
          await goiApi(`/api/cong-viec/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ trangThai: capturedNew }),
          });
        },
      });
    } catch {
      // Revert on failure
      setNhomList(prev => prev.map(nhom => ({
        ...nhom,
        congViec: nhom.congViec.map(cv => cv.id === id ? { ...cv, trangThai: oldTT } : cv),
      })));
    }
  }

  function themCVVaoBuoc(buocId: string, cv: CongViecItem) {
    setNhomList(prev => prev.map(nhom => {
      if (nhom.buoc?.id !== buocId) return nhom;
      return { ...nhom, congViec: [...nhom.congViec, cv] };
    }));
  }

  const tatCaCV = nhomList.flatMap(n => n.congViec);
  const soBiChan = tatCaCV.filter(cv => cv.trangThai === "BI_CHAN").length;
  const soCV = tatCaCV.length;

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      fontFamily: "'DM Sans', sans-serif", background: "#F9FAFB",
    }}>
      {/* ── Filter bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Hàng 1 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Toggle Của tôi / Tất cả */}
          <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 2 }}>
            {["Của tôi", "Tất cả"].map((label, i) => {
              const active = i === 0 ? filterToi : !filterToi;
              return (
                <button
                  key={label}
                  onClick={() => setFilterToi(i === 0)}
                  style={{ padding: "4px 12px", borderRadius: 6, background: active ? "#fff" : "transparent", border: active ? "1px solid #E5E7EB" : "1px solid transparent", fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#1A1A1A" : "#6B7280", cursor: "pointer", fontFamily: "inherit", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.07)" : "none" }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Dropdown dự án */}
          <select
            value={filterDuAnId}
            onChange={e => setFilterDuAnId(e.target.value)}
            style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontFamily: "inherit", background: "#fff", color: "#1A1A1A" }}
          >
            <option value="">Tất cả dự án</option>
            {duAnList.map(da => <option key={da.id} value={da.id}>{da.ma} — {da.ten}</option>)}
          </select>

          {/* Date range */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="date" value={filterTuNgay} onChange={e => setFilterTuNgay(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 8px", fontSize: 12, fontFamily: "inherit" }} />
            <ArrowRight size={12} color="#9B9B98" />
            <input type="date" value={filterDenNgay} onChange={e => setFilterDenNgay(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 8px", fontSize: 12, fontFamily: "inherit" }} />
          </div>

          {/* Đếm + refresh */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {!dangTai && (
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                <strong style={{ color: "#1A1A1A" }}>{soCV}</strong> việc
                {soBiChan > 0 && <span style={{ color: "#E24B4A", fontWeight: 700 }}> · {soBiChan} bị chặn</span>}
              </span>
            )}
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              style={{ padding: 5, borderRadius: 7, background: "#F3F4F6", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <RefreshCw size={13} color="#6B7280" />
            </button>

            {/* View toggle */}
            <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 2 }}>
              <button onClick={() => setView("danh-sach")} style={{ padding: "4px 8px", borderRadius: 6, background: view === "danh-sach" ? "#fff" : "transparent", border: view === "danh-sach" ? "1px solid #E5E7EB" : "1px solid transparent", cursor: "pointer", display: "flex" }}>
                <LayoutList size={13} color={view === "danh-sach" ? "#008264" : "#9B9B98"} />
              </button>
              <button onClick={() => setView("bang-cot")} style={{ padding: "4px 8px", borderRadius: 6, background: view === "bang-cot" ? "#fff" : "transparent", border: view === "bang-cot" ? "1px solid #E5E7EB" : "1px solid transparent", cursor: "pointer", display: "flex" }}>
                <Columns size={13} color={view === "bang-cot" ? "#008264" : "#9B9B98"} />
              </button>
            </div>
          </div>
        </div>

        {/* Hàng 2 — Pills trạng thái */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Filter size={12} color="#9B9B98" />
          {STATUS_PILLS.map(p => {
            const on = filterTrangThai.has(p.key);
            return (
              <button
                key={p.key}
                onClick={() => toggleTT(p.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 20,
                  background: on ? p.color + "20" : "#F3F4F6",
                  border: `1.5px solid ${on ? p.color : "transparent"}`,
                  color: on ? p.color : "#9B9B98",
                  fontSize: 11, fontWeight: on ? 700 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.12s",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: on ? p.color : "#D1D5DB" }} />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left — 50% */}
        <div style={{ width: "50%", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {dangTai ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, color: "#9B9B98" }}>
                <Loader2 size={24} style={{ color: "#008264", animation: "spin 1s linear infinite", marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>Đang tải công việc...</div>
              </div>
            ) : nhomList.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9B9B98" }}>
                <BarChart2 size={32} style={{ marginBottom: 10, color: "#D1D5DB" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>Không có công việc</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Thử thay đổi bộ lọc hoặc mở rộng khoảng thời gian</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                  <button
                    onClick={() => { setFilterTrangThai(new Set(STATUS_PILLS.map(p => p.key))); }}
                    style={{ padding: "6px 14px", borderRadius: 8, background: "#008264", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Xóa filter
                  </button>
                  <button
                    onClick={() => { const den = new Date(); den.setDate(den.getDate() + 30); setFilterDenNgay(den.toISOString().slice(0, 10)); }}
                    style={{ padding: "6px 14px", borderRadius: 8, background: "none", border: "1px solid #E5E7EB", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Mở rộng 30 ngày
                  </button>
                </div>
              </div>
            ) : view === "danh-sach" ? (
              nhomList.map((nhom, idx) => (
                <NhomBuocRow
                  key={nhom.buoc?.id ?? `no-buoc-${idx}`}
                  nhom={nhom}
                  cvChonId={cvChonId}
                  nguoiDungList={nguoiDungList}
                  onCvClick={id => setCvChonId(prev => prev === id ? null : id)}
                  onTrangThaiChange={doiTrangThaiCV}
                  onThemCV={themCVVaoBuoc}
                  onXoaCV={moModalXoa}
                  capQuyen={capQuyen}
                />
              ))
            ) : (
              <KanbanView nhomList={nhomList} onCvClick={id => setCvChonId(prev => prev === id ? null : id)} cvChonId={cvChonId} />
            )}
          </div>
        </div>

        {/* Right — 50% */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
          {cvChonId ? (
            <PanelChiTietCV
              cvId={cvChonId}
              onDong={() => setCvChonId(null)}
              onTrangThaiChange={doiTrangThaiCV}
            />
          ) : (
            <PanelPhaiRong />
          )}
        </div>
      </div>

      {/* Modal xóa công việc */}
      {xoaModal && (
        <XoaCongViecModal
          congViecId={xoaModal.id}
          tenCongViec={xoaModal.ten}
          onHuy={() => setXoaModal(null)}
          onXoaThanhCong={() => {
            xoaKhoiDanhSach(xoaModal.id, xoaModal.ten);
            setXoaModal(null);
          }}
        />
      )}

      {/* Undo toast sau khi xóa */}
      {undoToast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1A1A1A", color: "#fff", borderRadius: 12,
          padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 9999,
          fontSize: 13, fontFamily: "'DM Sans', sans-serif",
          animation: "slideUp 0.2s ease",
        }}>
          <Trash2 size={14} color="#F87171" />
          <span>Đã xóa "<strong>{undoToast.ten}</strong>"</span>
          <button
            onClick={() => khoiPhucCV(undoToast.id)}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 7,
              background: "#008264", color: "#fff",
              border: "none", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <RotateCcw size={11} /> Hoàn tác
          </button>
          <button
            onClick={() => { clearTimeout(undoToast.timer); setUndoToast(null); }}
            style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 2, display: "flex" }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
