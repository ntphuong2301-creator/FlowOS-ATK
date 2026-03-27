/**
 * PanelChiTietCongViec — Panel trượt từ phải (520px)
 * 2 tab: "Chi tiết" & "Liên kết & Tác động"
 */
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

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
  return res;
}

// ─── Kiểu dữ liệu ────────────────────────────────────────────────────────────

interface NguoiDung { id: string; ten: string; larkUserId?: string | null }
interface BuocTomTat { id: string; ten: string; ma: string }
interface DuAnTomTat { id: string; ten: string; ma: string }

interface CongViecChiTiet {
  id: string; ten: string; trangThai: string; mucUuTien?: string;
  dinhNghiaHoanThanh?: string | null;
  ngayBatDau?: string | null; ngayKetThuc?: string | null; ngayKetThucThucTe?: string | null;
  soNgayTre: number;
  buocQuyTrinh?: BuocTomTat | null;
  duAn: DuAnTomTat;
  nguoiPhuTrach?: NguoiDung | null;
  canTro?: Array<{ id: string; ten: string; trangThai: string }>;
  phuThuocVao?: Array<{
    loai: string; soNgayBuffer: number;
    phuThuocVao: { id: string; ten: string; trangThai: string; ngayKetThuc?: string | null; nguoiPhuTrach?: NguoiDung | null; buocQuyTrinh?: BuocTomTat | null; duAn: DuAnTomTat };
  }>;
  caCongViecPhuThuoc?: Array<{
    loai: string; soNgayBuffer: number;
    congViec: { id: string; ten: string; trangThai: string; ngayKetThuc?: string | null; nguoiPhuTrach?: NguoiDung | null; buocQuyTrinh?: BuocTomTat | null; duAn: DuAnTomTat };
  }>;
}

interface DepData {
  congViec: CongViecChiTiet;
  upstream: { direct: UpstreamItem[]; indirect: UpstreamItem[]; trangThai: string };
  downstream: { direct: DownstreamItem[]; indirect: DownstreamItem[]; cotMocBiAnh: CotMoc[] };
  cotMocBiAnh: CotMoc[];
  soNgayTreHienTai: number;
}

interface UpstreamItem {
  id: string; ten: string; trangThai: string; soNgayTre: number;
  ngayKetThuc?: string | null; ngayKetThucThucTe?: string | null;
  nguoiPhuTrach?: NguoiDung | null;
  buocQuyTrinh?: BuocTomTat | null;
  duAn: DuAnTomTat;
  loaiPhuThuoc?: string;
}

interface DownstreamItem extends UpstreamItem {
  soNgayBiAnh: number;
  ngayKTMoi?: string | null;
}

interface CotMoc { ten: string; ngayGoc: string; ngayMoi: string; soNgayLui: number }

interface ImpactItem { congViecId: string; ten: string; ngayKTGoc: string | null; ngayKTMoi: string | null; soNgayLui: number }
interface ImpactResult { danhSachAnh: ImpactItem[]; cotMocBiAnh: CotMoc[]; launchBiAnh: boolean; soNgayLuiLaunch: number }

// ─── Hằng số UI ──────────────────────────────────────────────────────────────

const TRANG_THAI_LABEL: Record<string, string> = {
  CHUA_LAM: "Chưa làm", DANG_LAM: "Đang làm", XONG: "Xong",
  BI_CHAN: "Bị chặn", HUY: "Hủy",
};
const TRANG_THAI_COLOR: Record<string, string> = {
  CHUA_LAM: "#9B9B98", DANG_LAM: "#F59E0B", XONG: "#008264",
  BI_CHAN: "#EF4444", HUY: "#6B7280",
};
const UU_TIEN_LABEL: Record<string, string> = {
  THAP: "Thấp", TRUNG_BINH: "Trung bình", CAO: "Cao", KHAN_CAP: "Khẩn cấp",
};
const UU_TIEN_COLOR: Record<string, string> = {
  THAP: "#6B7280", TRUNG_BINH: "#3B82F6", CAO: "#F59E0B", KHAN_CAP: "#EF4444",
};

function ngayVN(s?: string | null): string {
  if (!s) return "—";
  return format(new Date(s), "dd/MM/yyyy", { locale: vi });
}

function tinhTreUpstream(cv: UpstreamItem): number {
  if (cv.trangThai === "XONG") return 0;
  const han = cv.ngayKetThucThucTe ?? cv.ngayKetThuc;
  if (!han) return 0;
  const diff = Math.floor((Date.now() - new Date(han).getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

// ─── Component badge ─────────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, borderRadius: 5, padding: "2px 8px", display: "inline-block" }}>
      {label}
    </span>
  );
}

// ─── Item upstream/downstream ─────────────────────────────────────────────────

function CardCongViecLienKet({
  cv, soNgayTre, soNgayBiAnh, ngayKTMoi, isUpstream,
}: {
  cv: UpstreamItem; soNgayTre?: number; soNgayBiAnh?: number; ngayKTMoi?: string | null; isUpstream: boolean;
}) {
  const tre = soNgayTre ?? tinhTreUpstream(cv);
  const color = TRANG_THAI_COLOR[cv.trangThai] ?? "#9B9B98";
  const han = cv.ngayKetThucThucTe ?? cv.ngayKetThuc;

  return (
    <div style={{ border: `1.5px solid ${tre > 0 ? "#FCA5A5" : "#E5E7EB"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: tre > 0 ? "#FFF5F5" : "#FAFAFA" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: "#1A1A1A", flex: 1 }}>{cv.ten}</span>
        <Badge label={TRANG_THAI_LABEL[cv.trangThai] ?? cv.trangThai} color={color} bg={color + "22"} />
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6B7280", flexWrap: "wrap" }}>
        {cv.nguoiPhuTrach && <span>👤 {cv.nguoiPhuTrach.ten}</span>}
        {cv.buocQuyTrinh && <span>📍 {cv.buocQuyTrinh.ma}</span>}
        <span>📅 Hạn: {ngayVN(han)}</span>
        {isUpstream && tre > 0 && (
          <span style={{ color: "#EF4444", fontWeight: 600 }}>Trễ {tre} ngày</span>
        )}
        {isUpstream && tre === 0 && cv.trangThai === "XONG" && (
          <span style={{ color: "#008264", fontWeight: 600 }}>✓ Xong rồi</span>
        )}
        {isUpstream && tre === 0 && cv.trangThai !== "XONG" && han && (
          <span style={{ color: "#3B82F6" }}>
            Còn {Math.max(0, Math.floor((new Date(han).getTime() - Date.now()) / 86400000))} ngày
          </span>
        )}
      </div>
      {!isUpstream && soNgayBiAnh !== undefined && soNgayBiAnh > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#F59E0B", fontWeight: 500 }}>
          Nếu tôi trễ {soNgayBiAnh} ngày → hạn mới: {ngayVN(ngayKTMoi)}
        </div>
      )}
    </div>
  );
}

// ─── Panel chính ─────────────────────────────────────────────────────────────

interface Props {
  congViecId: string | null;
  onDong: () => void;
}

export default function PanelChiTietCongViec({ congViecId, onDong }: Props) {
  const [tab, setTab] = useState<"chitiet" | "lienket">("chitiet");
  const [cv, setCv] = useState<CongViecChiTiet | null>(null);
  const [dep, setDep] = useState<DepData | null>(null);
  const [dangTai, setDangTai] = useState(false);

  // Flow cập nhật hạn
  const [buocCapNhat, setBuocCapNhat] = useState(0); // 0=ẩn, 1=chọn ngày, 2=xem impact, 3=xong
  const [ngayMoi, setNgayMoi] = useState("");
  const [lyDo, setLyDo] = useState("");
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [guiLark, setGuiLark] = useState(true);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [thongBaoOK, setThongBaoOK] = useState("");

  const taiData = useCallback(async (id: string) => {
    setDangTai(true);
    try {
      const [r1, r2] = await Promise.all([
        goiApi(`/api/cong-viec/${id}`),
        goiApi(`/api/cong-viec/${id}/dependency`),
      ]);
      if (r1.ok) setCv(await r1.json());
      if (r2.ok) setDep(await r2.json());
    } catch { /* ignore */ }
    setDangTai(false);
  }, []);

  useEffect(() => {
    if (!congViecId) { setCv(null); setDep(null); return; }
    setTab("chitiet");
    setBuocCapNhat(0);
    setImpact(null);
    setThongBaoOK("");
    taiData(congViecId);
  }, [congViecId, taiData]);

  // ── Bước 2: Tính impact ──────────────────────────────────────────────────
  async function buoc2TinhImpact() {
    if (!congViecId || !ngayMoi) return;
    setDangXuLy(true);
    try {
      const r = await goiApi(`/api/cong-viec/${congViecId}/cap-nhat-timeline`, {
        method: "POST",
        body: JSON.stringify({ ngayKetThucMoi: ngayMoi, lyDo }),
      });
      if (r.ok) {
        const d = await r.json();
        setImpact(d.impact);
        setBuocCapNhat(2);
      }
    } catch { /* ignore */ }
    setDangXuLy(false);
  }

  // ── Bước 3: Xác nhận impact ──────────────────────────────────────────────
  async function buoc3XacNhan() {
    if (!congViecId || !impact) return;
    setDangXuLy(true);
    try {
      const r = await goiApi(`/api/cong-viec/${congViecId}/confirm-impact`, {
        method: "POST",
        body: JSON.stringify({ danhSachAnh: impact.danhSachAnh, guiThongBao: guiLark }),
      });
      if (r.ok) {
        const d = await r.json();
        setThongBaoOK(d.thongBao);
        setBuocCapNhat(3);
        taiData(congViecId);
      }
    } catch { /* ignore */ }
    setDangXuLy(false);
  }

  if (!congViecId) return null;

  const soNgayTre = dep?.soNgayTreHienTai ?? 0;
  const han = cv?.ngayKetThucThucTe ?? cv?.ngayKetThuc;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onDong}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 1000 }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 520,
        background: "#fff", zIndex: 1001, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <button onClick={onDong} style={{ border: "none", background: "none", cursor: "pointer", color: "#9B9B98", fontSize: 20, lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>✕</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {dangTai ? (
                <div style={{ height: 20, background: "#F3F4F6", borderRadius: 4, width: "60%" }} />
              ) : (
                <>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.3 }}>{cv?.ten ?? "—"}</h2>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {cv?.trangThai && (
                      <Badge
                        label={TRANG_THAI_LABEL[cv.trangThai] ?? cv.trangThai}
                        color={TRANG_THAI_COLOR[cv.trangThai] ?? "#9B9B98"}
                        bg={(TRANG_THAI_COLOR[cv.trangThai] ?? "#9B9B98") + "22"}
                      />
                    )}
                    {cv?.mucUuTien && (
                      <Badge
                        label={UU_TIEN_LABEL[cv.mucUuTien] ?? cv.mucUuTien}
                        color={UU_TIEN_COLOR[cv.mucUuTien] ?? "#6B7280"}
                        bg={(UU_TIEN_COLOR[cv.mucUuTien] ?? "#6B7280") + "22"}
                      />
                    )}
                    {soNgayTre > 0 && (
                      <Badge label={`Trễ ${soNgayTre} ngày`} color="#EF4444" bg="#FEE2E2" />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {([["chitiet", "Chi tiết"], ["lienket", "Liên kết & Tác động"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  border: "none", background: "none", cursor: "pointer",
                  padding: "8px 16px", fontSize: 13, fontWeight: tab === key ? 700 : 400,
                  color: tab === key ? "#008264" : "#6B7280",
                  borderBottom: tab === key ? "2px solid #008264" : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {dangTai ? (
            <div style={{ color: "#9B9B98", textAlign: "center", marginTop: 40 }}>Đang tải...</div>
          ) : tab === "chitiet" ? (
            <TabChiTiet cv={cv} soNgayTre={soNgayTre} han={han} />
          ) : (
            <TabLienKet
              dep={dep}
              soNgayTre={soNgayTre}
              buocCapNhat={buocCapNhat}
              ngayMoi={ngayMoi}
              lyDo={lyDo}
              impact={impact}
              guiLark={guiLark}
              dangXuLy={dangXuLy}
              thongBaoOK={thongBaoOK}
              onSetNgayMoi={setNgayMoi}
              onSetLyDo={setLyDo}
              onSetGuiLark={setGuiLark}
              onBatDauCapNhat={() => { setBuocCapNhat(1); setImpact(null); setThongBaoOK(""); }}
              onTinhImpact={buoc2TinhImpact}
              onXacNhan={buoc3XacNhan}
              onHuy={() => setBuocCapNhat(0)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Tab Chi tiết ────────────────────────────────────────────────────────────

function TabChiTiet({ cv, soNgayTre, han }: { cv: CongViecChiTiet | null; soNgayTre: number; han?: string | null }) {
  if (!cv) return <div style={{ color: "#9B9B98", textAlign: "center", marginTop: 40 }}>Không tìm thấy công việc</div>;

  return (
    <div>
      {/* Info block */}
      <div style={{ border: "1px solid #F3F4F6", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
        <InfoRow label="Bước quy trình" value={cv.buocQuyTrinh ? `${cv.buocQuyTrinh.ma} — ${cv.buocQuyTrinh.ten}` : "—"} />
        <InfoRow label="Dự án" value={cv.duAn.ten} />
        <InfoRow label="Incharge" value={cv.nguoiPhuTrach?.ten ?? "—"} />
        <InfoRow label="Hạn gốc" value={ngayVN(cv.ngayKetThuc)} />
        {cv.ngayKetThucThucTe && (
          <InfoRow label="Hạn thực tế" value={ngayVN(cv.ngayKetThucThucTe)} />
        )}
        {soNgayTre > 0 && (
          <InfoRow label="Số ngày trễ" value={`${soNgayTre} ngày`} valueColor="#EF4444" />
        )}
        {cv.dinhNghiaHoanThanh && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #F3F4F6" }}>
            <div style={{ fontSize: 11, color: "#9B9B98", marginBottom: 3 }}>Định nghĩa hoàn thành</div>
            <div style={{ fontSize: 13, color: "#374151" }}>{cv.dinhNghiaHoanThanh}</div>
          </div>
        )}
      </div>

      {/* Cản trở */}
      {cv.canTro && cv.canTro.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Cản trở liên quan ({cv.canTro.length})</SectionTitle>
          {cv.canTro.map((ct) => (
            <div key={ct.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#FFF5F5", borderRadius: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>🚧</span>
              <span style={{ fontSize: 13, color: "#1A1A1A", flex: 1 }}>{ct.ten}</span>
              <Badge label={ct.trangThai === "MO" ? "Đang mở" : ct.trangThai === "DANG_XU_LY" ? "Xử lý" : "Đã giải quyết"} color={ct.trangThai === "MO" ? "#EF4444" : "#008264"} bg={ct.trangThai === "MO" ? "#FEE2E2" : "#D1FAE5"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid #F9FAFB" }}>
      <span style={{ fontSize: 12, color: "#9B9B98", width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: valueColor ?? "#1A1A1A", fontWeight: valueColor ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "#9B9B98", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{children}</div>;
}

// ─── Tab Liên kết & Tác động ─────────────────────────────────────────────────

interface TabLienKetProps {
  dep: DepData | null;
  soNgayTre: number;
  buocCapNhat: number;
  ngayMoi: string; lyDo: string;
  impact: ImpactResult | null;
  guiLark: boolean;
  dangXuLy: boolean;
  thongBaoOK: string;
  onSetNgayMoi: (v: string) => void;
  onSetLyDo: (v: string) => void;
  onSetGuiLark: (v: boolean) => void;
  onBatDauCapNhat: () => void;
  onTinhImpact: () => void;
  onXacNhan: () => void;
  onHuy: () => void;
}

function TabLienKet(p: TabLienKetProps) {
  const { dep, soNgayTre, buocCapNhat, ngayMoi, lyDo, impact, guiLark, dangXuLy, thongBaoOK } = p;

  const upstream = dep ? [...(dep.upstream.direct), ...(dep.upstream.indirect)] : [];
  const downstream = dep ? [...(dep.downstream.direct), ...(dep.downstream.indirect)] : [];
  const cotMocs = dep?.cotMocBiAnh ?? [];

  const upstreamTre = upstream.filter((cv) => tinhTreUpstream(cv) > 0);

  return (
    <div>
      {/* ── UPSTREAM ─────────────────────────────────────────────── */}
      <SectionTitle>⬆ Upstream — Tôi đang chờ ({upstream.length} việc)</SectionTitle>

      {upstreamTre.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12 }}>
          ⚠ {upstreamTre.map((cv) => cv.ten).join(", ")} đang trễ → Bạn có thể bị ảnh hưởng
        </div>
      )}

      {upstream.length === 0 ? (
        <div style={{ color: "#9B9B98", fontSize: 13, marginBottom: 16 }}>Không có task nào ở upstream</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {upstream.map((cv) => (
            <CardCongViecLienKet key={cv.id} cv={cv} isUpstream={true} />
          ))}
        </div>
      )}

      {/* ── DOWNSTREAM ─────────────────────────────────────────────── */}
      <SectionTitle>⬇ Downstream — Đang chờ tôi ({downstream.length} việc)</SectionTitle>

      {downstream.length === 0 ? (
        <div style={{ color: "#9B9B98", fontSize: 13, marginBottom: 16 }}>Không có task nào ở downstream</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {downstream.map((cv) => (
            <CardCongViecLienKet
              key={cv.id} cv={cv} isUpstream={false}
              soNgayBiAnh={(cv as DownstreamItem).soNgayBiAnh}
              ngayKTMoi={(cv as DownstreamItem).ngayKTMoi}
            />
          ))}
        </div>
      )}

      {/* ── CỘT MỐC ─────────────────────────────────────────────────── */}
      {cotMocs.length > 0 && soNgayTre > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Cột mốc bị ảnh hưởng (nếu trễ {soNgayTre} ngày)</SectionTitle>
          {cotMocs.map((cm, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#FFF5F5", borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
              <span>🚀</span>
              <span style={{ flex: 1, color: "#1A1A1A" }}>{cm.ten}</span>
              <span style={{ color: "#9B9B98", textDecoration: "line-through" }}>{ngayVN(cm.ngayGoc)}</span>
              <span style={{ color: "#EF4444", fontWeight: 600 }}>→ {ngayVN(cm.ngayMoi)}</span>
              <span style={{ color: "#EF4444", fontSize: 11 }}>+{cm.soNgayLui}n</span>
            </div>
          ))}
        </div>
      )}

      {/* ── THANH CÔNG CỤ TIMELINE ─────────────────────────────────── */}
      {soNgayTre > 0 && buocCapNhat === 0 && (
        <div style={{ border: "1.5px solid #FCA5A5", borderRadius: 10, padding: "14px 16px", background: "#FFF5F5", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", marginBottom: 12 }}>
            Task này đang trễ {soNgayTre} ngày
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={p.onBatDauCapNhat}
              style={{ ...btnStyle("#3B82F6"), width: "100%", justifyContent: "flex-start" }}
            >
              📅 Cập nhật hạn mới + tính lại chuỗi
            </button>
            {downstream.length > 0 && (
              <button
                onClick={p.onBatDauCapNhat}
                style={{ ...btnStyle("#F59E0B"), width: "100%", justifyContent: "flex-start" }}
              >
                📢 Thông báo {downstream.length} người downstream qua Lark
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── FLOW CẬP NHẬT HẠN ──────────────────────────────────────── */}
      {buocCapNhat === 1 && (
        <div style={{ border: "1.5px solid #3B82F6", borderRadius: 10, padding: "14px 16px", background: "#EFF6FF", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF", marginBottom: 12 }}>Cập nhật hạn mới</div>
          <label style={labelStyle}>Ngày kết thúc mới</label>
          <input
            type="date" value={ngayMoi}
            onChange={(e) => p.onSetNgayMoi(e.target.value)}
            style={inputStyle}
          />
          <label style={labelStyle}>Lý do (tuỳ chọn)</label>
          <textarea
            value={lyDo}
            onChange={(e) => p.onSetLyDo(e.target.value)}
            placeholder="VD: Cần thêm thời gian kiểm thử..."
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={p.onHuy} style={btnStyle("#9B9B98")}>Hủy</button>
            <button onClick={p.onTinhImpact} disabled={!ngayMoi || dangXuLy} style={btnStyle("#3B82F6")}>
              {dangXuLy ? "Đang tính..." : "Xem tác động →"}
            </button>
          </div>
        </div>
      )}

      {buocCapNhat === 2 && impact && (
        <div style={{ border: "1.5px solid #F59E0B", borderRadius: 10, padding: "14px 16px", background: "#FFFBEB", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 10 }}>
            Xem lại tác động — {impact.danhSachAnh.length} công việc bị ảnh hưởng:
          </div>
          {impact.danhSachAnh.map((item, i) => (
            <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>
              • {item.ten}:{" "}
              <span style={{ textDecoration: "line-through", color: "#9B9B98" }}>{ngayVN(item.ngayKTGoc)}</span>
              {" → "}
              <span style={{ color: "#DC2626", fontWeight: 600 }}>{ngayVN(item.ngayKTMoi)}</span>
              <span style={{ color: "#EF4444" }}> (+{item.soNgayLui}n)</span>
            </div>
          ))}
          {impact.launchBiAnh && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: "#FEE2E2", borderRadius: 6, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
              ⚠ Launch có nguy cơ lùi ~{impact.soNgayLuiLaunch} ngày
            </div>
          )}
          {impact.danhSachAnh.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={guiLark} onChange={(e) => p.onSetGuiLark(e.target.checked)} />
              Gửi thông báo Lark cho {impact.danhSachAnh.length} người
            </label>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={p.onHuy} style={btnStyle("#9B9B98")}>Hủy</button>
            <button onClick={p.onXacNhan} disabled={dangXuLy} style={btnStyle("#008264")}>
              {dangXuLy ? "Đang xử lý..." : "✓ Xác nhận cập nhật"}
            </button>
          </div>
        </div>
      )}

      {buocCapNhat === 3 && thongBaoOK && (
        <div style={{ border: "1.5px solid #008264", borderRadius: 10, padding: "12px 16px", background: "#F0FDF4", marginBottom: 16, fontSize: 13, color: "#065F46" }}>
          ✅ {thongBaoOK}
          <button onClick={p.onHuy} style={{ marginLeft: 12, background: "none", border: "none", color: "#008264", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Đóng</button>
        </div>
      )}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const btnStyle = (bg: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6,
  background: bg, color: "#fff", border: "none", borderRadius: 7,
  padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  opacity: 1, transition: "opacity 0.15s",
});

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, color: "#6B7280", marginBottom: 4, marginTop: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: "1px solid #D1D5DB", borderRadius: 6, padding: "7px 10px",
  fontSize: 13, color: "#1A1A1A", fontFamily: "'DM Sans', sans-serif",
};
