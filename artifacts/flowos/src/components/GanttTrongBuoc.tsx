/**
 * GanttTrongBuoc — Gantt kéo thả cho công việc trong 1 bước
 * Hỗ trợ: drag-to-resize, CPM validation, today/deadline lines,
 *         mũi tên phụ thuộc, thanh mờ [DA khác], auto-save
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NguoiDung { id: string; ten: string }

interface PhuThuocCVTruoc {
  id: string; ten: string; trangThai: string;
  ngayBatDau?: string | null; ngayKetThuc?: string | null;
  buocQuyTrinhId?: string | null;
  buocQuyTrinh?: {
    id: string; ma: string; ten: string; duAnId: string;
    duAn?: { id: string; ma: string; ten: string };
  } | null;
}

interface CongViec {
  id: string; ten: string; trangThai: string;
  ngayBatDau?: string | null; ngayKetThuc?: string | null;
  nguoiPhuTrach?: NguoiDung | null;
  phuThuocVao?: Array<{ phuThuocVao: PhuThuocCVTruoc }>;
}

interface Buoc {
  id: string; ma: string; ten: string; duAnId?: string;
  ngayBatDau?: string | null; ngayKetThuc?: string | null;
  phuThuocVao?: Array<{ loai: string; phuThuocVao: { id: string; ma: string; ten: string; ngayKetThuc?: string | null; trangThai: string } }>;
  cacBuocPhuThuoc?: Array<{ buoc: { id: string; ma: string; ten: string; ngayBatDau?: string | null; trangThai: string } }>;
}

interface CanhBao { message: string; detail?: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MS   = 86_400_000;
const PPD      = 36;
const ROW_H    = 48;
const GHOST_H  = 36;
const HEADER_H = 40;
const LABEL_W  = 180;

const TS_COLOR: Record<string, string> = {
  CHUA_LAM: "#CCCCCC", DANG_LAM: "#EF9F27", XONG: "#1D9E75", BI_CHAN: "#E24B4A",
};
const TS_BG: Record<string, string> = {
  CHUA_LAM: "#F0F0EE", DANG_LAM: "#FDE68A", XONG: "#A7F3D0", BI_CHAN: "#FCA5A5",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
function dateToStr(d: Date): string {
  return d.toISOString().split("T")[0];
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}
function ngayVN(d: Date) {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── CPM validation ───────────────────────────────────────────────────────────

function kiemTraCPM(
  buoc: Buoc, cvId: string, newStart: Date, newEnd: Date,
  tatCaCongViec: Map<string, { start: Date; end: Date }>
): CanhBao | null {
  const buocStart = toDate(buoc.ngayBatDau);
  const buocEnd   = toDate(buoc.ngayKetThuc);

  if (buocStart && newStart < buocStart) {
    return {
      message: `Không thể bắt đầu trước ngày ${ngayVN(buocStart)}`,
      detail: `Bước "${buoc.ten}" bắt đầu vào ${ngayVN(buocStart)} — công việc không thể vượt ra ngoài phạm vi bước.`,
    };
  }
  if (buocEnd && newEnd > buocEnd) {
    return {
      message: `Không thể kết thúc sau ${ngayVN(buocEnd)} (hạn bước)`,
      detail: `Bước "${buoc.ten}" kết thúc vào ${ngayVN(buocEnd)}. Kéo dài hơn sẽ làm lỡ deadline của bước.`,
    };
  }
  if (newStart >= newEnd) {
    return { message: "Ngày kết thúc phải sau ngày bắt đầu", detail: "Khoảng thời gian tối thiểu là 1 ngày." };
  }
  if (buocEnd && newEnd >= buocEnd && buoc.cacBuocPhuThuoc?.length) {
    const lateSteps = buoc.cacBuocPhuThuoc.filter(
      (pt) => toDate(pt.buoc.ngayBatDau) && toDate(pt.buoc.ngayBatDau)! <= newEnd
    );
    if (lateSteps.length > 0) {
      const names = lateSteps.map((pt) => pt.buoc.ma).join(", ");
      return {
        message: `Cảnh báo CPM: ảnh hưởng bước ${names}`,
        detail: `Nếu công việc này kéo dài đến ${ngayVN(newEnd)}, có thể làm trễ bước phụ thuộc: ${names}.`,
      };
    }
  }
  return null;
}

// ─── Ghost bar type ────────────────────────────────────────────────────────────

interface GhostBar {
  key: string;
  cvId: string;        // id of the external task (predecessor)
  ten: string;
  buocMa: string;
  duAnMa: string;
  start: Date; end: Date;
  dependentCvIds: string[]; // which local cvIds depend on this ghost
}

// ─── Component chính ──────────────────────────────────────────────────────────

interface Props {
  buoc: Buoc;
  congViecs: CongViec[];
  onClose?: () => void;
  onTaskClick?: (id: string) => void;
}

export default function GanttTrongBuoc({ buoc, congViecs, onClose, onTaskClick }: Props) {
  const [localDates, setLocalDates] = useState<Map<string, { start: Date; end: Date }>>(new Map());
  const [saving, setSaving]         = useState<Set<string>>(new Set());
  const [saved, setSaved]           = useState<Set<string>>(new Set());
  const [canhBao, setCanhBao]       = useState<CanhBao | null>(null);
  const [hoverCv, setHoverCv]       = useState<string | null>(null);
  const [selectedCv, setSelectedCv] = useState<string | null>(null);

  const dragRef = useRef<{
    cvId: string; handle: "left" | "right" | "move";
    initMouseX: number; initStart: Date; initEnd: Date;
    constrained: boolean;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Tính ghost bars (phụ thuộc từ DA/bước khác) ────────────────────────────
  const ghostBars = useMemo<GhostBar[]>(() => {
    const ghostMap = new Map<string, GhostBar>();
    for (const cv of congViecs) {
      if (!cv.phuThuocVao) continue;
      for (const pt of cv.phuThuocVao) {
        const pred = pt.phuThuocVao;
        // External if buocQuyTrinhId differs from current buoc
        const isExternal = pred.buocQuyTrinhId && pred.buocQuyTrinhId !== buoc.id;
        if (!isExternal) continue;

        const s = toDate(pred.ngayBatDau);
        const e = toDate(pred.ngayKetThuc);
        if (!s || !e) continue;

        const key = pred.id;
        if (ghostMap.has(key)) {
          ghostMap.get(key)!.dependentCvIds.push(cv.id);
        } else {
          ghostMap.set(key, {
            key,
            cvId: pred.id,
            ten: pred.ten,
            buocMa: pred.buocQuyTrinh?.ma ?? "?",
            duAnMa: pred.buocQuyTrinh?.duAn?.ma ?? "DA khác",
            start: s, end: e,
            dependentCvIds: [cv.id],
          });
        }
      }
    }
    return Array.from(ghostMap.values());
  }, [congViecs, buoc.id]);

  // ── Tính khoảng ngày hiển thị ──────────────────────────────────────────────
  const viewStart = useMemo(() => {
    const allDates: Date[] = [new Date()];
    for (const cv of congViecs) {
      const s = toDate(cv.ngayBatDau); const e = toDate(cv.ngayKetThuc);
      if (s) allDates.push(s); if (e) allDates.push(e);
    }
    for (const g of ghostBars) { allDates.push(g.start); allDates.push(g.end); }
    const buocS = toDate(buoc.ngayBatDau); const buocE = toDate(buoc.ngayKetThuc);
    if (buocS) allDates.push(buocS); if (buocE) allDates.push(buocE);
    const earliest = new Date(allDates.reduce((a, b) => a < b ? a : b));
    earliest.setDate(earliest.getDate() - 3);
    earliest.setHours(0, 0, 0, 0);
    return earliest;
  }, [congViecs, buoc, ghostBars]);

  const viewEnd = useMemo(() => {
    const allDates: Date[] = [new Date()];
    for (const cv of congViecs) {
      const s = toDate(cv.ngayBatDau); const e = toDate(cv.ngayKetThuc);
      if (s) allDates.push(s); if (e) allDates.push(e);
    }
    for (const g of ghostBars) { allDates.push(g.start); allDates.push(g.end); }
    const buocE = toDate(buoc.ngayKetThuc);
    if (buocE) allDates.push(buocE);
    const latest = new Date(allDates.reduce((a, b) => a > b ? a : b));
    latest.setDate(latest.getDate() + 7);
    return latest;
  }, [congViecs, buoc, ghostBars]);

  const totalDays   = Math.max(30, diffDays(viewStart, viewEnd));
  const canvasW     = totalDays * PPD;
  const todayOff    = diffDays(viewStart, new Date());
  const buocE       = toDate(buoc.ngayKetThuc);
  const deadlineOff = buocE ? diffDays(viewStart, buocE) : null;

  // ── Row layout ──────────────────────────────────────────────────────────────
  // Real tasks first, then ghost bars below
  const realRowCount  = congViecs.length;
  const ghostStartRow = realRowCount;
  // y-position helpers
  function realRowY(rowIdx: number) { return HEADER_H + rowIdx * ROW_H; }
  function ghostRowY(ghostIdx: number) { return HEADER_H + realRowCount * ROW_H + ghostIdx * GHOST_H; }
  const totalHeight = HEADER_H + realRowCount * ROW_H + ghostBars.length * GHOST_H;

  // ── Init local dates ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = new Map<string, { start: Date; end: Date }>();
    let cursor = new Date(viewStart);
    for (const cv of congViecs) {
      const s = toDate(cv.ngayBatDau) ?? cursor;
      const e = toDate(cv.ngayKetThuc) ?? addDays(s, 3);
      map.set(cv.id, { start: s, end: e });
      cursor = addDays(e, 1);
    }
    setLocalDates(map);
  }, [buoc.id]);

  const getCV = (id: string) => localDates.get(id);

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const onMouseDownHandle = useCallback((
    e: React.MouseEvent, cvId: string, handle: "left" | "right" | "move"
  ) => {
    e.preventDefault(); e.stopPropagation();
    const dates = localDates.get(cvId);
    if (!dates) return;
    dragRef.current = {
      cvId, handle,
      initMouseX: e.clientX,
      initStart: new Date(dates.start),
      initEnd: new Date(dates.end),
      constrained: false,
    };
    setCanhBao(null);
  }, [localDates]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { cvId, handle, initMouseX, initStart, initEnd } = dragRef.current;
      const deltaDays = Math.round((e.clientX - initMouseX) / PPD);

      let newStart = new Date(initStart);
      let newEnd   = new Date(initEnd);
      if (handle === "left")  newStart = addDays(initStart, deltaDays);
      if (handle === "right") newEnd   = addDays(initEnd,   deltaDays);
      if (handle === "move")  { newStart = addDays(initStart, deltaDays); newEnd = addDays(initEnd, deltaDays); }

      if (handle === "left"  && newStart >= newEnd) newStart = addDays(newEnd, -1);
      if (handle === "right" && newEnd <= newStart) newEnd   = addDays(newStart, 1);

      const allDatesMap = new Map(Array.from(localDates.entries()));
      allDatesMap.set(cvId, { start: newStart, end: newEnd });
      const warning = kiemTraCPM(buoc, cvId, newStart, newEnd, allDatesMap);

      if (warning) { setCanhBao(warning); dragRef.current.constrained = true; return; }
      dragRef.current.constrained = false;
      setCanhBao(null);
      setLocalDates(prev => new Map([...prev, [cvId, { start: newStart, end: newEnd }]]));
    };

    const onUp = async () => {
      if (!dragRef.current) return;
      const { cvId, constrained } = dragRef.current;
      dragRef.current = null;
      if (constrained) return;
      const dates = localDates.get(cvId);
      if (!dates) return;

      setSaving(prev => new Set([...prev, cvId]));
      try {
        await goiApi(`/api/cong-viec/${cvId}`, {
          method: "PATCH",
          body: JSON.stringify({ ngayBatDau: dateToStr(dates.start), ngayKetThuc: dateToStr(dates.end) }),
        });
        setSaved(prev => new Set([...prev, cvId]));
        setTimeout(() => setSaved(prev => { const s = new Set(prev); s.delete(cvId); return s; }), 2000);
      } catch (err) {
        setCanhBao({ message: "Không thể lưu — lỗi kết nối", detail: String(err) });
      }
      setSaving(prev => { const s = new Set(prev); s.delete(cvId); return s; });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [localDates, buoc]);

  // ── Timeline header cells ───────────────────────────────────────────────────
  const headerCells: React.ReactNode[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(viewStart, i);
    const isToday = d.toDateString() === new Date().toDateString();
    const isMon = d.getDay() === 1;
    if (d.getDate() === 1 || i === 0 || isMon) {
      headerCells.push(
        <div key={i} style={{ position: "absolute", left: i * PPD, top: 0, width: 1, height: HEADER_H, background: "#EBEBEA" }} />
      );
    }
    if (d.getDate() === 1 || i === 0) {
      headerCells.push(
        <div key={`m${i}`} style={{
          position: "absolute", left: i * PPD + 4, top: 2,
          fontSize: 9, fontWeight: 700, color: "#6B6B6B",
          letterSpacing: "0.05em", whiteSpace: "nowrap",
        }}>
          {d.toLocaleDateString("vi-VN", { month: "short", year: "numeric" })}
        </div>
      );
    }
    if (d.getDate() % 7 === 1 || i === 0 || isMon) {
      headerCells.push(
        <div key={`d${i}`} style={{
          position: "absolute", left: i * PPD + 3, top: 24,
          fontSize: 9, color: isToday ? "#EF4444" : "#9B9B98",
          fontWeight: isToday ? 800 : 400, whiteSpace: "nowrap",
        }}>
          {d.getDate()}
        </div>
      );
    }
  }

  // ── Tính SVG arrows ─────────────────────────────────────────────────────────
  // Map cvId → row index in real rows
  const cvRowMap = new Map<string, number>(congViecs.map((cv, i) => [cv.id, i]));
  // Map ghostCvId → ghost row index
  const ghostRowMap = new Map<string, number>(ghostBars.map((g, i) => [g.cvId, i]));

  interface Arrow {
    x1: number; y1: number; x2: number; y2: number;
    dashed: boolean; color: string;
  }
  const arrows: Arrow[] = [];

  for (const cv of congViecs) {
    if (!cv.phuThuocVao) continue;
    const currRowIdx = cvRowMap.get(cv.id);
    const currDates  = localDates.get(cv.id);
    if (currRowIdx === undefined || !currDates) continue;
    const currX = diffDays(viewStart, currDates.start) * PPD;
    const currY = realRowY(currRowIdx) + ROW_H / 2;

    for (const pt of cv.phuThuocVao) {
      const pred = pt.phuThuocVao;
      const isExternal = pred.buocQuyTrinhId && pred.buocQuyTrinhId !== buoc.id;

      if (!isExternal) {
        // Within-buoc: find pred by id in congViecs
        const predRowIdx = cvRowMap.get(pred.id);
        const predDates  = localDates.get(pred.id);
        if (predRowIdx === undefined || !predDates) continue;
        const predX = diffDays(viewStart, predDates.end) * PPD;
        const predY = realRowY(predRowIdx) + ROW_H / 2;
        arrows.push({ x1: predX, y1: predY, x2: currX, y2: currY, dashed: false, color: "#4B91D9" });
      } else {
        // Cross-project: arrow from ghost bar
        const ghostIdx = ghostRowMap.get(pred.id);
        if (ghostIdx === undefined) continue;
        const ghostEnd = ghostBars[ghostIdx]?.end;
        if (!ghostEnd) continue;
        const gX = diffDays(viewStart, ghostEnd) * PPD;
        const gY = ghostRowY(ghostIdx) + GHOST_H / 2;
        arrows.push({ x1: gX, y1: gY, x2: currX, y2: currY, dashed: true, color: "#9B6B6B" });
      }
    }
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
      height: "100%", background: "#fff",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid #EBEBEA", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#008264" }}>{buoc.ma}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{buoc.ten}</div>
          {buocE && (
            <div style={{ fontSize: 10, color: "#9B9B98", marginTop: 2 }}>
              Hạn bước: {ngayVN(buocE)}
              {buocE < new Date() && (
                <span style={{ color: "#EF4444", fontWeight: 700, marginLeft: 6 }}>⚠ Đã quá hạn</span>
              )}
            </div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            width: 24, height: 24, borderRadius: 6,
            border: "1px solid #E0E0DD", background: "#fff",
            cursor: "pointer", fontSize: 14, color: "#9B9B98",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        )}
      </div>

      {/* Warning banner */}
      {canhBao && (
        <div style={{
          background: "#FEF3C7", borderBottom: "1px solid #FDE68A",
          padding: "8px 14px", flexShrink: 0,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>⚠ {canhBao.message}</div>
          {canhBao.detail && <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>{canhBao.detail}</div>}
        </div>
      )}

      {/* Gantt area */}
      <div ref={containerRef} style={{ flex: 1, display: "flex", overflow: "auto" }}>
        {/* Left: Task labels */}
        <div style={{
          width: LABEL_W, flexShrink: 0, borderRight: "1px solid #EBEBEA",
          background: "#fff", zIndex: 2,
        }}>
          <div style={{ height: HEADER_H, borderBottom: "1px solid #EBEBEA" }} />

          {/* Real tasks */}
          {congViecs.map((cv) => {
            const ts = TS_COLOR[cv.trangThai] ?? "#CCC";
            const isSaving = saving.has(cv.id);
            const isSaved  = saved.has(cv.id);
            return (
              <div key={cv.id} style={{
                height: ROW_H, display: "flex", alignItems: "center",
                padding: "0 10px 0 12px", gap: 6, borderBottom: "1px solid #F5F5F3",
                background: selectedCv === cv.id ? "#F0F9F5" : "transparent",
                cursor: onTaskClick ? "pointer" : "default",
              }} onClick={() => { setSelectedCv(cv.id === selectedCv ? null : cv.id); onTaskClick?.(cv.id); }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: ts, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#1A1A1A", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cv.ten}
                  </div>
                  {cv.nguoiPhuTrach && (
                    <div style={{ fontSize: 9, color: "#9B9B98" }}>{cv.nguoiPhuTrach.ten}</div>
                  )}
                </div>
                {isSaving && <div style={{ fontSize: 9, color: "#9B9B98" }}>⏳</div>}
                {isSaved  && <div style={{ fontSize: 9, color: "#008264" }}>✓</div>}
              </div>
            );
          })}

          {/* Ghost task labels */}
          {ghostBars.length > 0 && (
            <>
              <div style={{
                height: 20, display: "flex", alignItems: "center",
                padding: "0 12px", borderBottom: "1px solid #F5F5F3",
                background: "#F8F8F7",
              }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: "#9B9B98", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Phụ thuộc ngoài
                </span>
              </div>
              {ghostBars.map((g) => (
                <div key={g.key} style={{
                  height: GHOST_H, display: "flex", alignItems: "center",
                  padding: "0 10px 0 12px", gap: 5, borderBottom: "1px solid #F5F5F3",
                  background: "#FAFAF9", opacity: 0.85,
                }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#9B6B6B", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: "#7A5A5A", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.ten}
                    </div>
                    <div style={{ fontSize: 8, color: "#B09B9B" }}>[{g.duAnMa}] {g.buocMa}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Right: Timeline + bars + SVG arrows */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          <div style={{ width: canvasW, height: Math.max(totalHeight, 200), position: "relative" }}>
            {/* Timeline header */}
            <div style={{ height: HEADER_H, position: "sticky", top: 0, zIndex: 3, background: "#fff", borderBottom: "1px solid #EBEBEA" }}>
              {headerCells}
            </div>

            {/* Weekend shading */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = addDays(viewStart, i);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i} style={{
                  position: "absolute", left: i * PPD, top: HEADER_H,
                  width: PPD, bottom: 0,
                  background: isWeekend ? "#F8F8F7" : "transparent",
                  borderRight: "1px solid #F5F5F3",
                  pointerEvents: "none",
                }} />
              );
            })}

            {/* Today line */}
            <div style={{
              position: "absolute", left: todayOff * PPD, top: HEADER_H, bottom: 0,
              width: 2, background: "#EF4444", opacity: 0.5, zIndex: 4, pointerEvents: "none",
            }} />

            {/* Deadline line */}
            {deadlineOff !== null && (
              <div style={{
                position: "absolute", left: deadlineOff * PPD, top: HEADER_H, bottom: 0,
                width: 2, background: "#008264", opacity: 0.7, zIndex: 4, pointerEvents: "none",
              }}>
                <div style={{
                  position: "absolute", top: 4, left: 3,
                  fontSize: 9, fontWeight: 700, color: "#008264", whiteSpace: "nowrap",
                }}>Hạn bước</div>
              </div>
            )}

            {/* Real task bars */}
            {congViecs.map((cv, rowIdx) => {
              const dates = getCV(cv.id);
              if (!dates) return null;

              const left  = diffDays(viewStart, dates.start) * PPD;
              const w     = Math.max(PPD, diffDays(dates.start, dates.end) * PPD);
              const top   = realRowY(rowIdx) + 8;
              const barH  = ROW_H - 16;
              const color = TS_COLOR[cv.trangThai] ?? "#CCC";
              const bg    = TS_BG[cv.trangThai]   ?? "#EEE";
              const isHover = hoverCv === cv.id;
              const isSel   = selectedCv === cv.id;
              const daysCount = Math.round(diffDays(dates.start, dates.end));
              const overdue = dates.end < new Date() && cv.trangThai !== "XONG";
              const overdueDays = overdue ? Math.round(diffDays(dates.end, new Date())) : 0;

              return (
                <div key={cv.id} style={{ position: "absolute", top, left, height: barH, width: w, zIndex: 2 }}>
                  <div
                    onMouseEnter={() => setHoverCv(cv.id)}
                    onMouseLeave={() => setHoverCv(null)}
                    onMouseDown={(e) => onMouseDownHandle(e, cv.id, "move")}
                    style={{
                      position: "absolute", inset: 0,
                      background: isSel ? color : bg,
                      border: `2px solid ${color}`,
                      borderRadius: 6, cursor: "grab",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      userSelect: "none",
                      boxShadow: (isHover || isSel) ? `0 2px 8px ${color}44` : "none",
                      transition: "box-shadow 0.15s, background 0.15s",
                      overflow: "hidden",
                    }}
                  >
                    {w >= 60 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: isSel ? "#fff" : color, flexShrink: 0 }}>
                        {daysCount}d
                      </span>
                    )}
                    {w >= 100 && (
                      <span style={{
                        fontSize: 10, color: isSel ? "#fff" : "#1A1A1A",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: w - 60,
                      }}>
                        {cv.ten}
                      </span>
                    )}
                    {overdue && w >= 50 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: "#B91C1C",
                        background: "#FEE2E2", padding: "1px 4px", borderRadius: 8, flexShrink: 0,
                      }}>+{overdueDays}d</span>
                    )}
                  </div>

                  {/* Left drag handle */}
                  <div
                    onMouseDown={(e) => onMouseDownHandle(e, cv.id, "left")}
                    style={{
                      position: "absolute", left: -4, top: "10%", width: 8, height: "80%",
                      background: color, borderRadius: 3, cursor: "ew-resize", zIndex: 5,
                      opacity: isHover || isSel ? 1 : 0, transition: "opacity 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <div style={{ width: 1, height: "50%", background: "#fff", marginRight: 1 }} />
                    <div style={{ width: 1, height: "50%", background: "#fff" }} />
                  </div>

                  {/* Right drag handle */}
                  <div
                    onMouseDown={(e) => onMouseDownHandle(e, cv.id, "right")}
                    style={{
                      position: "absolute", right: -4, top: "10%", width: 8, height: "80%",
                      background: color, borderRadius: 3, cursor: "ew-resize", zIndex: 5,
                      opacity: isHover || isSel ? 1 : 0, transition: "opacity 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <div style={{ width: 1, height: "50%", background: "#fff", marginRight: 1 }} />
                    <div style={{ width: 1, height: "50%", background: "#fff" }} />
                  </div>

                  {/* Tooltip */}
                  {isHover && (
                    <div style={{
                      position: "absolute", bottom: barH + 8, left: 0, zIndex: 10,
                      background: "#1A1A1A", color: "#fff",
                      borderRadius: 8, padding: "7px 10px", fontSize: 11, whiteSpace: "nowrap",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }}>
                      <div style={{ fontWeight: 700 }}>{cv.ten}</div>
                      <div style={{ opacity: 0.8, marginTop: 2 }}>
                        {ngayVN(dates.start)} → {ngayVN(dates.end)} · {daysCount} ngày
                      </div>
                      {cv.nguoiPhuTrach && (
                        <div style={{ opacity: 0.7, marginTop: 1 }}>👤 {cv.nguoiPhuTrach.ten}</div>
                      )}
                      {overdue && (
                        <div style={{ color: "#FCA5A5", marginTop: 2 }}>⚠ Trễ {overdueDays} ngày</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ghost bars (cross-project deps) */}
            {ghostBars.map((g, ghostIdx) => {
              const left = diffDays(viewStart, g.start) * PPD;
              const w    = Math.max(PPD, diffDays(g.start, g.end) * PPD);
              const top  = ghostRowY(ghostIdx) + 4;
              const barH = GHOST_H - 8;
              return (
                <div key={g.key} title={`${g.ten} [${g.duAnMa}/${g.buocMa}]`} style={{
                  position: "absolute", top, left, height: barH, width: w, zIndex: 2,
                  background: "#EDE0E0",
                  border: "1.5px dashed #9B6B6B",
                  borderRadius: 5, opacity: 0.75,
                  display: "flex", alignItems: "center", paddingLeft: 6,
                  overflow: "hidden",
                }}>
                  <span style={{ fontSize: 8, color: "#7A5A5A", fontWeight: 600, whiteSpace: "nowrap" }}>
                    [{g.duAnMa}] {w > 80 ? g.ten : ""}
                  </span>
                </div>
              );
            })}

            {/* ── SVG Dependency arrows ───────────────────────────────────── */}
            <svg
              style={{
                position: "absolute", top: 0, left: 0,
                width: canvasW, height: totalHeight,
                pointerEvents: "none", zIndex: 5, overflow: "visible",
              }}
            >
              <defs>
                <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#4B91D9" />
                </marker>
                <marker id="arrowRed" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#9B6B6B" />
                </marker>
              </defs>
              {arrows.map((a, i) => {
                const cx1 = a.x1 + Math.abs(a.x2 - a.x1) * 0.4;
                const cx2 = a.x2 - Math.abs(a.x2 - a.x1) * 0.4;
                const markerId = a.dashed ? "arrowRed" : "arrowBlue";
                return (
                  <path
                    key={i}
                    d={`M ${a.x1} ${a.y1} C ${cx1} ${a.y1}, ${cx2} ${a.y2}, ${a.x2} ${a.y2}`}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={a.dashed ? 1.5 : 2}
                    strokeDasharray={a.dashed ? "5 4" : undefined}
                    opacity={0.75}
                    markerEnd={`url(#${markerId})`}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: "8px 14px", borderTop: "1px solid #EBEBEA", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 9, color: "#9B9B98" }}>
          🖱 Kéo thanh để đổi ngày · Kéo tay cầm (||) hai bên để co/giãn
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
          <svg width="20" height="10"><path d="M0,5 L16,5" stroke="#4B91D9" strokeWidth="2" markerEnd="url(#arrowBlue)" /><marker id="arrowBlue2" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L0,4 L4,2 z" fill="#4B91D9" /></marker></svg>
          <span style={{ color: "#9B9B98" }}>Phụ thuộc nội bộ</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
          <svg width="20" height="10"><path d="M0,5 L16,5" stroke="#9B6B6B" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
          <span style={{ color: "#9B9B98" }}>Phụ thuộc DA khác</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
          <div style={{ width: 2, height: 10, background: "#EF4444", opacity: 0.6 }} />
          <span style={{ color: "#9B9B98" }}>Hôm nay</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
          <div style={{ width: 2, height: 10, background: "#008264" }} />
          <span style={{ color: "#9B9B98" }}>Hạn bước</span>
        </div>
      </div>
    </div>
  );
}
