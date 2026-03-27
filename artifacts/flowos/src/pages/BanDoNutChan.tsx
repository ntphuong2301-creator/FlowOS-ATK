/**
 * BanDoNutChan — Bản đồ nút chặn (CEO view)
 * CPM algorithm → hiển thị cây chặn từ Launch milestone → blockers
 */
import { useState, useEffect, useMemo, memo } from "react";
import ReactFlow, {
  Background, Controls, ReactFlowProvider,
  type Node, type Edge, type NodeProps,
  getStraightPath, BaseEdge, type EdgeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { AlertTriangle, Clock, Users, ChevronRight, Loader2, X, ZapOff, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuocCPM {
  id: string; ma: string; ten: string;
  duAnId: string; duAnMa: string; duAnTen: string;
  trangThai: string;
  nguoiPhuTrachId: string | null; nguoiPhuTrachTen: string | null;
  ngayBatDau: string | null; ngayKetThuc: string | null;
  soNgayDuKien: number; soCanTro: number;
  canTro: Array<{ id: string; ten: string; mucDo: string }>;
  ES: number; EF: number; LS: number; LF: number; float: number;
  laCritical: boolean; laNutChan: boolean;
}
interface PhuThuoc { buocId: string; phuThuocVaoId: string }
interface CotMoc { id: string; ma: string; ten: string; ngay: string; duAnId: string | null }
interface BanDoData { buoc: BuocCPM[]; phuThuoc: PhuThuoc[]; cotMoc: CotMoc[] }

// ─── Float color ──────────────────────────────────────────────────────────────

function floatColor(f: number): { bg: string; border: string; text: string } {
  if (f <= 0) return { bg: "#FEF2F2", border: "#E24B4A", text: "#991B1B" };
  if (f <= 3) return { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E" };
  if (f <= 7) return { bg: "#FFFBEB", border: "#D97706", text: "#78350F" };
  return { bg: "#F0FFF4", border: "#34D399", text: "#065F46" };
}

const TRANGTHAI_VI: Record<string, string> = {
  CHUA_LAM: "Chưa làm", DANG_LAM: "Đang làm", BI_CHAN: "Bị chặn", XONG: "Xong",
};
const MUCDO_VI: Record<string, string> = {
  RAT_NGHIEM_TRONG: "Rất nghiêm trọng", VUA_PHAI: "Vừa phải", NHE: "Nhẹ",
};

async function goiApi(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error("Lỗi tải dữ liệu");
  return res.json();
}

// Render markdown-bold text: **text** → <strong>text</strong>
function RenderMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ─── Custom Nodes ─────────────────────────────────────────────────────────────

const LaunchNode = memo(({ data }: NodeProps) => (
  <div style={{
    background: "#008264", color: "#fff", borderRadius: 12,
    padding: "10px 20px", fontFamily: "'DM Sans', sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    boxShadow: "0 4px 16px #00826444",
    minWidth: 160,
  }}>
    <div style={{ fontSize: 18 }}>🚀</div>
    <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>{data.ten}</div>
    <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{data.ngay}</div>
  </div>
));

const BuocNode = memo(({ data }: NodeProps) => {
  const b = data.buoc as BuocCPM;
  const fc = floatColor(b.float);
  const isBlocker = b.laNutChan;
  const isSelected = data.selected;

  return (
    <div
      onClick={() => data.onSelect(b.id)}
      style={{
        background: fc.bg,
        border: `${isBlocker ? 3 : 1.5}px solid ${fc.border}`,
        borderRadius: 10,
        padding: "10px 14px",
        fontFamily: "'DM Sans', sans-serif",
        cursor: "pointer", minWidth: 200, maxWidth: 240,
        boxShadow: isSelected ? `0 0 0 3px ${fc.border}66, 0 4px 12px ${fc.border}33`
          : isBlocker ? `0 4px 16px ${fc.border}44` : "none",
        transition: "box-shadow 0.15s",
        position: "relative",
      }}
    >
      {/* Blocker badge */}
      {isBlocker && (
        <div style={{
          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
          background: "#E24B4A", color: "#fff",
          fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 8,
          whiteSpace: "nowrap",
        }}>
          🔴 NÚT CHẶN
        </div>
      )}

      {/* MA + Tên */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: fc.border, flexShrink: 0 }}>{b.ma}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.3 }}>{b.ten}</span>
      </div>

      {/* DA */}
      <div style={{ fontSize: 10, color: "#6B6B6B", marginBottom: 4 }}>{b.duAnMa} — {b.duAnTen}</div>

      {/* Trạng thái + Float */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
          background: fc.border, color: "#fff",
        }}>{TRANGTHAI_VI[b.trangThai] ?? b.trangThai}</span>

        <span style={{
          fontSize: 9, fontWeight: 600,
          color: fc.text, background: fc.bg,
          border: `1px solid ${fc.border}`,
          padding: "1px 6px", borderRadius: 8,
        }}>
          Float: {b.float <= 0 ? "0" : `+${b.float}`} ngày
        </span>
      </div>

      {/* Người phụ trách */}
      {b.nguoiPhuTrachTen && (
        <div style={{ fontSize: 9, color: "#9B9B98", marginTop: 5, display: "flex", alignItems: "center", gap: 3 }}>
          <span>👤</span> {b.nguoiPhuTrachTen}
        </div>
      )}

      {/* Cản trở count */}
      {b.soCanTro > 0 && (
        <div style={{ fontSize: 9, color: "#E24B4A", marginTop: 3, fontWeight: 700 }}>
          ⚠ {b.soCanTro} cản trở đang mở
        </div>
      )}
    </div>
  );
});

const CriticalEdge = ({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return (
    <BaseEdge id={id} path={path} style={{
      stroke: data?.isBlocker ? "#E24B4A" : "#CCCCCC",
      strokeWidth: data?.isBlocker ? 2.5 : 1.5,
      strokeDasharray: data?.isBlocker ? undefined : "6 4",
    }} />
  );
};

const nodeTypes = { launch: LaunchNode, buoc: BuocNode };
const edgeTypes = { critical: CriticalEdge };

// ─── CPM Tree builder ─────────────────────────────────────────────────────────

function buildTree(data: BanDoData, selectedLaunch: string | null, onSelect: (id: string) => void): {
  nodes: Node[]; edges: Edge[];
} {
  const { buoc: buocs, phuThuoc, cotMoc } = data;

  const buocMap = new Map(buocs.map(b => [b.id, b]));
  const succs   = new Map<string, string[]>();
  const preds   = new Map<string, string[]>();

  for (const b of buocs) { succs.set(b.id, []); preds.set(b.id, []); }
  for (const pt of phuThuoc) {
    succs.get(pt.phuThuocVaoId)?.push(pt.buocId);
    preds.get(pt.buocId)?.push(pt.phuThuocVaoId);
  }

  // Find blockers and critical path nodes
  const blockerIds = new Set(buocs.filter(b => b.laNutChan).map(b => b.id));
  const criticalIds = new Set(buocs.filter(b => b.laCritical).map(b => b.id));

  // If no blockers, show all critical path nodes
  const showIds = blockerIds.size > 0 ? blockerIds : criticalIds;

  // BFS upstream from blockers to find their predecessors (up to 3 levels)
  const relevant = new Set<string>(showIds);
  const queue = [...showIds];
  let depth = 0;
  while (queue.length > 0 && depth < 4) {
    const next: string[] = [];
    for (const id of queue) {
      for (const predId of preds.get(id) ?? []) {
        if (!relevant.has(predId)) {
          relevant.add(predId);
          next.push(predId);
        }
      }
    }
    queue.length = 0; queue.push(...next);
    depth++;
  }

  const relevantArr = Array.from(relevant);

  // Layout: DAG with layers
  // Simple topological layout
  const layers = new Map<string, number>();
  const visited = new Set<string>();

  function assignLayer(id: string, layer: number) {
    if (!relevant.has(id)) return;
    const cur = layers.get(id) ?? 0;
    layers.set(id, Math.max(cur, layer));
    if (visited.has(id)) return;
    visited.add(id);
    for (const succId of succs.get(id) ?? []) {
      assignLayer(succId, layer + 1);
    }
  }

  // Start from nodes with no preds within relevant set
  for (const id of relevantArr) {
    const predsInRelevant = (preds.get(id) ?? []).filter(p => relevant.has(p));
    if (predsInRelevant.length === 0) assignLayer(id, 0);
  }

  // Group by layer
  const byLayer = new Map<number, string[]>();
  const maxLayer = Math.max(...Array.from(layers.values()));
  for (const [id, layer] of layers.entries()) {
    const list = byLayer.get(layer) ?? [];
    list.push(id);
    byLayer.set(layer, list);
  }

  // Build nodes
  const NODE_W = 250; const NODE_H = 120; const GAP_X = 40; const GAP_Y = 50;
  const LAYER_H = NODE_H + GAP_Y;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Launch milestones at top (layer -1)
  const launchesToShow = selectedLaunch
    ? cotMoc.filter(cm => cm.id === selectedLaunch)
    : cotMoc;

  launchesToShow.forEach((cm, i) => {
    nodes.push({
      id: `launch-${cm.id}`,
      type: "launch",
      position: { x: i * 200, y: -80 },
      data: { ten: cm.ma || cm.ten, ngay: new Date(cm.ngay).toLocaleDateString("vi-VN") },
      draggable: false,
    });
  });

  // Step nodes
  for (const [layer, ids] of byLayer.entries()) {
    const layerY = (maxLayer - layer) * LAYER_H;
    ids.forEach((id, i) => {
      const b = buocMap.get(id);
      if (!b) return;
      const totalW = ids.length * (NODE_W + GAP_X) - GAP_X;
      const startX = -totalW / 2;
      nodes.push({
        id,
        type: "buoc",
        position: { x: startX + i * (NODE_W + GAP_X), y: layerY },
        data: { buoc: b, onSelect, selected: false },
        draggable: false,
      });
    });
  }

  // Edges within relevant set
  for (const pt of phuThuoc) {
    if (!relevant.has(pt.buocId) || !relevant.has(pt.phuThuocVaoId)) continue;
    const src = buocMap.get(pt.phuThuocVaoId);
    const tgt = buocMap.get(pt.buocId);
    const isBlocker = src?.laNutChan || tgt?.laNutChan;
    edges.push({
      id: `e-${pt.phuThuocVaoId}-${pt.buocId}`,
      source: pt.phuThuocVaoId, target: pt.buocId,
      type: "critical",
      data: { isBlocker },
    });
  }

  // Launch → last critical nodes
  for (const cm of launchesToShow) {
    const lastNodes = relevantArr.filter(id => {
      const b = buocMap.get(id);
      if (!b || (cm.duAnId && b.duAnId !== cm.duAnId)) return false;
      const succsInRelevant = (succs.get(id) ?? []).filter(s => relevant.has(s));
      return succsInRelevant.length === 0;
    });
    for (const id of lastNodes) {
      edges.push({
        id: `launch-${cm.id}-${id}`,
        source: id, target: `launch-${cm.id}`,
        type: "critical", data: { isBlocker: false },
      });
    }
  }

  return { nodes, edges };
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function ChiTietNutChan({ buoc, onClose, cotMoc }: { buoc: BuocCPM; onClose: () => void; cotMoc?: CotMoc[] }) {
  const fc = floatColor(buoc.float);
  const [dangGoiAI, setDangGoiAI] = useState(false);
  const [goiY, setGoiY]           = useState<string | null>(null);
  const [loiAI, setLoiAI]         = useState("");

  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 340,
      background: "#fff", borderLeft: "1px solid #EBEBEA",
      zIndex: 20, display: "flex", flexDirection: "column",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.08)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid #EBEBEA",
        display: "flex", alignItems: "flex-start", gap: 8,
      }}>
        <div style={{
          flexShrink: 0, width: 8, height: 8, borderRadius: "50%",
          background: fc.border, marginTop: 5,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#008264" }}>{buoc.ma}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.3 }}>{buoc.ten}</div>
          <div style={{ fontSize: 10, color: "#6B6B6B", marginTop: 2 }}>{buoc.duAnMa} — {buoc.duAnTen}</div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "#9B9B98", padding: 4,
        }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* CPM Info */}
          <div style={{
            background: fc.bg, border: `1px solid ${fc.border}`,
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: fc.text, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Phân tích CPM
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 11 }}>
              <div><span style={{ color: "#9B9B98" }}>ES: </span><span style={{ fontWeight: 600 }}>{buoc.ES}d</span></div>
              <div><span style={{ color: "#9B9B98" }}>EF: </span><span style={{ fontWeight: 600 }}>{buoc.EF}d</span></div>
              <div><span style={{ color: "#9B9B98" }}>LS: </span><span style={{ fontWeight: 600 }}>{buoc.LS}d</span></div>
              <div><span style={{ color: "#9B9B98" }}>LF: </span><span style={{ fontWeight: 600 }}>{buoc.LF}d</span></div>
              <div style={{ gridColumn: "span 2", marginTop: 4 }}>
                <span style={{ color: "#9B9B98" }}>Float: </span>
                <span style={{ fontWeight: 800, color: fc.border }}>
                  {buoc.float <= 0 ? "0 ngày (CRITICAL)" : `${buoc.float} ngày đệm`}
                </span>
              </div>
            </div>
          </div>

          {/* Người phụ trách → ai cần ra quyết định */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Ai cần ra quyết định
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px", background: "#F8F8F7", borderRadius: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#008264", color: "#fff", fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {buoc.nguoiPhuTrachTen?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{buoc.nguoiPhuTrachTen ?? "Chưa chỉ định"}</div>
                <div style={{ fontSize: 10, color: "#9B9B98" }}>Người phụ trách bước</div>
              </div>
            </div>
          </div>

          {/* Cản trở */}
          {buoc.canTro.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#E24B4A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Lý do bị chặn ({buoc.canTro.length})
              </div>
              {buoc.canTro.map(ct => (
                <div key={ct.id} style={{
                  padding: "7px 10px", borderRadius: 7,
                  background: "#FEF2F2", border: "1px solid #FECACA",
                  marginBottom: 5,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#991B1B" }}>{ct.ten}</div>
                  <div style={{ fontSize: 10, color: "#B91C1C" }}>{MUCDO_VI[ct.mucDo] ?? ct.mucDo}</div>
                </div>
              ))}
            </div>
          )}

          {/* Dự báo nếu unblock hôm nay */}
          <div style={{
            background: "#F0F9F5", border: "1px solid #A7F3D0",
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#065F46", marginBottom: 6 }}>
              📅 Nếu unblock hôm nay
            </div>
            {buoc.laNutChan ? (
              <div style={{ fontSize: 11, color: "#065F46", lineHeight: 1.6 }}>
                Bước dự kiến hoàn thành trong <strong>{buoc.soNgayDuKien} ngày</strong> kể từ hôm nay
                {(() => {
                  const finishDate = new Date();
                  finishDate.setDate(finishDate.getDate() + buoc.soNgayDuKien);
                  const cmLienQuan = cotMoc?.find(cm => cm.duAnId === buoc.duAnId);
                  if (cmLienQuan) {
                    const cmDate = new Date(cmLienQuan.ngay);
                    const conLai  = Math.round((cmDate.getTime() - finishDate.getTime()) / 86_400_000);
                    return (
                      <>
                        {" "}(<strong>{finishDate.toLocaleDateString("vi-VN")}</strong>).{" "}
                        {conLai >= 0
                          ? <span style={{ color: "#008264" }}>Cột mốc {cmLienQuan.ma} còn <strong>{conLai} ngày</strong> đệm.</span>
                          : <span style={{ color: "#E24B4A" }}>Cột mốc {cmLienQuan.ma} sẽ trễ <strong>{Math.abs(conLai)} ngày</strong>.</span>
                        }
                      </>
                    );
                  }
                  return <> (<strong>{finishDate.toLocaleDateString("vi-VN")}</strong>).</>;
                })()}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#065F46" }}>
                Bước này có <strong>{buoc.float} ngày đệm</strong> — chưa cần can thiệp ngay. Theo dõi để đảm bảo không rơi vào critical path.
              </div>
            )}
          </div>

          {/* AI Gợi ý */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              🤖 AI Gợi ý giải quyết
            </div>

            {!goiY && !dangGoiAI && (
              <button
                onClick={() => {
                  setDangGoiAI(true); setLoiAI(""); setGoiY(null);
                  const cmLienQuan = cotMoc?.find(cm => !cm.duAnId || cm.duAnId === buoc.duAnId);
                  goiApi(`/api/ban-do-nut-chan/${buoc.id}/goi-y`, {
                    method: "POST",
                    body: JSON.stringify({
                      float: buoc.float,
                      ES: buoc.ES, EF: buoc.EF, LS: buoc.LS, LF: buoc.LF,
                      soNgayDuKien: buoc.soNgayDuKien,
                      cotMocNgay: cmLienQuan ? new Date(cmLienQuan.ngay).toLocaleDateString("vi-VN") : undefined,
                    }),
                  })
                    .then((d: { goiY: string }) => setGoiY(d.goiY))
                    .catch(() => setLoiAI("Không thể tạo gợi ý — thử lại sau"))
                    .finally(() => setDangGoiAI(false));
                }}
                style={{
                  width: "100%", padding: "8px 12px",
                  background: "#008264", color: "#fff",
                  border: "none", borderRadius: 8, cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <span>✨</span> Phân tích với AI
              </button>
            )}

            {dangGoiAI && (
              <div style={{
                padding: "12px", background: "#F8F8F7",
                border: "1px solid #EBEBEA", borderRadius: 8,
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 12, color: "#6B6B6B",
              }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "#008264" }} />
                Đang phân tích với AI...
              </div>
            )}

            {loiAI && !dangGoiAI && (
              <div style={{
                padding: "8px 10px", background: "#FEF2F2",
                border: "1px solid #FECACA", borderRadius: 8,
                fontSize: 11, color: "#991B1B",
              }}>
                {loiAI}
              </div>
            )}

            {goiY && !dangGoiAI && (
              <div style={{
                padding: "10px 12px", background: "#FAFFF8",
                border: "1px solid #BBF7D0", borderRadius: 8,
                fontSize: 11, color: "#1A1A1A", lineHeight: 1.7,
              }}>
                {goiY.split("\n").filter(l => l.trim()).map((line, i) => (
                  <div key={i} style={{ marginBottom: i < goiY.split("\n").filter(l => l.trim()).length - 1 ? 6 : 0 }}>
                    <RenderMarkdown text={line} />
                  </div>
                ))}
                <button
                  onClick={() => { setGoiY(null); setLoiAI(""); }}
                  style={{
                    marginTop: 8, padding: "3px 8px",
                    background: "transparent", border: "1px solid #D1FAE5",
                    borderRadius: 6, cursor: "pointer",
                    fontSize: 10, color: "#6B9B6B",
                  }}
                >
                  Phân tích lại
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inner canvas ─────────────────────────────────────────────────────────────

function BanDoCanvas({ data }: { data: BanDoData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLaunch, setSelectedLaunch] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  };

  const { nodes: rawNodes, edges } = useMemo(
    () => buildTree(data, selectedLaunch, handleSelect),
    [data, selectedLaunch]
  );

  // Mark selected node
  const nodes = rawNodes.map(n => ({
    ...n,
    data: { ...n.data, selected: n.id === selectedId },
  }));

  const selectedBuoc = selectedId ? data.buoc.find(b => b.id === selectedId) : null;

  const blockerCount = data.buoc.filter(b => b.laNutChan).length;
  const criticalCount = data.buoc.filter(b => b.laCritical).length;

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden", display: "flex" }}>
      {/* Stats bar */}
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 10,
        display: "flex", gap: 8,
      }}>
        <div style={{
          background: "#fff", border: "1px solid #E0E0DD",
          borderRadius: 8, padding: "6px 12px", fontSize: 11,
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <span style={{ color: "#E24B4A", fontWeight: 800 }}>🔴 {blockerCount}</span>
          <span style={{ color: "#6B6B6B" }}>nút chặn</span>
        </div>
        <div style={{
          background: "#fff", border: "1px solid #E0E0DD",
          borderRadius: 8, padding: "6px 12px", fontSize: 11,
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <span style={{ color: "#EF4444", fontWeight: 700 }}>{criticalCount}</span>
          <span style={{ color: "#6B6B6B" }}>bước critical</span>
        </div>

        {/* Launch filter */}
        <select
          value={selectedLaunch ?? ""}
          onChange={e => setSelectedLaunch(e.target.value || null)}
          style={{
            background: "#fff", border: "1px solid #E0E0DD",
            borderRadius: 8, padding: "6px 10px", fontSize: 11,
            cursor: "pointer", color: "#1A1A1A", outline: "none",
          }}
        >
          <option value="">Tất cả cột mốc</option>
          {data.cotMoc.map(cm => (
            <option key={cm.id} value={cm.id}>🚀 {cm.ma} — {new Date(cm.ngay).toLocaleDateString("vi-VN")}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 60, left: 12, zIndex: 10,
        background: "#fff", border: "1px solid #E0E0DD",
        borderRadius: 8, padding: "8px 12px", fontSize: 10,
        display: "flex", flexDirection: "column", gap: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontWeight: 700, color: "#6B6B6B", marginBottom: 2 }}>Màu Float</div>
        {[
          { label: "≤0 ngày (Critical)", ...floatColor(-1) },
          { label: "1–3 ngày", ...floatColor(2) },
          { label: "4–7 ngày", ...floatColor(5) },
          { label: ">7 ngày", ...floatColor(10) },
        ].map(({ label, border, bg }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `2px solid ${border}` }} />
            <span style={{ color: "#6B6B6B" }}>{label}</span>
          </div>
        ))}
      </div>

      <ReactFlow
        nodes={nodes} edges={edges}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodeClick={(_, n) => n.type === "buoc" && handleSelect(n.id)}
        fitView fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2} maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#F8F8F7" }}
      >
        <Background color="#EBEBEA" gap={40} />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>

      {selectedBuoc && (
        <ChiTietNutChan buoc={selectedBuoc} onClose={() => setSelectedId(null)} cotMoc={data.cotMoc} />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BanDoNutChan() {
  const [data, setData]     = useState<BanDoData | null>(null);
  const [dang, setDang]     = useState(true);
  const [loiTai, setLoiTai] = useState("");

  const tai = () => {
    setDang(true); setLoiTai("");
    goiApi("/api/ban-do-nut-chan")
      .then(setData).catch(e => setLoiTai(e.message)).finally(() => setDang(false));
  };

  useEffect(() => { tai(); }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 48px)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 16px", borderBottom: "1px solid #EBEBEA",
        background: "#fff", flexShrink: 0, height: 48,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🗺</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Bản đồ nút chặn</div>
            <div style={{ fontSize: 10, color: "#9B9B98" }}>CPM — Chỉ quản trị viên</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={tai}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 12px", borderRadius: 7, fontSize: 12,
            border: "1px solid #E0E0DD", background: "#fff",
            cursor: "pointer", color: "#6B6B6B",
          }}
        >
          <RefreshCw size={13} /> Tải lại
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
        {dang ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
            <Loader2 size={28} style={{ color: "#008264", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13, color: "#9B9B98" }}>Đang phân tích critical path...</span>
          </div>
        ) : loiTai ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
            <ZapOff size={28} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{loiTai}</span>
            <button onClick={tai} style={{ fontSize: 12, color: "#008264", cursor: "pointer", background: "none", border: "none" }}>Thử lại</button>
          </div>
        ) : data ? (
          <ReactFlowProvider>
            <BanDoCanvas data={data} />
          </ReactFlowProvider>
        ) : null}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
