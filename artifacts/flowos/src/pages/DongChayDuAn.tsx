/**
 * DongChayDuAn — Gantt swimlane với chế độ xem Tuần / Tháng / Quý / Năm
 */
import { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  useViewport,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  getStraightPath,
  BaseEdge,
  EdgeLabelRenderer,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  X, Clock, Users, ChevronRight,
  CheckCircle2, Loader2, ZapOff, ChevronUp, ChevronDown,
  SlidersHorizontal, BarChart2,
} from "lucide-react";
import PanelChiTietCongViec from "@/components/PanelChiTietCongViec";
import { useUndoRedoGlobal } from "@/hooks/dung-undo";
import { useAppStore } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheDo = "TUAN" | "THANG" | "QUY" | "NAM";

interface NguoiDung { id: string; ten: string; email: string; mauAvatar?: string | null }
interface DuAn { id: string; ma: string; ten: string; trangThai: string; truongNhom?: NguoiDung | null }
interface Buoc {
  id: string; ma: string; ten: string; diaDiemHoanThanh?: string | null;
  soNgayDuKien: number; duAnId: string;
  ngayBatDau?: string | null; ngayKetThuc?: string | null; laUocTinh?: boolean;
  trangThai: "CHUA_LAM" | "DANG_LAM" | "BI_CHAN" | "XONG";
  nguoiPhuTrach?: NguoiDung | null;
  soCanTro?: number; soCongViec?: number; soXong?: number;
}
interface PhuThuoc { id: string; buocId: string; phuThuocVaoId: string; loai: string; laCritical?: boolean }
interface CotMoc { id: string; ten: string; ma: string; ngay: string; loai: string; duAnId?: string | null }
interface SanPhamLoc { id: string; ten: string; maSp: string | null; kenh: string | null; duAnId: string | null }
interface DongChayData { duAn: DuAn[]; buoc: Buoc[]; phuThuoc: PhuThuoc[]; cotMoc: CotMoc[]; sanPham?: SanPhamLoc[] }
interface LienKetBuoc { id: string; fromBuocId: string; toBuocId: string }
interface BuocChiTiet extends Buoc {
  duAn?: DuAn;
  congViec?: Array<{
    id: string; ten: string; trangThai: string;
    ngayBatDau?: string | null; ngayKetThuc?: string | null;
    nguoiPhuTrach?: NguoiDung | null;
    phuThuocVao?: Array<{
      phuThuocVao: {
        id: string; ten: string; trangThai: string;
        ngayBatDau?: string | null; ngayKetThuc?: string | null;
        buocQuyTrinhId?: string | null;
        buocQuyTrinh?: { id: string; ma: string; ten: string; duAnId: string; duAn?: { id: string; ma: string; ten: string } } | null;
      };
    }>;
  }>;
  canTro?: Array<{ id: string; ten: string; mucDo: string; trangThai: string }>;
  phuThuocVao?: Array<{ loai: string; phuThuocVao: { id: string; ma: string; ten: string; trangThai: string } }>;
  cacBuocPhuThuoc?: Array<{ buoc: { id: string; ma: string; ten: string; trangThai: string } }>;
}

// ─── Cấu hình chế độ xem ─────────────────────────────────────────────────────

const CHE_DO_CONFIG: Record<CheDo, { nhan: string; dayW: number; minPx: number }> = {
  TUAN:  { nhan: "Tuần",  dayW: 56, minPx: 60  },
  THANG: { nhan: "Tháng", dayW: 22, minPx: 44  },
  QUY:   { nhan: "Quý",   dayW: 9,  minPx: 28  },
  NAM:   { nhan: "Năm",   dayW: 3,  minPx: 12  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_W    = 196;
const TIMELINE_H = 60;
const LANE_H     = 160;
const NODE_H     = 52;
const DAY_MS     = 86_400_000;

const TRANGTHAI_STYLE: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  CHUA_LAM: { bg: "#F5F5F3", border: "#CCCCCC", text: "#555555", badge: "#E8E8E6" },
  DANG_LAM: { bg: "#FAEEDA", border: "#EF9F27", text: "#885800", badge: "#FDE68A" },
  BI_CHAN:  { bg: "#FCEBEB", border: "#E24B4A", text: "#9B1C1B", badge: "#FCA5A5" },
  XONG:     { bg: "#E1F5EE", border: "#1D9E75", text: "#075740", badge: "#A7F3D0" },
};

const MUCDO_MN: Record<string, string> = {
  RAT_NGHIEM_TRONG: "Rất nghiêm trọng", VUA_PHAI: "Vừa phải", NHE: "Nhẹ"
};

const NGAY_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function ngayVN(d: Date) {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
function soNgayTre(ngayKetThuc?: string | null, trangThai?: string): number {
  if (trangThai === "XONG") return 0;
  const ngay = toDate(ngayKetThuc);
  if (!ngay) return 0;
  const diff = Math.floor((Date.now() - ngay.getTime()) / DAY_MS);
  return diff > 0 ? diff : 0;
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
    if (res.status === 401) throw Object.assign(new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."), { status: 401 });
    throw Object.assign(new Error(`Lỗi máy chủ (${res.status})`), { status: res.status });
  }
  return res.json();
}

// ─── Custom Node: Bước ────────────────────────────────────────────────────────

const BuocNode = memo(({ data }: NodeProps) => {
  const b = data.buoc as Buoc;
  const dayW = data.dayW as number;
  const style = TRANGTHAI_STYLE[b.trangThai] ?? TRANGTHAI_STYLE.CHUA_LAM;
  const nodeW = Math.max(b.soNgayDuKien * dayW, CHE_DO_CONFIG.NAM.minPx);
  const tre = soNgayTre(b.ngayKetThuc, b.trangThai);
  const showText = nodeW >= 44;
  const showFull = nodeW >= 100;

  const showTooltip = data.showTooltip as ((buoc: Buoc, x: number, y: number) => void) | undefined;
  const hideTooltip = data.hideTooltip as (() => void) | undefined;
  const isNguon = data.isNguon as boolean | undefined;
  const ketNoiModeActive = data.ketNoiMode as boolean | undefined;

  return (
    <div
      style={{
        position: "relative",
        width: nodeW,
        height: NODE_H,
        overflow: "visible",
        fontFamily: "'DM Sans', sans-serif",
        outline: isNguon ? "2px solid #EF9F27" : undefined,
        outlineOffset: 2,
        borderRadius: 7,
        cursor: ketNoiModeActive ? "crosshair" : undefined,
      }}
      onMouseEnter={(e) => showTooltip?.(b, e.clientX, e.clientY)}
      onMouseLeave={() => hideTooltip?.()}
    >
      <Handle type="target" position={Position.Left}
        style={{ opacity: 0, width: 6, height: 6, left: -3, top: "50%" }} />
      <Handle type="source" position={Position.Right}
        style={{ opacity: 0, width: 6, height: 6, right: -3, top: "50%" }} />

      {/* The actual bar */}
      <div style={{
        width: nodeW,
        height: NODE_H,
        background: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: 6,
        padding: showFull ? "4px 8px" : "3px 5px",
        cursor: "pointer",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        overflow: "hidden",
        boxSizing: "border-box",
      }}>
        {/* Row 1: Mã + trễ */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 14 }}>
          {showText && (
            <span style={{
              fontSize: 10, fontWeight: 800, color: style.border,
              letterSpacing: "0.03em", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {b.ma}
            </span>
          )}
          {b.trangThai === "BI_CHAN" && <span style={{ fontSize: 10 }}>⚠</span>}
          {(b.soCanTro ?? 0) > 0 && b.trangThai !== "BI_CHAN" && (
            <span style={{ fontSize: 9 }}>🔴</span>
          )}
          {tre > 0 && showText && (
            <span style={{
              marginLeft: "auto", flexShrink: 0,
              fontSize: 9, fontWeight: 700, color: "#B91C1C",
              background: "#FEE2E2", padding: "0 4px", borderRadius: 8,
            }}>
              +{tre}d
            </span>
          )}
        </div>

        {/* Row 2: Tên — only inside bar when showFull */}
        {showFull && (
          <div style={{
            fontSize: 11, fontWeight: 500, color: style.text,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
            wordBreak: "break-word",
          }}>
            {b.ten}
          </div>
        )}

        {/* Row 3: Avatar + số ngày */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: "auto" }}>
          {showFull && (
            <span style={{ fontSize: 9, color: style.border, fontWeight: 600 }}>
              {b.soNgayDuKien}d
            </span>
          )}
          {b.nguoiPhuTrach && showText && (
            <div style={{
              width: 14, height: 14, borderRadius: "50%",
              background: b.nguoiPhuTrach.mauAvatar ?? "#008264",
              color: "#fff", fontSize: 7, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginLeft: "auto", flexShrink: 0,
            }}>
              {b.nguoiPhuTrach.ten[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Ước tính mark */}
        {b.laUocTinh && (
          <div style={{
            position: "absolute", bottom: 2, right: 3,
            fontSize: 7, color: "#BDBDBA", fontStyle: "italic",
          }}>~</div>
        )}
      </div>

      {/* Lark-style: tên tràn sang phải khi node hẹp — không cắt */}
      {!showFull && (
        <div style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          left: nodeW + 6,
          whiteSpace: "nowrap",
          fontSize: 11,
          fontWeight: 500,
          color: "#374151",
          pointerEvents: "none",
        }}>
          {b.ten}
        </div>
      )}
    </div>
  );
});

// ─── Custom Node: Today line ──────────────────────────────────────────────────

const TodayLineNode = memo(({ data }: NodeProps) => (
  <div style={{
    width: 2,
    height: data.totalHeight,
    background: "#EF4444",
    opacity: 0.5,
    borderRadius: 1,
    pointerEvents: "none",
  }}>
    <div style={{
      position: "absolute", top: -20, left: -14,
      background: "#EF4444", color: "#fff",
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 9,
      whiteSpace: "nowrap",
    }}>
      Hôm nay
    </div>
  </div>
));

// ─── Custom Node: Launch milestone ───────────────────────────────────────────

const LaunchLineNode = memo(({ data }: NodeProps) => (
  <div style={{
    width: 2,
    height: data.totalHeight,
    background: "#008264",
    borderRadius: 1,
    pointerEvents: "none",
    opacity: 0.8,
  }}>
    <div style={{
      position: "absolute", top: -20, left: -14,
      background: "#008264", color: "#fff",
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 9,
      whiteSpace: "nowrap", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis",
    }}>
      🚀 {data.label}
    </div>
  </div>
));

// ─── Custom Node: Swimlane background ────────────────────────────────────────

const SwimlaneNode = memo(({ data }: NodeProps) => {
  const bg = data.index % 2 === 0 ? "#FAFAF9" : "#FFFFFF";
  return (
    <div style={{
      width: data.width,
      height: LANE_H,
      background: `linear-gradient(to bottom, ${bg} calc(100% - 8px), #DDDDD9 calc(100% - 8px))`,
      pointerEvents: "none",
    }} />
  );
});

// ─── Custom Edge: Phụ thuộc ──────────────────────────────────────────────────

const PhuThuocEdge = ({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
  const [edgePath, lx, ly] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const critical = data?.laCritical;
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{
        stroke: critical ? "#E24B4A" : "#CCCCCC",
        strokeWidth: critical ? 2 : 1.5,
        strokeDasharray: critical ? undefined : "5 4",
      }} />
      {data?.coCanTro && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)`,
            fontSize: 14, pointerEvents: "none", color: "#E24B4A",
          }}>⬡</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

// ─── Wheel controller: Figma-style scroll/zoom ───────────────────────────────

function WheelController() {
  const { getViewport, setViewport } = useReactFlow();
  const containerRef = useRef<Element | null>(null);

  useEffect(() => {
    const el = document.querySelector(".react-flow__renderer");
    if (!el) return;
    containerRef.current = el;

    const handler = (e: Event) => {
      const we = e as WheelEvent;
      if (we.ctrlKey || we.metaKey) {
        // Ctrl+scroll = zoom towards cursor
        we.preventDefault();
        we.stopPropagation();
        const vp = getViewport();
        const factor = we.deltaY < 0 ? 1.12 : 0.88;
        const newZoom = Math.max(0.15, Math.min(3, vp.zoom * factor));
        const rect = el.getBoundingClientRect();
        const mx = we.clientX - rect.left;
        const my = we.clientY - rect.top;
        const newX = mx - (mx - vp.x) * (newZoom / vp.zoom);
        const newY = my - (my - vp.y) * (newZoom / vp.zoom);
        setViewport({ x: newX, y: newY, zoom: newZoom });
      } else if (we.shiftKey) {
        // Shift+scroll = pan horizontal
        we.preventDefault();
        const vp = getViewport();
        setViewport({ ...vp, x: vp.x - we.deltaY * 1.2 });
      }
      // plain scroll: browser handles normally
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [getViewport, setViewport]);

  return null;
}

// ─── SVG Overlay: Liên kết bước ──────────────────────────────────────────────

function LienKetSVGOverlay({
  lienKetList, hoverLienKetId, setHoverLienKetId,
  nodeMap, hienLienKet, xoaLienKet, dayW,
}: {
  lienKetList: LienKetBuoc[];
  hoverLienKetId: string | null;
  setHoverLienKetId: (id: string | null) => void;
  nodeMap: Map<string, { x: number; y: number; w: number }>;
  hienLienKet: boolean;
  xoaLienKet: (lk: LienKetBuoc) => void;
  dayW: number;
}) {
  const { x: vpX, y: vpY, zoom } = useViewport();
  if (!hienLienKet || lienKetList.length === 0) return null;

  return (
    <svg
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 8, overflow: "visible",
      }}
    >
      <defs>
        <marker id="lk-arrow-purple" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#534AB7" />
        </marker>
        <marker id="lk-arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#E24B4A" />
        </marker>
      </defs>
      {lienKetList.map(lk => {
        const src = nodeMap.get(lk.fromBuocId);
        const tgt = nodeMap.get(lk.toBuocId);
        if (!src || !tgt) return null;

        const sx = (src.x + src.w) * zoom + vpX;
        const sy = (src.y + NODE_H / 2) * zoom + vpY;
        const tx = tgt.x * zoom + vpX;
        const ty = (tgt.y + NODE_H / 2) * zoom + vpY;
        const ew = Math.max(18 * zoom, 18);
        let pathD: string;
        if (tx >= sx + ew * 2) {
          const midX = (sx + tx) / 2;
          pathD = `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
        } else if (tx < sx) {
          const bypassY = Math.max(sy, ty) + 30 * zoom;
          pathD = `M ${sx} ${sy} H ${sx + ew} V ${bypassY} H ${tx - ew} V ${ty} H ${tx}`;
        } else {
          pathD = `M ${sx} ${sy} H ${sx + ew} V ${ty} H ${tx}`;
        }
        const midX = (sx + tx) / 2;
        const midY = sy + (ty - sy) * 0.5;
        const isHovered = hoverLienKetId === lk.id;
        const clr = isHovered ? "#E24B4A" : "#534AB7";

        return (
          <g key={lk.id}>
            <path
              d={pathD} stroke="transparent" strokeWidth={12} fill="none"
              style={{ pointerEvents: "stroke" as React.CSSProperties["pointerEvents"], cursor: "pointer" }}
              onMouseEnter={() => setHoverLienKetId(lk.id)}
              onMouseLeave={() => setHoverLienKetId(null)}
            />
            <path
              d={pathD} stroke={clr} strokeWidth={isHovered ? 2 : 1.5} fill="none"
              strokeDasharray="5 3"
              markerEnd={isHovered ? "url(#lk-arrow-red)" : "url(#lk-arrow-purple)"}
              style={{ pointerEvents: "none" }}
            />
            {isHovered && (
              <g
                transform={`translate(${midX},${midY})`}
                style={{ pointerEvents: "all", cursor: "pointer" }}
                onClick={() => xoaLienKet(lk)}
                onMouseEnter={() => setHoverLienKetId(lk.id)}
                onMouseLeave={() => setHoverLienKetId(null)}
              >
                <circle r={9} fill="white" stroke="#E24B4A" strokeWidth={1.5} />
                <text
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={14} fill="#E24B4A"
                  fontFamily="'DM Sans', sans-serif" fontWeight="700"
                  style={{ userSelect: "none" }}
                >×</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const nodeTypes = { buoc: BuocNode, todayLine: TodayLineNode, launchLine: LaunchLineNode, swimlane: SwimlaneNode };
const edgeTypes = { phuThuoc: PhuThuocEdge };

// ─── Timeline Header overlay ──────────────────────────────────────────────────

function TimelineHeader({
  projectStart, totalDays, dayW, cheDo,
}: {
  projectStart: Date; totalDays: number; dayW: number; cheDo: CheDo;
}) {
  const { x: vpX, zoom } = useViewport();
  const PX = dayW * zoom;

  // Generate groups depending on mode
  const groups = useMemo(() => {
    const result: Array<{
      header: string; offsetStart: number; ticks: Array<{ label: string; offset: number }>
    }> = [];

    if (cheDo === "TUAN") {
      // Group by week, ticks = each day
      let d = new Date(projectStart);
      const dow = d.getDay() || 7;
      d = new Date(d.getTime() - (dow - 1) * DAY_MS);

      for (let off = Math.floor((d.getTime() - projectStart.getTime()) / DAY_MS); off < totalDays; off += 7) {
        const ws = new Date(projectStart.getTime() + off * DAY_MS);
        const we = new Date(ws.getTime() + 6 * DAY_MS);
        const ticks: Array<{ label: string; offset: number }> = [];
        for (let j = 0; j < 7; j++) {
          const o = off + j;
          if (o >= 0 && o < totalDays) {
            const dd = new Date(projectStart.getTime() + o * DAY_MS);
            ticks.push({ label: `${NGAY_VI[dd.getDay()]} ${dd.getDate()}`, offset: o });
          }
        }
        result.push({
          header: `${ngayVN(ws)}–${ngayVN(we)}`,
          offsetStart: off,
          ticks,
        });
      }
    } else if (cheDo === "THANG") {
      // Group by month, ticks = each week
      let curMonth = -1;
      let curGroup: (typeof result)[0] | null = null;
      for (let off = 0; off < totalDays; off++) {
        const dd = new Date(projectStart.getTime() + off * DAY_MS);
        const mon = dd.getMonth();
        if (mon !== curMonth) {
          curGroup = {
            header: dd.toLocaleDateString("vi-VN", { month: "long", year: "numeric" }),
            offsetStart: off,
            ticks: [],
          };
          result.push(curGroup);
          curMonth = mon;
        }
        // Add week tick on Monday
        if ((dd.getDay() === 1 || off === 0) && curGroup) {
          const we = new Date(dd.getTime() + 6 * DAY_MS);
          curGroup.ticks.push({
            label: `${dd.getDate()}–${we.getDate()}`,
            offset: off,
          });
        }
      }
    } else if (cheDo === "QUY") {
      // Group by quarter, ticks = each month
      let curQ = -1;
      let curGroup: (typeof result)[0] | null = null;
      for (let off = 0; off < totalDays; off++) {
        const dd = new Date(projectStart.getTime() + off * DAY_MS);
        const q = Math.floor(dd.getMonth() / 3);
        const yr = dd.getFullYear();
        const qKey = yr * 10 + q;
        if (qKey !== curQ) {
          curGroup = {
            header: `Q${q + 1}/${yr}`,
            offsetStart: off,
            ticks: [],
          };
          result.push(curGroup);
          curQ = qKey;
        }
        // Add tick on 1st of month
        if (dd.getDate() === 1 && curGroup) {
          curGroup.ticks.push({
            label: dd.toLocaleDateString("vi-VN", { month: "short" }),
            offset: off,
          });
        }
      }
    } else {
      // NAM: Group by year, ticks = each month
      let curYr = -1;
      let curGroup: (typeof result)[0] | null = null;
      for (let off = 0; off < totalDays; off++) {
        const dd = new Date(projectStart.getTime() + off * DAY_MS);
        const yr = dd.getFullYear();
        if (yr !== curYr) {
          curGroup = {
            header: String(yr),
            offsetStart: off,
            ticks: [],
          };
          result.push(curGroup);
          curYr = yr;
        }
        if (dd.getDate() === 1 && curGroup) {
          curGroup.ticks.push({
            label: dd.toLocaleDateString("vi-VN", { month: "narrow" }),
            offset: off,
          });
        }
      }
    }
    return result;
  }, [projectStart, totalDays, dayW, cheDo]);

  return (
    <div style={{
      position: "absolute", left: LABEL_W, top: 0, right: 0, height: TIMELINE_H,
      zIndex: 9, background: "#fff", borderBottom: "1px solid #EBEBEA",
      overflow: "hidden", pointerEvents: "none",
    }}>
      {groups.map((grp) => {
        const grpScreenX = grp.offsetStart * PX + vpX;
        // find next group start to compute width
        const grpNextOff = (groups[groups.indexOf(grp) + 1]?.offsetStart ?? totalDays);
        const grpW = (grpNextOff - grp.offsetStart) * PX;

        if (grpScreenX + grpW < 0 || grpScreenX > window.innerWidth) return null;

        return (
          <div key={grp.header + grp.offsetStart} style={{
            position: "absolute",
            left: grpScreenX, top: 0,
            width: grpW, height: TIMELINE_H,
            borderLeft: "1px solid #EBEBEA",
          }}>
            {/* Group header */}
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#6B6B6B",
              padding: "3px 6px", letterSpacing: "0.04em",
              whiteSpace: "nowrap", overflow: "hidden",
            }}>
              {grp.header}
            </div>

            {/* Ticks */}
            <div style={{ position: "relative", height: 36 }}>
              {grp.ticks.map((tick) => {
                const tickLocalX = (tick.offset - grp.offsetStart) * PX;
                const isToday = (() => {
                  const d = new Date(projectStart.getTime() + tick.offset * DAY_MS);
                  return d.toDateString() === new Date().toDateString();
                })();
                return (
                  <div key={tick.offset} style={{
                    position: "absolute", left: tickLocalX,
                    top: 0, height: 36,
                    borderLeft: "1px solid #F0F0EE",
                    paddingLeft: 3,
                  }}>
                    <span style={{
                      fontSize: 9, color: isToday ? "#EF4444" : "#9B9B98",
                      fontWeight: isToday ? 800 : 400, whiteSpace: "nowrap",
                    }}>
                      {tick.label}
                    </span>
                    {isToday && (
                      <div style={{
                        position: "absolute", top: 0, left: 0, bottom: 0, width: 1,
                        background: "#EF4444",
                      }} />
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

// ─── DA Label panel overlay ───────────────────────────────────────────────────

function DALabelPanel({ daList, daIndexMap }: {
  daList: DuAn[]; daIndexMap: Map<string, number>;
}) {
  const { y: vpY, zoom } = useViewport();

  return (
    <div style={{
      position: "absolute", left: 0, top: 0, bottom: 0,
      width: LABEL_W, zIndex: 10,
      background: "#fff", borderRight: "1px solid #EBEBEA",
      pointerEvents: "none",
    }}>
      {/* Spacer aligns with timeline header */}
      <div style={{
        height: TIMELINE_H, borderBottom: "1px solid #EBEBEA",
        display: "flex", alignItems: "center",
        paddingLeft: 12, fontSize: 10, fontWeight: 800,
        color: "#9B9B98", letterSpacing: "0.06em",
      }}>
        DỰ ÁN
      </div>

      {daList.map((da) => {
        const idx = daIndexMap.get(da.id) ?? 0;
        const laneFlowY = idx * LANE_H;
        const screenY = laneFlowY * zoom + vpY + TIMELINE_H;
        const laneScreenH = LANE_H * zoom;

        // Don't render labels outside visible area
        if (screenY + laneScreenH < TIMELINE_H || screenY > 2000) return null;

        // Adapt content based on available height
        const showLeader  = laneScreenH >= 68;
        const showName    = laneScreenH >= 40;
        const showMaOnly  = laneScreenH >= 20;

        return (
          <div key={da.id} style={{
            position: "absolute",
            top: Math.max(screenY, TIMELINE_H),
            left: 0, width: LABEL_W,
            height: Math.min(laneScreenH, laneScreenH - Math.max(0, TIMELINE_H - screenY)),
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "0 8px 0 12px", overflow: "hidden",
            borderBottom: "1px solid #EBEBEA",
            boxSizing: "border-box",
          }}>
            {/* Colored accent bar */}
            <div style={{
              position: "absolute", left: 0, top: "15%", bottom: "15%",
              width: 3, borderRadius: "0 2px 2px 0",
              background: "#008264", opacity: 0.6,
            }} />

            {!showMaOnly ? null : (
              <>
                {/* Mã dự án */}
                <div style={{
                  fontSize: Math.max(9, Math.min(11, laneScreenH * 0.2)),
                  fontWeight: 800, color: "#008264",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  lineHeight: 1.2,
                }}>
                  {da.ma}
                </div>

                {/* Tên dự án */}
                {showName && (
                  <div style={{
                    fontSize: Math.max(9, Math.min(11, laneScreenH * 0.18)),
                    fontWeight: 500, color: "#1A1A1A",
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: laneScreenH > 80 ? 2 : 1,
                    WebkitBoxOrient: "vertical",
                    lineHeight: 1.3, marginTop: 1,
                  }}>
                    {da.ten}
                  </div>
                )}

                {/* Trưởng nhóm */}
                {showLeader && da.truongNhom && (
                  <div style={{
                    fontSize: 10, color: "#9B9B98", marginTop: 4,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: "#008264", color: "#fff",
                      fontSize: 7, fontWeight: 700, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {da.truongNhom.ten[0]?.toUpperCase()}
                    </div>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {da.truongNhom.ten}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Build ReactFlow graph ────────────────────────────────────────────────────

function buildGraph(data: DongChayData, dayW: number): {
  nodes: Node[]; edges: Edge[];
  projectStart: Date; totalDays: number;
  daIndexMap: Map<string, number>;
} {
  const { duAn, buoc, phuThuoc, cotMoc } = data;
  const sortedDA = [...duAn].sort((a, b) => a.ma.localeCompare(b.ma));
  const daIndexMap = new Map(sortedDA.map((da, i) => [da.id, i]));

  const allDates: Date[] = [new Date()];
  for (const b of buoc) {
    const s = toDate(b.ngayBatDau); const e = toDate(b.ngayKetThuc);
    if (s) allDates.push(s);
    if (e) allDates.push(e);
  }
  for (const cm of cotMoc) { const d = toDate(cm.ngay); if (d) allDates.push(d); }

  const earliest = allDates.reduce((min, d) => d < min ? d : min);
  const latest   = allDates.reduce((max, d) => d > max ? d : max);

  const projectStart = new Date(earliest);
  projectStart.setDate(projectStart.getDate() - 7);
  projectStart.setHours(0, 0, 0, 0);

  const totalDays = Math.max(90, Math.ceil((latest.getTime() - projectStart.getTime()) / DAY_MS) + 30);
  const canvasW   = totalDays * dayW;
  const totalH    = sortedDA.length * LANE_H;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Swimlane backgrounds
  for (const da of sortedDA) {
    const idx = daIndexMap.get(da.id) ?? 0;
    nodes.push({
      id: `lane-${da.id}`, type: "swimlane",
      position: { x: 0, y: idx * LANE_H },
      data: { width: canvasW, index: idx, da },
      selectable: false, draggable: false, zIndex: -1,
    });
  }

  // Buoc nodes — with vertical stacking to avoid overlap within same lane
  // Track occupied x-ranges per lane row
  const laneRows = new Map<string, Array<{ from: number; to: number; row: number }>>();

  for (const b of buoc) {
    const daIdx = daIndexMap.get(b.duAnId);
    if (daIdx === undefined) continue;

    const startDate = toDate(b.ngayBatDau) ?? new Date();
    const offsetDays = (startDate.getTime() - projectStart.getTime()) / DAY_MS;
    const nodeW = Math.max(b.soNgayDuKien * dayW, CHE_DO_CONFIG.NAM.minPx);
    const xFrom = offsetDays * dayW;
    const xTo   = xFrom + nodeW;

    // Assign row within lane (to avoid overlap)
    const laneKey = b.duAnId;
    const occupied = laneRows.get(laneKey) ?? [];
    let row = 0;
    while (occupied.some(r => r.row === row && r.from < xTo + 8 && r.to > xFrom - 8)) row++;
    occupied.push({ from: xFrom, to: xTo, row });
    laneRows.set(laneKey, occupied);

    const maxRows = 2;
    const rowH = (LANE_H - 20) / maxRows;
    const nodeY = daIdx * LANE_H + 10 + (row % maxRows) * rowH;

    nodes.push({
      id: b.id, type: "buoc",
      position: { x: xFrom, y: nodeY },
      data: { buoc: b, dayW },
      draggable: false,
    });
  }

  // Today line
  const now = new Date();
  const todayOffset = (now.getTime() - projectStart.getTime()) / DAY_MS;
  nodes.push({
    id: "today-line", type: "todayLine",
    position: { x: todayOffset * dayW, y: 0 },
    data: { totalHeight: totalH },
    selectable: false, draggable: false, zIndex: 5,
  });

  // Launch milestones
  for (const cm of cotMoc) {
    const d = toDate(cm.ngay);
    if (!d) continue;
    const offset = (d.getTime() - projectStart.getTime()) / DAY_MS;
    nodes.push({
      id: `cm-${cm.id}`, type: "launchLine",
      position: { x: offset * dayW, y: 0 },
      data: { label: cm.ma || cm.ten, totalHeight: totalH },
      selectable: false, draggable: false, zIndex: 4,
    });
  }

  // Dependency edges
  for (const pt of phuThuoc) {
    edges.push({
      id: `edge-${pt.id}`,
      source: pt.phuThuocVaoId, target: pt.buocId,
      type: "phuThuoc",
      data: { laCritical: pt.laCritical, coCanTro: false },
    });
  }

  return { nodes, edges, projectStart, totalDays, daIndexMap };
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

const TT_LABEL: Record<string, string> = {
  CHUA_LAM: "Chưa làm", DANG_LAM: "Đang làm", BI_CHAN: "Bị chặn", XONG: "Xong",
};

function ChiTietBuocPanel({ buocId, onClose, onCongViecClick }: { buocId: string; onClose: () => void; onCongViecClick?: (id: string) => void }) {
  const [buoc, setBuoc] = useState<BuocChiTiet | null>(null);
  const [dang, setDang] = useState(true);

  useEffect(() => {
    setDang(true);
    goiApi(`/api/dong-chay/buoc/${buocId}`)
      .then(setBuoc).catch(console.warn).finally(() => setDang(false));
  }, [buocId]);

  const ts = buoc ? TRANGTHAI_STYLE[buoc.trangThai] ?? TRANGTHAI_STYLE.CHUA_LAM : TRANGTHAI_STYLE.CHUA_LAM;
  const tre = soNgayTre(buoc?.ngayKetThuc, buoc?.trangThai);

  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 460,
      background: "#fff", borderLeft: "1px solid #EBEBEA",
      zIndex: 20, display: "flex", flexDirection: "column",
      boxShadow: "-6px 0 24px rgba(0,0,0,0.10)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "16px 20px 14px",
        borderBottom: `3px solid ${ts.border}`,
        background: ts.bg,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: ts.text,
                background: ts.badge, borderRadius: 4, padding: "1px 6px",
              }}>{buoc?.ma ?? "—"}</span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: ts.text, background: ts.badge,
                borderRadius: 4, padding: "1px 8px",
              }}>{TT_LABEL[buoc?.trangThai ?? ""] ?? buoc?.trangThai}</span>
              {tre > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#EF4444", borderRadius: 4, padding: "1px 7px" }}>
                  Trễ {tre}d
                </span>
              )}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: "#1A1A1A",
              lineHeight: 1.35,
            }}>
              {buoc?.ten ?? (dang ? "Đang tải..." : "Không tìm thấy")}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: 6, borderRadius: 7, background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", color: "#555", flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick stats */}
        {buoc && (
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <QuickStat icon={<Clock size={12} />} label="Kế hoạch">
              {buoc.ngayBatDau ? ngayVN(new Date(buoc.ngayBatDau)) : "—"} → {buoc.ngayKetThuc ? ngayVN(new Date(buoc.ngayKetThuc)) : "—"}
            </QuickStat>
            <QuickStat icon={<Users size={12} />} label="Phụ trách">
              {buoc.nguoiPhuTrach?.ten ?? "Chưa chỉ định"}
            </QuickStat>
            {(buoc.congViec?.length ?? 0) > 0 && (
              <QuickStat icon={<BarChart2 size={12} />} label="Công việc">
                {buoc.congViec!.filter(cv => cv.trangThai === "XONG").length}/{buoc.congViec!.length} xong
              </QuickStat>
            )}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {dang ? (
          <div style={{ textAlign: "center", padding: 48, color: "#9B9B98" }}>
            <Loader2 size={22} style={{ color: "#008264", animation: "spin 1s linear infinite", marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Đang tải...</div>
          </div>
        ) : buoc ? (
          <>
            {/* Tiêu chí hoàn thành */}
            {buoc.diaDiemHoanThanh && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9B9B98", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Tiêu chí hoàn thành</div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{buoc.diaDiemHoanThanh}</div>
              </div>
            )}

            {/* Cản trở */}
            {(buoc.canTro?.length ?? 0) > 0 && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#E24B4A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  🚧 Cản trở đang mở ({buoc.canTro!.length})
                </div>
                {buoc.canTro!.map((ct) => (
                  <div key={ct.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 7,
                    background: "#FEF2F2", border: "1px solid #FECACA",
                    marginBottom: 5,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#991B1B" }}>{ct.ten}</div>
                      <div style={{ fontSize: 10, color: "#B91C1C", marginTop: 1 }}>{MUCDO_MN[ct.mucDo] ?? ct.mucDo}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Phụ thuộc */}
            {(buoc.phuThuocVao?.length ?? 0) > 0 && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Phụ thuộc vào</div>
                {buoc.phuThuocVao!.map((pt, i) => <DepRow key={i} step={pt.phuThuocVao} loai={pt.loai} />)}
              </div>
            )}
            {(buoc.cacBuocPhuThuoc?.length ?? 0) > 0 && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#008264", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Bước tiếp theo</div>
                {buoc.cacBuocPhuThuoc!.map((pt, i) => <DepRow key={i} step={pt.buoc} />)}
              </div>
            )}

            {/* ── Danh sách công việc ── */}
            {(buoc.congViec?.length ?? 0) > 0 && (
              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#1A1A1A", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Công việc trong bước ({buoc.congViec!.length})
                  </div>
                  {onCongViecClick && (
                    <div style={{ fontSize: 10, color: "#9B9B98" }}>Click để xem chi tiết & tác động →</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {buoc.congViec!.map((cv) => {
                    const cvTs = TRANGTHAI_STYLE[cv.trangThai] ?? TRANGTHAI_STYLE.CHUA_LAM;
                    const hanEnd = cv.ngayKetThuc ? new Date(cv.ngayKetThuc) : null;
                    const cvTre = cv.trangThai !== "XONG" && hanEnd && hanEnd < new Date()
                      ? Math.floor((Date.now() - hanEnd.getTime()) / 86400000) : 0;
                    const isClickable = !!onCongViecClick;

                    return (
                      <div
                        key={cv.id}
                        onClick={() => onCongViecClick?.(cv.id)}
                        style={{
                          display: "flex", gap: 0,
                          border: `1.5px solid ${cvTre > 0 ? "#FCA5A5" : "#E5E7EB"}`,
                          borderRadius: 10,
                          background: cvTre > 0 ? "#FFF5F5" : "#FAFAFA",
                          cursor: isClickable ? "pointer" : "default",
                          transition: "box-shadow 0.15s, border-color 0.15s",
                          overflow: "hidden",
                        }}
                        onMouseEnter={(e) => {
                          if (isClickable) {
                            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,130,100,0.12)";
                            (e.currentTarget as HTMLDivElement).style.borderColor = "#008264";
                          }
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                          (e.currentTarget as HTMLDivElement).style.borderColor = cvTre > 0 ? "#FCA5A5" : "#E5E7EB";
                        }}
                      >
                        {/* Status bar kiri */}
                        <div style={{ width: 4, flexShrink: 0, background: cvTs.border }} />

                        <div style={{ flex: 1, padding: "10px 12px" }}>
                          {/* Row 1: badge + tên */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: cvTs.text, background: cvTs.badge,
                              borderRadius: 4, padding: "1px 6px", flexShrink: 0,
                            }}>
                              {TT_LABEL[cv.trangThai] ?? cv.trangThai}
                            </span>
                            {cvTre > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#EF4444", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>
                                Trễ {cvTre}d
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.3, marginBottom: 6 }}>
                            {cv.ten}
                          </div>

                          {/* Row 2: meta */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            {cv.nguoiPhuTrach && (
                              <span style={{ fontSize: 11, color: "#6B7280", display: "flex", alignItems: "center", gap: 3 }}>
                                <Users size={10} /> {cv.nguoiPhuTrach.ten}
                              </span>
                            )}
                            {hanEnd && (
                              <span style={{ fontSize: 11, color: cvTre > 0 ? "#EF4444" : "#6B7280", display: "flex", alignItems: "center", gap: 3 }}>
                                <Clock size={10} /> Hạn: {ngayVN(hanEnd)}
                              </span>
                            )}
                            {cv.phuThuocVao && cv.phuThuocVao.length > 0 && (
                              <span style={{ fontSize: 10, color: "#9B9B98" }}>
                                {cv.phuThuocVao.length} phụ thuộc
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow khi có click */}
                        {isClickable && (
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            width: 32, flexShrink: 0, color: "#9B9B98",
                          }}>
                            <ChevronRight size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trường hợp không có công việc */}
            {(buoc.congViec?.length ?? 0) === 0 && (
              <div style={{ padding: "20px 20px", textAlign: "center", color: "#9B9B98", fontSize: 13 }}>
                Bước này chưa có công việc nào
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 48, color: "#9B9B98" }}>Không tải được dữ liệu</div>
        )}
      </div>
    </div>
  );
}

function QuickStat({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#374151" }}>
      <span style={{ color: "#9B9B98" }}>{icon}</span>
      <span style={{ color: "#9B9B98", fontSize: 11 }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{children}</span>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: "#9B9B98", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 9, color: "#9B9B98", marginBottom: 1, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        <div style={{ fontSize: 13, color: "#1A1A1A" }}>{children}</div>
      </div>
    </div>
  );
}
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #F0F0EE" }}>{title}</div>
      {children}
    </div>
  );
}
function DepRow({ step, loai }: { step: { ma: string; ten: string; trangThai: string }; loai?: string }) {
  const style = TRANGTHAI_STYLE[step.trangThai] ?? TRANGTHAI_STYLE.CHUA_LAM;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid #F8F8F7" }}>
      <ChevronRight size={11} style={{ color: "#BDBDBA", flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 800, color: style.border, flexShrink: 0 }}>{step.ma}</span>
      <span style={{ fontSize: 12, color: "#1A1A1A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.ten}</span>
      {loai && <span style={{ fontSize: 9, color: "#9B9B98" }}>{loai}</span>}
    </div>
  );
}
function GanttMini({ congViecs, buocStart, buocEnd }: {
  congViecs: BuocChiTiet["congViec"]; buocStart?: string | null; buocEnd?: string | null;
}) {
  if (!congViecs?.length) return null;
  const allDates: Date[] = [];
  for (const cv of congViecs) {
    const s = toDate(cv.ngayBatDau); const e = toDate(cv.ngayKetThuc);
    if (s) allDates.push(s); if (e) allDates.push(e);
  }
  if (toDate(buocStart)) allDates.push(toDate(buocStart)!);
  if (toDate(buocEnd))   allDates.push(toDate(buocEnd)!);

  if (!allDates.length) {
    return (
      <div>
        {congViecs.map((cv) => (
          <div key={cv.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", fontSize: 12, color: "#555", borderBottom: "1px solid #F8F8F7" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: TRANGTHAI_STYLE[cv.trangThai]?.border ?? "#CCC", flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cv.ten}</span>
            {cv.nguoiPhuTrach && <span style={{ fontSize: 10, color: "#9B9B98" }}>{cv.nguoiPhuTrach.ten}</span>}
          </div>
        ))}
      </div>
    );
  }

  const start = allDates.reduce((a, b) => a < b ? a : b);
  const end   = allDates.reduce((a, b) => a > b ? a : b);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS)) + 2;
  const PPD = (360 - 32) / totalDays;

  return (
    <div>
      {congViecs.map((cv) => {
        const s = toDate(cv.ngayBatDau); const e = toDate(cv.ngayKetThuc);
        const left = s ? ((s.getTime() - start.getTime()) / DAY_MS) * PPD : 0;
        const w    = (s && e) ? Math.max(4, ((e.getTime() - s.getTime()) / DAY_MS) * PPD) : 8;
        const bs = TRANGTHAI_STYLE[cv.trangThai] ?? TRANGTHAI_STYLE.CHUA_LAM;
        return (
          <div key={cv.id} style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 10, color: "#6B6B6B", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cv.ten}</div>
            <div style={{ position: "relative", height: 10, background: "#F5F5F3", borderRadius: 3 }}>
              <div style={{ position: "absolute", left, width: w, height: 10, background: bs.border, borderRadius: 3, opacity: 0.8 }} />
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#BDBDBA", marginTop: 4 }}>
        <span>{start.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span>
        <span>{end.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span>
      </div>
    </div>
  );
}

// ─── Inner canvas (phải nằm bên trong ReactFlowProvider) ──────────────────────

function DongChayCanvas({
  data, locDuAn, locTrangThai, cheDo, onChonBuoc, buocChon, hienLienKet,
  canKetNoi, ketNoiMode, onExitKetNoi,
}: {
  data: DongChayData; locDuAn: string; locTrangThai: string; cheDo: CheDo;
  onChonBuoc: (id: string | null) => void; buocChon: string | null; hienLienKet: boolean;
  canKetNoi: boolean; ketNoiMode: boolean; onExitKetNoi: () => void;
}) {
  const dayW = CHE_DO_CONFIG[cheDo].dayW;
  const [tooltip, setTooltip] = useState<{ buoc: Buoc; x: number; y: number } | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nodeNguon, setNodeNguon] = useState<string | null>(null);
  const [lienKetList, setLienKetList] = useState<LienKetBuoc[]>(() =>
    data.phuThuoc.map(pt => ({ id: pt.id, fromBuocId: pt.phuThuocVaoId, toBuocId: pt.buocId }))
  );
  const [hoverLienKetId, setHoverLienKetId] = useState<string | null>(null);
  const { push: pushUndo } = useUndoRedoGlobal();

  // Sync lienKetList when data.phuThuoc changes
  useEffect(() => {
    setLienKetList(data.phuThuoc.map(pt => ({ id: pt.id, fromBuocId: pt.phuThuocVaoId, toBuocId: pt.buocId })));
  }, [data.phuThuoc]);

  // Exit connect mode when Esc is pressed
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setNodeNguon(null); onExitKetNoi(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExitKetNoi]);

  // Reset nodeNguon when mode exits
  useEffect(() => {
    if (!ketNoiMode) setNodeNguon(null);
  }, [ketNoiMode]);

  const showTooltip = useCallback((buoc: Buoc, x: number, y: number) => {
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setTooltip({ buoc, x, y }), 300);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    setTooltip(null);
  }, []);

  const filtered = useMemo(() => ({
    ...data,
    duAn: data.duAn.filter((da) => !locDuAn || da.id === locDuAn),
    buoc: data.buoc
      .filter((b) => !locDuAn || b.duAnId === locDuAn)
      .filter((b) => !locTrangThai || b.trangThai === locTrangThai),
  }), [data, locDuAn, locTrangThai]);

  const { nodes: rawNodes, projectStart, totalDays, daIndexMap } = useMemo(
    () => buildGraph(filtered, dayW),
    [filtered, dayW]
  );

  // Build a map of nodeId → {x, y, w} for SVG overlay
  const nodeMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; w: number }>();
    for (const node of rawNodes) {
      if (node.type === "buoc") {
        const b = node.data.buoc as Buoc;
        const w = Math.max(b.soNgayDuKien * dayW, CHE_DO_CONFIG.NAM.minPx);
        map.set(node.id, { x: node.position.x, y: node.position.y, w });
      }
    }
    return map;
  }, [rawNodes, dayW]);

  // Enrich buoc nodes with tooltip callbacks + connect mode state
  const graphNodes = useMemo(() =>
    rawNodes.map(n => {
      if (n.type !== "buoc") return n;
      return {
        ...n,
        data: {
          ...n.data,
          showTooltip, hideTooltip,
          isNguon: n.id === nodeNguon,
          ketNoiMode,
        },
      };
    }),
    [rawNodes, showTooltip, hideTooltip, nodeNguon, ketNoiMode]
  );

  // No ReactFlow edges — all links rendered via SVG overlay
  const visibleEdges: never[] = [];

  const taoLienKet = useCallback(async (fromId: string, toId: string) => {
    try {
      const res = await goiApi("/api/buoc/dependencies", {
        method: "POST",
        body: JSON.stringify({ fromBuocId: fromId, toBuocId: toId }),
      });
      const newLk: LienKetBuoc = { id: res.id, fromBuocId: res.fromBuocId, toBuocId: res.toBuocId };
      setLienKetList(prev => [...prev, newLk]);
      setNodeNguon(null);
      // Track the current live id (changes if undo+redo cycles recreate the record)
      let currentId = newLk.id;
      pushUndo({
        type: "DEP_THEM_MOI",
        label: "liên kết bước",
        rollback: async () => {
          await goiApi(`/api/buoc/dependencies/${currentId}`, { method: "DELETE" });
          setLienKetList(prev => prev.filter(lk => lk.id !== currentId));
        },
        reapply: async () => {
          const r = await goiApi("/api/buoc/dependencies", {
            method: "POST",
            body: JSON.stringify({ fromBuocId: fromId, toBuocId: toId }),
          });
          currentId = r.id;
          setLienKetList(prev => [...prev, { id: r.id, fromBuocId: r.fromBuocId, toBuocId: r.toBuocId }]);
        },
      });
    } catch (err) {
      console.warn("Không thể tạo liên kết:", err);
    }
  }, [pushUndo]);

  const xoaLienKet = useCallback(async (lk: LienKetBuoc) => {
    setLienKetList(prev => prev.filter(x => x.id !== lk.id));
    try {
      await goiApi(`/api/buoc/dependencies/${lk.id}`, { method: "DELETE" });
      // Track the live id: after undo recreates the record, a new id is issued
      let currentId = lk.id;
      pushUndo({
        type: "DEP_XOA",
        label: "xóa liên kết bước",
        rollback: async () => {
          const r = await goiApi("/api/buoc/dependencies", {
            method: "POST",
            body: JSON.stringify({ fromBuocId: lk.fromBuocId, toBuocId: lk.toBuocId }),
          });
          currentId = r.id; // Update: next redo must delete this new id
          setLienKetList(prev => [...prev, { id: r.id, fromBuocId: r.fromBuocId, toBuocId: r.toBuocId }]);
        },
        reapply: async () => {
          await goiApi(`/api/buoc/dependencies/${currentId}`, { method: "DELETE" }).catch(() => {});
          setLienKetList(prev => prev.filter(x => x.id !== currentId));
        },
      });
    } catch (err) {
      // Revert optimistic delete
      setLienKetList(prev => [...prev, lk]);
      console.warn("Không thể xóa liên kết:", err);
    }
  }, [pushUndo]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type !== "buoc") return;
    if (ketNoiMode) {
      if (!nodeNguon) {
        setNodeNguon(node.id);
      } else if (nodeNguon !== node.id) {
        taoLienKet(nodeNguon, node.id);
      }
    } else {
      onChonBuoc(node.id === buocChon ? null : node.id);
    }
  }, [ketNoiMode, nodeNguon, buocChon, onChonBuoc, taoLienKet]);

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      {/* DA Labels */}
      <DALabelPanel daList={filtered.duAn} daIndexMap={daIndexMap} />
      {/* Timeline */}
      <TimelineHeader projectStart={projectStart} totalDays={totalDays} dayW={dayW} cheDo={cheDo} />

      {/* CSS for connect-mode node hover glow */}
      {ketNoiMode && (
        <style>{`
          .ket-noi-mode .react-flow__node-buoc > div:hover {
            outline: 2px solid #16a34a !important;
            outline-offset: 2px;
            animation: buocKetNoiPulse 0.9s ease-in-out infinite;
          }
          @keyframes buocKetNoiPulse {
            0%, 100% { outline-color: #16a34a; }
            50% { outline-color: transparent; }
          }
        `}</style>
      )}

      {/* Canvas area (offset to avoid overlays) */}
      <div className={ketNoiMode ? "ket-noi-mode" : ""} style={{ position: "absolute", left: LABEL_W, top: TIMELINE_H, right: 0, bottom: 0 }}>
        <ReactFlow
          nodes={graphNodes}
          edges={visibleEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => { onChonBuoc(null); if (ketNoiMode) setNodeNguon(null); }}
          minZoom={0.15}
          maxZoom={3}
          fitView
          fitViewOptions={{ padding: 0.04 }}
          proOptions={{ hideAttribution: true }}
          panOnDrag={[0, 2]}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch
          selectionOnDrag={false}
          style={{ background: "#FAFAF9", cursor: ketNoiMode ? "crosshair" : "grab" }}
        >
          <WheelController />
          <Background color="#EBEBEA" gap={dayW * 7} size={1} />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>

        {/* SVG Overlay for liên kết bước */}
        <LienKetSVGOverlay
          lienKetList={lienKetList}
          hoverLienKetId={hoverLienKetId}
          setHoverLienKetId={setHoverLienKetId}
          nodeMap={nodeMap}
          hienLienKet={hienLienKet}
          xoaLienKet={xoaLienKet}
          dayW={dayW}
        />

        {/* Connect mode guide bar */}
        {ketNoiMode && (
          <div style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            background: nodeNguon ? "#EF9F27" : "#534AB7",
            color: "white", borderRadius: 20, padding: "5px 16px",
            fontSize: 12, fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600, zIndex: 20, pointerEvents: "none",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}>
            {nodeNguon
              ? "✓ Đã chọn bước nguồn — nhấp vào bước đích"
              : "Nhấp vào bước nguồn để bắt đầu liên kết • Esc để thoát"}
          </div>
        )}
      </div>

      {/* Fixed tooltip */}
      {tooltip && (() => {
        const b = tooltip.buoc;
        const ts = TRANGTHAI_STYLE[b.trangThai] ?? TRANGTHAI_STYLE.CHUA_LAM;
        const tre = soNgayTre(b.ngayKetThuc, b.trangThai);
        const LABEL: Record<string, string> = { CHUA_LAM: "Chưa làm", DANG_LAM: "Đang làm", BI_CHAN: "Bị chặn", XONG: "Xong" };
        return (
          <div style={{
            position: "fixed",
            left: tooltip.x + 14,
            top: Math.max(8, tooltip.y - 110),
            zIndex: 9999,
            background: "#1A1A1A",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            maxWidth: 260,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            lineHeight: 1.65,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 5 }}>{b.ma} — {b.ten}</div>
            <div style={{ fontSize: 11, color: ts.badge }}>● {LABEL[b.trangThai] ?? b.trangThai}</div>
            {b.ngayKetThuc && (
              <div style={{ fontSize: 11, marginTop: 3, color: tre > 0 ? "#FCA5A5" : "#9B9B98" }}>
                🗓 Hạn: {ngayVN(new Date(b.ngayKetThuc))}{tre > 0 ? ` (+${tre}d trễ)` : ""}
              </div>
            )}
            {b.nguoiPhuTrach && (
              <div style={{ fontSize: 11, marginTop: 3, color: "#D1D5DB" }}>👤 {b.nguoiPhuTrach.ten}</div>
            )}
            {typeof b.soCongViec === "number" && (
              <div style={{ fontSize: 11, marginTop: 3, color: "#D1D5DB" }}>
                📋 {b.soXong ?? 0}/{b.soCongViec} công việc xong
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const LABELS: Record<string, string> = {
    CHUA_LAM: "Chưa làm", DANG_LAM: "Đang làm", BI_CHAN: "Bị chặn", XONG: "Xong"
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {Object.entries(TRANGTHAI_STYLE).map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: v.bg, border: `2px solid ${v.border}` }} />
          <span style={{ color: "#6B6B6B" }}>{LABELS[k]}</span>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, marginLeft: 4 }}>
        <div style={{ width: 2, height: 12, background: "#EF4444", borderRadius: 1, opacity: 0.6 }} />
        <span style={{ color: "#6B6B6B" }}>Hôm nay</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        <div style={{ width: 2, height: 12, background: "#008264", borderRadius: 1 }} />
        <span style={{ color: "#6B6B6B" }}>🚀 Launch</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DongChayDuAn() {
  const [data, setData]     = useState<DongChayData | null>(null);
  const [dang, setDang]     = useState(true);
  const [loiTai, setLoiTai] = useState("");
  const [loiStatus, setLoiStatus] = useState(0);

  const [locDuAn, setLocDuAn]           = useState("");
  const [locTrangThai, setLocTrangThai] = useState("");
  const [locKenh, setLocKenh]           = useState("");
  const [locSanPham, setLocSanPham]     = useState("");
  const [cheDo, setCheDo]               = useState<CheDo>("THANG");

  const [buocChon, setBuocChon]           = useState<string | null>(null);
  const [congViecChon, setCongViecChon]   = useState<string | null>(null);
  const [showToolbar, setShowToolbar]     = useState(true);
  const [hienLienKet, setHienLienKet]     = useState(() => {
    const v = localStorage.getItem("flowos-hien-lien-ket");
    return v === null ? true : v === "true";
  });
  const [ketNoiMode, setKetNoiMode]       = useState(false);

  const { undo, redo, canUndo, canRedo } = useUndoRedoGlobal();

  const userRole = useAppStore(s => s.user?.role);
  const canKetNoi = userRole === "QUAN_TRI_VIEN" || userRole === "TRUONG_NHOM";

  useEffect(() => {
    localStorage.setItem("flowos-hien-lien-ket", String(hienLienKet));
  }, [hienLienKet]);

  const taiDuLieu = useCallback(() => {
    setDang(true);
    const params = new URLSearchParams();
    if (locDuAn)    params.set("duAnId",    locDuAn);
    if (locKenh)    params.set("kenh",      locKenh);
    if (locSanPham) params.set("sanPhamId", locSanPham);
    const url = "/api/dong-chay" + (params.size > 0 ? "?" + params.toString() : "");
    setLoiTai("");
    setLoiStatus(0);
    goiApi(url).then(setData).catch((e) => { setLoiTai(e.message); setLoiStatus((e as { status?: number }).status ?? 0); }).finally(() => setDang(false));
  }, [locDuAn, locKenh, locSanPham]);

  useEffect(() => { taiDuLieu(); }, [taiDuLieu]);

  // Các sản phẩm được lọc theo kênh đang chọn
  const sanPhamLocKenh = useMemo(() => {
    const all = data?.sanPham ?? [];
    if (!locKenh) return all;
    return all.filter(sp => sp.kenh === locKenh);
  }, [data?.sanPham, locKenh]);

  // Khi đổi kênh → reset sản phẩm nếu sản phẩm không thuộc kênh mới
  const doiKenh = (k: string) => {
    setLocKenh(k);
    if (locSanPham) {
      const sp = data?.sanPham?.find(s => s.id === locSanPham);
      if (sp && sp.kenh !== k && k !== "") setLocSanPham("");
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 30, padding: "0 10px", borderRadius: 7,
    border: "1px solid #E0E0DD", fontSize: 12,
    outline: "none", cursor: "pointer", background: "#fff",
    color: "#1A1A1A",
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 11px", fontSize: 12, fontWeight: 600,
    border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    background: active ? "#008264" : "transparent",
    color: active ? "#fff" : "#6B6B6B",
    transition: "all 0.15s",
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 48px)",
      fontFamily: "'DM Sans', sans-serif",
      background: "#FAFAF9",
    }}>
      {/* ── Toolbar thu gọn/mở rộng ── */}
      {showToolbar ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderBottom: "1px solid #EBEBEA",
          background: "#fff", flexShrink: 0, flexWrap: "wrap",
          minHeight: 44,
        }}>
          {/* Filters */}
          <select value={locDuAn} onChange={(e) => setLocDuAn(e.target.value)} style={inputStyle}>
            <option value="">Tất cả dự án</option>
            {data?.duAn.map((da) => (
              <option key={da.id} value={da.id}>{da.ma} — {da.ten}</option>
            ))}
          </select>

          {/* Kênh filter */}
          <select value={locKenh} onChange={(e) => doiKenh(e.target.value)} style={inputStyle}>
            <option value="">Tất cả kênh</option>
            <option value="HT">HT (Hệ thống)</option>
            <option value="TT">TT (Thị trường)</option>
          </select>

          {/* Sản phẩm filter (cascade từ kênh) */}
          {(locKenh || (data?.sanPham?.length ?? 0) > 0) && (
            <select
              value={locSanPham}
              onChange={(e) => setLocSanPham(e.target.value)}
              style={{ ...inputStyle, maxWidth: 160 }}
            >
              <option value="">Tất cả sản phẩm</option>
              {sanPhamLocKenh.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.maSp ? `${sp.maSp} — ` : ""}{sp.ten}
                </option>
              ))}
            </select>
          )}

          <select value={locTrangThai} onChange={(e) => setLocTrangThai(e.target.value)} style={inputStyle}>
            <option value="">Tất cả trạng thái</option>
            <option value="CHUA_LAM">Chưa làm</option>
            <option value="DANG_LAM">Đang làm</option>
            <option value="BI_CHAN">Bị chặn</option>
            <option value="XONG">Xong</option>
          </select>

          {/* Reset filter */}
          {(locDuAn || locKenh || locSanPham || locTrangThai) && (
            <button
              onClick={() => { setLocDuAn(""); setLocKenh(""); setLocSanPham(""); setLocTrangThai(""); }}
              style={{
                height: 30, padding: "0 10px", borderRadius: 7, fontSize: 11,
                border: "1px solid #E0E0DD", background: "#FEF2F2",
                color: "#E24B4A", cursor: "pointer", fontWeight: 600, flexShrink: 0,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ✕ Bỏ lọc
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Legend */}
          <Legend />

          <div style={{ width: 1, height: 22, background: "#EBEBEA", margin: "0 2px", flexShrink: 0 }} />

          {/* View mode switcher */}
          <div style={{
            display: "flex", borderRadius: 8,
            border: "1px solid #E0E0DD", overflow: "hidden",
            background: "#F8F8F7", flexShrink: 0,
          }}>
            {(["TUAN", "THANG", "QUY", "NAM"] as CheDo[]).map((mode) => (
              <button key={mode} onClick={() => setCheDo(mode)} style={btnStyle(cheDo === mode)}>
                {CHE_DO_CONFIG[mode].nhan}
              </button>
            ))}
          </div>

          {/* Collapse button */}
          <button
            onClick={() => setShowToolbar(false)}
            title="Ẩn thanh điều khiển"
            style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              border: "1px solid #E0E0DD", background: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#9B9B98",
            }}
          >
            <ChevronUp size={14} />
          </button>
        </div>
      ) : (
        /* ── Mini bar khi thu gọn ── */
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 14px", borderBottom: "1px solid #EBEBEA",
          background: "#fff", flexShrink: 0, height: 32,
        }}>
          {/* View mode compact */}
          <div style={{
            display: "flex", borderRadius: 6,
            border: "1px solid #E0E0DD", overflow: "hidden",
            background: "#F8F8F7",
          }}>
            {(["TUAN", "THANG", "QUY", "NAM"] as CheDo[]).map((mode) => (
              <button key={mode} onClick={() => setCheDo(mode)} style={{ ...btnStyle(cheDo === mode), padding: "2px 9px", fontSize: 11 }}>
                {CHE_DO_CONFIG[mode].nhan}
              </button>
            ))}
          </div>

          {/* Filter indicator */}
          {(locDuAn || locTrangThai) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#008264" }}>
              <SlidersHorizontal size={11} />
              <span>Đang lọc</span>
            </div>
          )}

          {/* Expand button */}
          <button
            onClick={() => setShowToolbar(true)}
            title="Hiện thanh điều khiển"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: "1px solid #E0E0DD", background: "#fff", cursor: "pointer",
              color: "#6B6B6B",
            }}
          >
            <SlidersHorizontal size={11} />
            <span>Bộ lọc</span>
            <ChevronDown size={11} />
          </button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
        {dang ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <Loader2 size={28} style={{ color: "#008264", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13, color: "#9B9B98" }}>Đang tải dòng chảy...</span>
          </div>
        ) : loiTai ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <ZapOff size={32} color="#EF4444" />
            <span style={{ fontSize: 14, color: "#EF4444", fontWeight: 600, textAlign: "center", maxWidth: 320 }}>{loiTai}</span>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => taiDuLieu()}
                style={{ padding: "7px 18px", borderRadius: 8, background: "#008264", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 5 }}
              >
                ↺ Thử lại
              </button>
              {loiStatus === 401 && (
                <button
                  onClick={() => { localStorage.removeItem("auth-token"); window.location.href = "/dang-nhap"; }}
                  style={{ padding: "7px 18px", borderRadius: 8, background: "#FEF2F2", color: "#E24B4A", border: "1px solid #FECACA", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Đăng nhập lại
                </button>
              )}
            </div>
          </div>
        ) : data ? (
          <ReactFlowProvider>
            <DongChayCanvas
              data={data}
              locDuAn={locDuAn}
              locTrangThai={locTrangThai}
              cheDo={cheDo}
              onChonBuoc={setBuocChon}
              buocChon={buocChon}
              hienLienKet={hienLienKet}
              canKetNoi={canKetNoi}
              ketNoiMode={ketNoiMode}
              onExitKetNoi={() => setKetNoiMode(false)}
            />
            {buocChon && (
              <ChiTietBuocPanel
                buocId={buocChon}
                onClose={() => setBuocChon(null)}
                onCongViecClick={(id) => { setCongViecChon(id); }}
              />
            )}
          </ReactFlowProvider>
        ) : null}
      </div>

      {/* ── Footer bar (32px) — Undo/Redo + Hiện liên kết ── */}
      <div style={{
        height: 32, flexShrink: 0,
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 14px",
        background: "#fff", borderTop: "1px solid #EBEBEA",
      }}>
        {/* Undo button */}
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          title="Hoàn tác (Ctrl+Z)"
          style={{
            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
            border: "1px solid #E0E0DD",
            background: !canUndo ? "#F8F8F7" : "#fff",
            color: !canUndo ? "#D1D5DB" : "#374151",
            cursor: !canUndo ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}
        >↺</button>

        {/* Redo button */}
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          title="Làm lại (Ctrl+Y)"
          style={{
            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
            border: "1px solid #E0E0DD",
            background: !canRedo ? "#F8F8F7" : "#fff",
            color: !canRedo ? "#D1D5DB" : "#374151",
            cursor: !canRedo ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}
        >↻</button>

        <div style={{ width: 1, height: 18, background: "#EBEBEA", margin: "0 4px" }} />

        {/* Hiện liên kết checkbox */}
        <label style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 12, color: "#6B6B6B", cursor: "pointer",
          userSelect: "none",
        }}>
          <input
            type="checkbox"
            checked={hienLienKet}
            onChange={e => setHienLienKet(e.target.checked)}
            style={{ accentColor: "#008264", width: 13, height: 13, cursor: "pointer" }}
          />
          Hiện liên kết
        </label>

        {/* Kết nối bước — chỉ LEADER/ADMIN */}
        {canKetNoi && (
          <>
            <div style={{ width: 1, height: 18, background: "#EBEBEA", margin: "0 4px" }} />
            <button
              onClick={() => setKetNoiMode(m => !m)}
              title={ketNoiMode ? "Thoát chế độ kết nối (Esc)" : "Kết nối bước"}
              style={{
                height: 24, padding: "0 10px", borderRadius: 6, fontSize: 12,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                border: "1px solid",
                borderColor: ketNoiMode ? "#534AB7" : "#E0E0DD",
                background: ketNoiMode ? "#534AB7" : "#fff",
                color: ketNoiMode ? "#fff" : "#534AB7",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14 }}>⛓</span>
              {ketNoiMode ? "Đang kết nối..." : "Kết nối"}
            </button>
          </>
        )}
      </div>

      {/* Panel chi tiết công việc — cấp độ fixed toàn màn hình */}
      <PanelChiTietCongViec
        congViecId={congViecChon}
        onDong={() => setCongViecChon(null)}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
