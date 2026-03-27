/**
 * SanPham — Quản lý 13 SKU ATK
 * % tiến độ tính realtime từ trạng thái Buoc, không đọc từ Excel.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, RefreshCw, ChevronRight, Loader2, ZapOff,
  Clock, Sparkles, X, CheckCircle, RotateCcw, AlertOctagon, Circle,
} from "lucide-react";

// ─── Hằng số màu ─────────────────────────────────────────────────────────────

const NHOM_MAU: Record<string, string> = {
  rd:        "#378ADD",
  nap:       "#534AB7",
  baoBi:     "#EF9F27",
  phapChe:   "#639922",
  sxcn:      "#888888",
};
const NHOM_TEN: Record<string, string> = {
  rd: "R&D", nap: "Nắp", baoBi: "Bao bì", phapChe: "Pháp chế", sxcn: "SXCN",
};
const NHOM_TRONG_SO: Record<string, string> = {
  rd: "30%", nap: "25%", baoBi: "20%", phapChe: "15%", sxcn: "10%",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SanPhamItem {
  id: string; maSp: string; ten: string; kenh: string;
  huongVi: string | null; dungTichMl: number | null; phLevel: number | null;
  ngayLaunch: string | null;
  tongTienDo: number; trangThaiTong: string; conNgay: number | null;
  duAn: { id: string; ma: string; ten: string };
  nguoiPhuTrach: { id: string; ten: string } | null;
}

interface ChiTietBuoc {
  id: string; ma: string; ten: string;
  trangThai: string; ngayKetThuc: string | null; ngayBatDau: string | null;
  nguoiPhuTrach: { id: string; ten: string } | null;
}

interface NhomBuoc {
  rd: ChiTietBuoc[]; nap: ChiTietBuoc[];
  baoBiChai: ChiTietBuoc[]; baoBiNhan: ChiTietBuoc[];
  phapChe: ChiTietBuoc[]; sxcn: ChiTietBuoc[];
}

interface ChiTietTienDo {
  sanPhamId: string; maSp: string; ten: string; kenh: string;
  tongTienDo: number; trangThaiTong: string; conNgay: number | null;
  chiTiet: {
    rd:      { phanTram: number; buocXong: number; tongBuoc: number; buocHienTai: string | null };
    nap:     { phanTram: number; buocHienTai: string | null; tongBuoc: 13 };
    baoBi:   { phanTram: number; buocXong: number; tongBuoc: number; chiTiet: {
                 chai: { phanTram: number; buocXong: number; tongBuoc: number };
                 nhan: { phanTram: number; buocXong: number; tongBuoc: number };
               } };
    phapChe: { phanTram: number; buocXong: number; tongBuoc: number };
    sxcn:    { phanTram: number; buocXong: number; tongBuoc: number };
  };
  canTroHienTai: Array<{
    id: string; ten: string; mucDo: string; trangThai: string; ngayPhatSinh: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function goiApi(url: string, options?: RequestInit) {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function badgeTrangThai(ts: string): { bg: string; text: string; icon: string } {
  if (ts.includes("Bị cản trở") || ts.includes("cản trở"))
    return { bg: "#FCEBEB", text: "#991B1B", icon: "🔴" };
  if (ts.includes("Nguy hiểm") || ts.includes("nguy hiểm"))
    return { bg: "#FCEBEB", text: "#991B1B", icon: "🔴" };
  if (ts.includes("Rủi ro"))
    return { bg: "#FAEEDA", text: "#92400E", icon: "🟡" };
  if (ts.includes("Chưa bắt đầu"))
    return { bg: "#F3F4F6", text: "#6B7280", icon: "⚪" };
  return { bg: "#E1F5EE", text: "#065F46", icon: "🟢" };
}

function mauConNgay(n: number | null): { color: string; bold: boolean; pulse: boolean } {
  if (n === null) return { color: "#9B9B98", bold: false, pulse: false };
  if (n <= 0)   return { color: "#E24B4A", bold: true, pulse: true };
  if (n < 14)   return { color: "#E24B4A", bold: true, pulse: true };
  if (n < 30)   return { color: "#EF9F27", bold: true, pulse: false };
  return { color: "#008264", bold: false, pulse: false };
}

function ngayVN(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function gioVN(d: Date): string {
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

const KENH_LABEL: Record<string, string> = { HT: "Hệ Thống", TT: "Truyền Thống" };
const MUCDO_VI: Record<string, string> = {
  RAT_NGHIEM_TRONG: "Rất nghiêm trọng", VUA_PHAI: "Vừa phải", NHE: "Nhẹ",
};

const TRANG_THAI_FILTER: Record<string, string> = {
  "": "Tất cả trạng thái",
  "Chạy mượt": "🟢 Chạy mượt",
  "Rủi ro": "🟡 Rủi ro",
  "cản trở": "🔴 Bị cản trở",
};

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color, h = 6 }: { pct: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, background: "#EBEBEA", borderRadius: 999, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`,
        background: pct === 0 ? "#D0D0CE" : color,
        borderRadius: 999, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
      }} />
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #E0E0DD",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 20, borderRadius: 6, background: "#EBEBEA", animation: "pulse 1.4s ease-in-out infinite" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ height: 10, width: "70%", borderRadius: 4, background: "#EBEBEA", animation: "pulse 1.4s ease-in-out infinite" }} />
              <div style={{ height: 14, width: "90%", borderRadius: 4, background: "#EBEBEA", animation: "pulse 1.4s ease-in-out infinite" }} />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ height: 8, width: "40%", borderRadius: 4, background: "#EBEBEA", animation: "pulse 1.4s ease-in-out infinite" }} />
                <div style={{ height: 8, width: 20, borderRadius: 4, background: "#EBEBEA", animation: "pulse 1.4s ease-in-out infinite" }} />
              </div>
              <div style={{ height: 4, borderRadius: 999, background: "#EBEBEA", animation: "pulse 1.4s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── BuocIcon ─────────────────────────────────────────────────────────────────

function BuocIcon({ tt }: { tt: string }) {
  if (tt === "XONG")     return <CheckCircle size={13} style={{ color: "#1D9E75", flexShrink: 0 }} />;
  if (tt === "DANG_LAM") return <RotateCcw  size={13} style={{ color: "#378ADD", flexShrink: 0, animation: "spin 2s linear infinite" }} />;
  if (tt === "BI_CHAN")  return <AlertOctagon size={13} style={{ color: "#E24B4A", flexShrink: 0 }} />;
  return <Circle size={13} style={{ color: "#C0C0BE", flexShrink: 0 }} />;
}

function mauBuoc(tt: string): string {
  if (tt === "XONG")     return "#1A1A1A";
  if (tt === "DANG_LAM") return "#1A5FA3";
  if (tt === "BI_CHAN")  return "#B91C1C";
  return "#9B9B98";
}

function labelBuoc(tt: string): string {
  if (tt === "XONG")     return "Xong";
  if (tt === "DANG_LAM") return "Đang làm";
  if (tt === "BI_CHAN")  return "Bị chặn";
  return "Chưa làm";
}

// ─── CardSanPham ─────────────────────────────────────────────────────────────

interface CardProps {
  sp: SanPhamItem;
  isSelected: boolean;
  onClick: () => void;
}

function CardSanPham({ sp, isSelected, onClick }: CardProps) {
  const ts   = badgeTrangThai(sp.trangThaiTong);
  const cn   = mauConNgay(sp.conNgay);
  const kenh = sp.kenh;

  const nhoms = [
    { key: "rd",      pct: 0 },
    { key: "nap",     pct: 0 },
    { key: "baoBi",   pct: 0 },
    { key: "phapChe", pct: 0 },
    { key: "sxcn",    pct: 0 },
  ];
  // Note: Individual group % not in list — shown as total only in card
  // Full breakdown is in detail panel

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: `${isSelected ? 2 : 1}px solid ${isSelected ? "#008264" : "#E0E0DD"}`,
        borderRadius: 14, padding: "14px 15px", cursor: "pointer",
        boxShadow: isSelected
          ? "0 0 0 3px rgba(0,130,100,0.12), 0 4px 16px rgba(0,0,0,0.08)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "all 0.15s ease",
        fontFamily: "'DM Sans', sans-serif",
        display: "flex", flexDirection: "column", gap: 10,
        userSelect: "none",
      }}
    >
      {/* Row 1: Kênh badge + tên */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{
          flexShrink: 0, padding: "3px 7px", borderRadius: 7, fontSize: 10, fontWeight: 800,
          background: kenh === "HT" ? "#008264" : "#534AB7", color: "#fff",
          letterSpacing: "0.04em",
        }}>
          {kenh}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#9B9B98", marginBottom: 1 }}>
            {sp.maSp}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.35 }}>
            {sp.ten}
          </div>
        </div>
      </div>

      {/* Thông số */}
      {(sp.huongVi || sp.dungTichMl || sp.phLevel) && (
        <div style={{ fontSize: 10, color: "#9B9B98", lineHeight: 1.4 }}>
          {[
            sp.huongVi || null,
            sp.dungTichMl ? `${sp.dungTichMl}ml` : null,
            sp.phLevel ? `pH ${sp.phLevel}` : null,
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* % tổng + nhóm */}
      <ProgressoNhom sp={sp} />

      {/* Footer: Ngày launch + trạng thái */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        {sp.ngayLaunch ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 10,
            color: cn.color, fontWeight: cn.bold ? 700 : 400,
            animation: cn.pulse ? "blink 1.5s ease-in-out infinite" : "none",
          }}>
            <Clock size={10} />
            <span>{ngayVN(sp.ngayLaunch)}</span>
            {sp.conNgay !== null && (
              <span>·&nbsp;{sp.conNgay > 0 ? `còn ${sp.conNgay} ngày` : "Đã qua hạn"}</span>
            )}
          </div>
        ) : <div />}
        <div style={{
          padding: "2px 8px", borderRadius: 8, fontSize: 9, fontWeight: 700,
          background: ts.bg, color: ts.text, whiteSpace: "nowrap",
        }}>
          {ts.icon} {sp.trangThaiTong.replace(/^[🔴🟡🟢⚪]\s*/, "")}
        </div>
      </div>
    </div>
  );
}

// ─── ProgressoNhom (5 bars per card) ─────────────────────────────────────────

function ProgressoNhom({ sp }: { sp: SanPhamItem }) {
  // Card chỉ hiển thị tổng — nhóm chi tiết trong panel
  // Để render tốt, hiển thị bar tổng to + label
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#9B9B98", fontWeight: 600 }}>TIẾN ĐỘ TỔNG</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: pctColor(sp.tongTienDo) }}>
          {sp.tongTienDo}%
        </span>
      </div>
      <ProgressBar pct={sp.tongTienDo} color={pctColor(sp.tongTienDo)} h={8} />
    </div>
  );
}

function pctColor(pct: number): string {
  if (pct >= 75) return "#1D9E75";
  if (pct >= 50) return "#008264";
  if (pct >= 30) return "#EF9F27";
  return "#E24B4A";
}

// ─── Panel chi tiết ───────────────────────────────────────────────────────────

interface PanelProps { spId: string; onClose: () => void; }

function PanelChiTiet({ spId, onClose }: PanelProps) {
  const [td,    setTd]    = useState<ChiTietTienDo | null>(null);
  const [nhom,  setNhom]  = useState<NhomBuoc | null>(null);
  const [goiY,  setGoiY]  = useState<string | null>(null);
  const [dangTd,  setDangTd]  = useState(true);
  const [dangAi,  setDangAi]  = useState(false);

  useEffect(() => {
    setTd(null); setNhom(null); setGoiY(null); setDangTd(true);
    Promise.all([
      goiApi(`/api/san-pham/${spId}/tien-do`),
      goiApi(`/api/san-pham/${spId}/buoc-chi-tiet`),
    ])
      .then(([tdData, nhomData]) => {
        setTd(tdData);
        setNhom(nhomData.nhom);
      })
      .catch(console.warn)
      .finally(() => setDangTd(false));
  }, [spId]);

  const hienThiGoiY = useCallback(() => {
    if (goiY !== null) return;
    setDangAi(true);
    goiApi(`/api/san-pham/${spId}/goi-y-buoc-tiep`, { method: "POST" })
      .then((d) => setGoiY(d.goiY ?? "Không có gợi ý."))
      .catch(() => setGoiY("Không thể kết nối AI lúc này."))
      .finally(() => setDangAi(false));
  }, [spId, goiY]);

  if (dangTd) return (
    <PanelShell onClose={onClose} title="Đang tải...">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <Loader2 size={24} style={{ color: "#008264", animation: "spin 1s linear infinite" }} />
      </div>
    </PanelShell>
  );
  if (!td) return null;

  const ts    = badgeTrangThai(td.trangThaiTong);
  const cn    = mauConNgay(td.conNgay);
  const { chiTiet, canTroHienTai } = td;

  const nhomBars = [
    { key: "rd",      pct: chiTiet.rd.phanTram,      xong: chiTiet.rd.buocXong,      tong: chiTiet.rd.tongBuoc,      list: nhom?.rd },
    { key: "nap",     pct: chiTiet.nap.phanTram,     xong: undefined,                tong: 13,                       list: nhom?.nap },
    { key: "baoBi",   pct: chiTiet.baoBi.phanTram,   xong: chiTiet.baoBi.buocXong,   tong: chiTiet.baoBi.tongBuoc,   list: nhom ? [...(nhom.baoBiChai ?? []), ...(nhom.baoBiNhan ?? [])] : [] },
    { key: "phapChe", pct: chiTiet.phapChe.phanTram, xong: chiTiet.phapChe.buocXong, tong: chiTiet.phapChe.tongBuoc, list: nhom?.phapChe },
    { key: "sxcn",    pct: chiTiet.sxcn.phanTram,    xong: chiTiet.sxcn.buocXong,    tong: chiTiet.sxcn.tongBuoc,    list: nhom?.sxcn },
  ];

  return (
    <PanelShell onClose={onClose} title={td.ten} sub={td.maSp} kenh={td.kenh}>
      {/* Trạng thái tổng */}
      <div style={{
        margin: "0 16px 0 16px",
        padding: "12px 14px", borderRadius: 10,
        background: ts.bg, border: `1px solid ${ts.text}20`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: ts.text }}>
              {ts.icon} {td.trangThaiTong.replace(/^[🔴🟡🟢⚪]\s*/, "")}
            </div>
            {td.conNgay !== null && (
              <div style={{
                fontSize: 10, marginTop: 3,
                color: cn.color, fontWeight: cn.bold ? 700 : 400,
                animation: cn.pulse ? "blink 1.5s ease-in-out infinite" : "none",
              }}>
                {td.conNgay > 0 ? `⏳ Còn ${td.conNgay} ngày đến launch` : "🚨 Đã qua hạn launch"}
              </div>
            )}
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: pctColor(td.tongTienDo), lineHeight: 1 }}>
            {td.tongTienDo}%
          </div>
        </div>
        <ProgressBar pct={td.tongTienDo} color={pctColor(td.tongTienDo)} h={10} />
      </div>

      {/* Chi tiết từng nhóm */}
      <div style={{ padding: "14px 16px 0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {nhomBars.map(({ key, pct, xong, tong, list }) => (
          <NhomBuocSection
            key={key}
            nhomKey={key}
            pct={pct}
            xong={xong}
            tong={tong}
            buocs={list ?? []}
          />
        ))}

        {/* Cản trở */}
        {canTroHienTai.length > 0 && (
          <div>
            <SectionTitle color="#B91C1C">⚠ Cản trở đang mở ({canTroHienTai.length})</SectionTitle>
            {canTroHienTai.map((ct) => (
              <div key={ct.id} style={{
                padding: "8px 10px", borderRadius: 8, marginBottom: 5,
                background: "#FEF2F2", border: "1px solid #FECACA",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#991B1B" }}>{ct.ten}</span>
                  <span style={{
                    fontSize: 8, padding: "1px 5px", borderRadius: 4, fontWeight: 700,
                    background: "#FECACA", color: "#991B1B",
                  }}>
                    {MUCDO_VI[ct.mucDo] ?? ct.mucDo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI gợi ý */}
        <div style={{ marginBottom: 16 }}>
          <SectionTitle color="#534AB7">✨ AI gợi ý bước tiếp theo</SectionTitle>
          {goiY !== null ? (
            <div style={{
              padding: "10px 12px", borderRadius: 9,
              background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)",
              border: "1px solid #C7D2FE",
            }}>
              <p style={{ fontSize: 12, color: "#3730A3", margin: 0, lineHeight: 1.6 }}>{goiY}</p>
            </div>
          ) : (
            <button
              onClick={hienThiGoiY}
              disabled={dangAi}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 9, cursor: dangAi ? "wait" : "pointer",
                border: "1.5px dashed #818CF8", background: dangAi ? "#F5F3FF" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontSize: 11, fontWeight: 600, color: "#534AB7",
                fontFamily: "'DM Sans', sans-serif",
                transition: "background 0.15s",
              }}
            >
              {dangAi ? (
                <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Đang phân tích...</>
              ) : (
                <><Sparkles size={12} /> Nhận gợi ý từ AI</>
              )}
            </button>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function PanelShell({ children, onClose, title, sub, kenh }: {
  children: React.ReactNode; onClose: () => void; title: string; sub?: string; kenh?: string;
}) {
  return (
    <div style={{
      width: 420, flexShrink: 0,
      background: "#fff", borderLeft: "1px solid #E0E0DD",
      display: "flex", flexDirection: "column",
      boxShadow: "-4px 0 24px rgba(0,0,0,0.07)",
      fontFamily: "'DM Sans', sans-serif",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #EBEBEA",
        display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0,
      }}>
        {kenh && (
          <div style={{
            flexShrink: 0, padding: "3px 7px", borderRadius: 7,
            fontSize: 10, fontWeight: 800, color: "#fff", marginTop: 2,
            background: kenh === "HT" ? "#008264" : "#534AB7",
          }}>{kenh}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {sub && <div style={{ fontSize: 10, fontWeight: 700, color: "#9B9B98" }}>{sub}</div>}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.3 }}>{title}</div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#9B9B98", padding: 4, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ children, color = "#6B6B6B" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, color, textTransform: "uppercase",
      letterSpacing: "0.06em", marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function NhomBuocSection({ nhomKey, pct, xong, tong, buocs }: {
  nhomKey: string; pct: number; xong?: number; tong: number; buocs: ChiTietBuoc[];
}) {
  const [open, setOpen] = useState(false);
  const color = NHOM_MAU[nhomKey] ?? "#888";

  return (
    <div>
      {/* Header dòng nhóm */}
      <div
        onClick={() => buocs.length > 0 && setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          cursor: buocs.length > 0 ? "pointer" : "default", marginBottom: 5,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A", flex: 1 }}>
          {NHOM_TEN[nhomKey]}
          <span style={{ fontSize: 9, color: "#9B9B98", marginLeft: 4, fontWeight: 400 }}>
            ({NHOM_TRONG_SO[nhomKey]})
          </span>
        </span>
        {xong !== undefined && tong > 0 && (
          <span style={{ fontSize: 9, color: "#9B9B98" }}>{xong}/{tong}</span>
        )}
        <span style={{ fontSize: 12, fontWeight: 800, color: pct === 0 ? "#C0C0BE" : color, minWidth: 32, textAlign: "right" }}>
          {pct}%
        </span>
        {buocs.length > 0 && (
          <ChevronRight size={12} style={{
            color: "#9B9B98", flexShrink: 0,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }} />
        )}
      </div>
      <ProgressBar pct={pct} color={color} h={5} />

      {/* Danh sách bước */}
      {open && buocs.length > 0 && (
        <div style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 3 }}>
          {buocs.map((b) => (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 8px", borderRadius: 6,
              background: b.trangThai === "BI_CHAN" ? "#FEF2F2" : "#F8F8F7",
            }}>
              <BuocIcon tt={b.trangThai} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: mauBuoc(b.trangThai), lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.ten}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 8, color: mauBuoc(b.trangThai), fontWeight: 700 }}>
                    {labelBuoc(b.trangThai)}
                  </span>
                  {b.ngayKetThuc && (
                    <span style={{ fontSize: 8, color: "#9B9B98" }}>
                      · KT {ngayVN(b.ngayKetThuc)}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 8, color: "#9B9B98", flexShrink: 0 }}>
                {b.ma}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 phút

export default function SanPham() {
  const [sanPhams,    setSanPhams]    = useState<SanPhamItem[]>([]);
  const [dang,        setDang]        = useState(true);
  const [loi,         setLoi]         = useState("");
  const [capNhatLuc,  setCapNhatLuc]  = useState<Date | null>(null);
  const [tabKenh,     setTabKenh]     = useState<"" | "HT" | "TT">("");
  const [locTrangThai,setLocTrangThai]= useState("");
  const [timKiem,     setTimKiem]     = useState("");
  const [chon,        setChon]        = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tai = useCallback((silent = false) => {
    if (!silent) setDang(true);
    setLoi("");
    const params = new URLSearchParams();
    if (tabKenh) params.set("kenh", tabKenh);
    goiApi(`/api/san-pham?${params}`)
      .then((data) => {
        setSanPhams(data);
        setCapNhatLuc(new Date());
      })
      .catch((e: Error) => setLoi(e.message))
      .finally(() => setDang(false));
  }, [tabKenh]);

  useEffect(() => {
    tai();
    timerRef.current = setInterval(() => tai(true), AUTO_REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tai]);

  // Lọc client-side
  const spHienThi = sanPhams.filter((sp) => {
    if (locTrangThai && !sp.trangThaiTong.includes(locTrangThai)) return false;
    if (timKiem) {
      const q = timKiem.toLowerCase();
      if (!sp.ten.toLowerCase().includes(q) && !sp.maSp.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 48px)",
      fontFamily: "'DM Sans', sans-serif", background: "#F8F8F7",
    }}>
      {/* Left: Danh sách */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{
          background: "#fff", borderBottom: "1px solid #EBEBEA",
          display: "flex", flexDirection: "column", gap: 0, flexShrink: 0,
        }}>
          {/* Tab kênh */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 16px" }}>
            {([["", "Tất cả"], ["HT", "Hệ Thống"], ["TT", "Truyền Thống"]] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => { setTabKenh(v); setChon(null); }}
                style={{
                  padding: "11px 14px", border: "none", background: "none",
                  cursor: "pointer", fontSize: 12, fontWeight: tabKenh === v ? 700 : 500,
                  color: tabKenh === v ? "#008264" : "#6B6B6B",
                  borderBottom: `2px solid ${tabKenh === v ? "#008264" : "transparent"}`,
                  transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {l}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            {/* Dropdown trạng thái */}
            <select
              value={locTrangThai}
              onChange={(e) => setLocTrangThai(e.target.value)}
              style={{
                height: 30, padding: "0 10px", borderRadius: 7, fontSize: 11,
                border: "1px solid #E0E0DD", outline: "none", cursor: "pointer",
                background: "#fff", fontFamily: "'DM Sans', sans-serif", marginRight: 8,
              }}
            >
              {Object.entries(TRANG_THAI_FILTER).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {/* Tìm kiếm */}
            <div style={{ position: "relative", marginRight: 8 }}>
              <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9B9B98" }} />
              <input
                value={timKiem}
                onChange={(e) => setTimKiem(e.target.value)}
                placeholder="Tên hoặc mã SP..."
                style={{
                  height: 30, paddingLeft: 26, paddingRight: 8, borderRadius: 7,
                  border: "1px solid #E0E0DD", fontSize: 11, outline: "none",
                  fontFamily: "'DM Sans', sans-serif", width: 160,
                }}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={() => tai()}
              title="Làm mới"
              style={{
                width: 30, height: 30, border: "1px solid #E0E0DD", borderRadius: 7,
                background: "#fff", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <RefreshCw size={13} color="#6B6B6B" />
            </button>
          </div>
        </div>

        {/* Nội dung */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {dang ? (
            <Skeleton />
          ) : loi ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", gap: 10 }}>
              <ZapOff size={28} color="#E24B4A" />
              <span style={{ fontSize: 13, color: "#E24B4A" }}>Không thể tải dữ liệu</span>
              <button onClick={() => tai()} style={{ fontSize: 12, color: "#008264", cursor: "pointer", background: "none", border: "none", fontWeight: 600 }}>
                Thử lại
              </button>
            </div>
          ) : spHienThi.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", gap: 8 }}>
              <div style={{ fontSize: 32 }}>🍶</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>Không tìm thấy sản phẩm</div>
              <div style={{ fontSize: 11, color: "#9B9B98" }}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
            </div>
          ) : (
            <>
              {/* Stats mini */}
              <div style={{
                display: "flex", gap: 16, marginBottom: 14, fontSize: 11,
                padding: "7px 12px", borderRadius: 8, background: "#fff",
                border: "1px solid #EBEBEA", flexWrap: "wrap",
              }}>
                <span style={{ color: "#9B9B98" }}>
                  <b style={{ color: "#1A1A1A" }}>{spHienThi.length}</b> sản phẩm
                </span>
                <span style={{ color: "#9B9B98" }}>
                  Trung bình <b style={{ color: "#008264" }}>
                    {Math.round(spHienThi.reduce((s, sp) => s + sp.tongTienDo, 0) / spHienThi.length)}%
                  </b>
                </span>
                {spHienThi.filter((s) => s.trangThaiTong.includes("cản trở")).length > 0 && (
                  <span>🔴 <b style={{ color: "#991B1B" }}>
                    {spHienThi.filter((s) => s.trangThaiTong.includes("cản trở")).length}
                  </b> bị cản trở</span>
                )}
                {spHienThi.filter((s) => s.trangThaiTong.includes("Rủi ro")).length > 0 && (
                  <span>🟡 <b style={{ color: "#92400E" }}>
                    {spHienThi.filter((s) => s.trangThaiTong.includes("Rủi ro")).length}
                  </b> rủi ro</span>
                )}
              </div>

              {/* Grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}>
                {spHienThi.map((sp) => (
                  <CardSanPham
                    key={sp.id}
                    sp={sp}
                    isSelected={chon === sp.id}
                    onClick={() => setChon(chon === sp.id ? null : sp.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer: Cập nhật lúc */}
        {capNhatLuc && (
          <div style={{
            padding: "6px 16px", borderTop: "1px solid #EBEBEA",
            background: "#fff", fontSize: 10, color: "#9B9B98",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <RefreshCw size={9} />
            Cập nhật lúc {gioVN(capNhatLuc)} · tự động làm mới sau 5 phút
          </div>
        )}
      </div>

      {/* Right: Panel chi tiết */}
      {chon && (
        <PanelChiTiet key={chon} spId={chon} onClose={() => setChon(null)} />
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>
    </div>
  );
}
