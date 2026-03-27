import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Plus, Search, ChevronDown, Shield, Eye,
  Pencil, Ban, CheckCircle2, X, Save, Loader2,
  Clock, LayoutList, Activity, Link2,
} from "lucide-react";
import { goiApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type CapQuyen = "QUAN_TRI_VIEN" | "TRUONG_NHOM" | "THANH_VIEN" | "QUAN_SAT";

interface DuAnNho { id: string; ten: string; ma: string; mau: string }
interface PhanQuyenDA {
  id: string; duAnId: string; xem: boolean; sua: boolean;
  taoBuoc: boolean; taoCongViec: boolean; duAn: DuAnNho;
}
interface NhatKyMuc {
  id: string; bangDuLieu: string; hanhDong: string;
  giaTriMoi: unknown; taoLuc: string;
  duAn?: { ten: string; ma: string } | null;
}
interface ThanhVien {
  id: string; ten: string; email: string; capQuyen: CapQuyen;
  boPhan?: string | null; mauAvatar?: string | null;
  larkUserId?: string | null; trangThai: boolean; taoLuc: string;
  phanQuyenDuAn: PhanQuyenDA[];
  duAnTruong: DuAnNho[];
  nhatKy: NhatKyMuc[];
  _count: { congViecPhuTrach: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAU_AVATAR = [
  "#008264","#378ADD","#534AB7","#EF9F27","#E24B4A",
  "#0C447C","#9333EA","#059669","#DB2777","#D97706",
];

const CAP_QUYEN_INFO: Record<CapQuyen, { label: string; mau: string; bg: string; icon: string }> = {
  QUAN_TRI_VIEN: { label: "Quản trị viên", mau: "#E24B4A", bg: "#FEF2F2", icon: "👑" },
  TRUONG_NHOM:   { label: "Trưởng nhóm",   mau: "#0C447C", bg: "#EFF6FF", icon: "🏆" },
  THANH_VIEN:    { label: "Thành viên",     mau: "#008264", bg: "#E8F5F1", icon: "👤" },
  QUAN_SAT:      { label: "Quan sát",       mau: "#888888", bg: "#F5F5F3", icon: "👁️" },
};

const FONT = "'DM Sans', sans-serif";
const PRIMARY = "#008264";

// ─── Avatar helper ───────────────────────────────────────────────────────────

function Avatar({ ten, mau, size = 36 }: { ten: string; mau?: string | null; size?: number }) {
  const bg = mau || "#008264";
  const ch = (ten || "?").charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
      fontFamily: FONT,
    }}>{ch}</div>
  );
}

// ─── Badge cấp quyền ─────────────────────────────────────────────────────────

function BadgeCapQuyen({ cq }: { cq: CapQuyen }) {
  const { label, mau, bg, icon } = CAP_QUYEN_INFO[cq] ?? CAP_QUYEN_INFO.THANH_VIEN;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
      borderRadius: 99, background: bg, color: mau, fontSize: 11, fontWeight: 600,
      fontFamily: FONT,
    }}>{icon} {label}</span>
  );
}

// ─── CapQuyen Dropdown ───────────────────────────────────────────────────────

function DropdownCapQuyen({ value, onChange }: { value: CapQuyen; onChange: (v: CapQuyen) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const info = CAP_QUYEN_INFO[value];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        border: "1px solid #E0E0DD", borderRadius: 8, background: "#fff",
        cursor: "pointer", fontFamily: FONT, fontSize: 13, width: "100%",
      }}>
        <span>{info.icon} {info.label}</span>
        <ChevronDown size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", left: 0, right: 0, background: "#fff",
          border: "1px solid #E0E0DD", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          zIndex: 100, overflow: "hidden",
        }}>
          {(Object.keys(CAP_QUYEN_INFO) as CapQuyen[]).map(cq => {
            const ci = CAP_QUYEN_INFO[cq];
            return (
              <div key={cq} onClick={() => { onChange(cq); setOpen(false); }} style={{
                padding: "10px 14px", cursor: "pointer", fontSize: 13,
                background: value === cq ? "#F5F5F3" : "transparent",
                display: "flex", alignItems: "center", gap: 8, fontFamily: FONT,
              }}>
                <span>{ci.icon}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{ci.label}</div>
                  <div style={{ fontSize: 11, color: "#9B9B98" }}>
                    {cq === "QUAN_TRI_VIEN" && "Toàn quyền hệ thống"}
                    {cq === "TRUONG_NHOM"   && "Quản lý dự án được phân công"}
                    {cq === "THANH_VIEN"    && "Cập nhật công việc của mình"}
                    {cq === "QUAN_SAT"      && "Chỉ xem, không chỉnh sửa"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal Thêm thành viên ───────────────────────────────────────────────────

interface ModalThemProps { onDong: () => void; onTao: (data: ThanhVien) => void }

function ModalThemThanhVien({ onDong, onTao }: ModalThemProps) {
  const [form, setForm] = useState({
    ten: "", email: "", matKhau: "", boPhan: "",
    capQuyen: "THANH_VIEN" as CapQuyen, mauAvatar: "#008264",
  });
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ten.trim() || !form.email.trim() || !form.matKhau.trim()) {
      setLoi("Vui lòng điền đầy đủ tên, email và mật khẩu");
      return;
    }
    setDang(true); setLoi("");
    try {
      const kq = await goiApi("/api/thanh-vien", { method: "POST", body: JSON.stringify(form) });
      onTao(kq as ThanhVien);
    } catch (err) {
      setLoi((err as Error).message || "Lỗi tạo thành viên");
    } finally {
      setDang(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={(e) => e.target === e.currentTarget && onDong()}>
      <div style={{
        background: "#fff", borderRadius: 16, width: 480, padding: 32,
        fontFamily: FONT, boxShadow: "0 24px 64px rgba(0,0,0,.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Thêm thành viên mới</div>
          <button onClick={onDong} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color="#9B9B98" />
          </button>
        </div>

        {/* Avatar preview */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Avatar ten={form.ten || "?"} mau={form.mauAvatar} size={52} />
          <div>
            <div style={{ fontSize: 12, color: "#9B9B98", marginBottom: 6 }}>Màu avatar</div>
            <div style={{ display: "flex", gap: 6 }}>
              {MAU_AVATAR.map(m => (
                <div key={m} onClick={() => setForm(f => ({ ...f, mauAvatar: m }))} style={{
                  width: 20, height: 20, borderRadius: "50%", background: m, cursor: "pointer",
                  border: form.mauAvatar === m ? "2px solid #1A1A1A" : "2px solid transparent",
                }} />
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 4 }}>Họ và tên *</label>
              <input value={form.ten} onChange={e => setForm(f => ({ ...f, ten: e.target.value }))}
                placeholder="Nguyễn Văn A" style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 4 }}>Email *</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                type="email" placeholder="email@atk.com" style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 4 }}>Mật khẩu *</label>
              <input value={form.matKhau} onChange={e => setForm(f => ({ ...f, matKhau: e.target.value }))}
                type="password" placeholder="••••••••" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 4 }}>Bộ phận</label>
              <input value={form.boPhan} onChange={e => setForm(f => ({ ...f, boPhan: e.target.value }))}
                placeholder="Marketing, R&D..." style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 4 }}>Cấp quyền</label>
              <DropdownCapQuyen value={form.capQuyen} onChange={v => setForm(f => ({ ...f, capQuyen: v }))} />
            </div>
          </div>

          {loi && <div style={{ color: "#E24B4A", fontSize: 13, marginTop: 12 }}>{loi}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
            <button type="button" onClick={onDong} style={btnSecondary}>Huỷ</button>
            <button type="submit" disabled={dang} style={{ ...btnPrimary, opacity: dang ? 0.7 : 1 }}>
              {dang ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Tạo tài khoản
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Panel chi tiết thành viên ───────────────────────────────────────────────

interface PanelChiTietProps {
  tv: ThanhVien;
  danhSachDA: DuAnNho[];
  onCapNhat: (updated: ThanhVien) => void;
  onDong: () => void;
}

function PanelChiTiet({ tv, danhSachDA, onCapNhat, onDong }: PanelChiTietProps) {
  const [tab, setTab] = useState<"thongTin" | "quyen" | "lark" | "lichSu">("thongTin");
  const [form, setForm] = useState({ ten: tv.ten, email: tv.email, boPhan: tv.boPhan || "", mauAvatar: tv.mauAvatar || "#008264" });
  const [capQuyen, setCapQuyen] = useState<CapQuyen>(tv.capQuyen);
  const [larkId, setLarkId] = useState(tv.larkUserId || "");
  const [quyenDA, setQuyenDA] = useState<Record<string, { duAnId: string; xem: boolean; sua: boolean; taoBuoc: boolean; taoCongViec: boolean }>>(
    () => Object.fromEntries(tv.phanQuyenDuAn.map(q => [q.duAnId, { duAnId: q.duAnId, xem: q.xem, sua: q.sua, taoBuoc: q.taoBuoc, taoCongViec: q.taoCongViec }]))
  );
  const [dangLuu, setDangLuu] = useState(false);
  const [dangVoHieu, setDangVoHieu] = useState(false);
  const [toast, setToast] = useState("");
  const [loi, setLoi] = useState("");

  // sync khi tv thay đổi
  useEffect(() => {
    setForm({ ten: tv.ten, email: tv.email, boPhan: tv.boPhan || "", mauAvatar: tv.mauAvatar || "#008264" });
    setCapQuyen(tv.capQuyen);
    setLarkId(tv.larkUserId || "");
    setQuyenDA(Object.fromEntries(tv.phanQuyenDuAn.map(q => [q.duAnId, { duAnId: q.duAnId, xem: q.xem, sua: q.sua, taoBuoc: q.taoBuoc, taoCongViec: q.taoCongViec }])));
  }, [tv.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  async function luuThongTin() {
    setDangLuu(true); setLoi("");
    try {
      const kq = await goiApi(`/api/thanh-vien/${tv.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, larkUserId: larkId }),
      });
      onCapNhat(kq as ThanhVien);
      showToast("Đã lưu thông tin");
    } catch (e) { setLoi((e as Error).message); }
    finally { setDangLuu(false); }
  }

  async function luuQuyen() {
    setDangLuu(true); setLoi("");
    try {
      const kq = await goiApi(`/api/thanh-vien/${tv.id}/phan-quyen`, {
        method: "POST",
        body: JSON.stringify({ capQuyen, danhSachQuyenDuAn: Object.values(quyenDA) }),
      });
      onCapNhat(kq as ThanhVien);
      showToast("Đã cập nhật phân quyền");
    } catch (e) { setLoi((e as Error).message); }
    finally { setDangLuu(false); }
  }

  async function toggleVoHieu() {
    setDangVoHieu(true);
    try {
      const kq = await goiApi(`/api/thanh-vien/${tv.id}/vo-hieu-hoa`, { method: "POST" });
      onCapNhat(kq as ThanhVien);
      showToast(tv.trangThai ? "Đã vô hiệu hoá tài khoản" : "Đã kích hoạt tài khoản");
    } catch (e) { setLoi((e as Error).message); }
    finally { setDangVoHieu(false); }
  }

  function toggleDA(daId: string, checked: boolean) {
    if (checked) {
      setQuyenDA(q => ({ ...q, [daId]: { duAnId: daId, xem: true, sua: false, taoBuoc: false, taoCongViec: false } }));
    } else {
      setQuyenDA(q => { const n = { ...q }; delete n[daId]; return n; });
    }
  }

  const TABS = [
    { id: "thongTin", label: "Thông tin", icon: <Pencil size={13} /> },
    { id: "quyen",    label: "Phân quyền", icon: <Shield size={13} /> },
    { id: "lark",     label: "Lark",       icon: <Link2 size={13} /> },
    { id: "lichSu",   label: "Lịch sử",    icon: <Activity size={13} /> },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: FONT }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 0", borderBottom: "1px solid #F0F0EE" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <Avatar ten={form.ten} mau={form.mauAvatar} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1A1A1A" }}>{tv.ten}</div>
            <div style={{ fontSize: 12, color: "#9B9B98" }}>{tv.email}</div>
            <div style={{ marginTop: 4 }}><BadgeCapQuyen cq={tv.capQuyen} /></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={toggleVoHieu} disabled={dangVoHieu} title={tv.trangThai ? "Vô hiệu hoá" : "Kích hoạt"} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid #E0E0DD",
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {dangVoHieu ? <Loader2 size={14} className="animate-spin" color="#9B9B98" /> : <Ban size={14} color={tv.trangThai ? "#E24B4A" : "#008264"} />}
            </button>
            <button onClick={onDong} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid #E0E0DD",
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}><X size={14} color="#9B9B98" /></button>
          </div>
        </div>

        {/* Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: tv.trangThai ? "#008264" : "#E0E0DD" }} />
          <span style={{ color: tv.trangThai ? "#008264" : "#9B9B98" }}>{tv.trangThai ? "Đang hoạt động" : "Đã vô hiệu"}</span>
          <span style={{ color: "#D0D0CC", margin: "0 4px" }}>·</span>
          <span style={{ color: "#9B9B98" }}>{tv._count?.congViecPhuTrach ?? 0} công việc</span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
              borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? PRIMARY : "#9B9B98",
              fontWeight: tab === t.id ? 600 : 400, fontSize: 12, fontFamily: FONT,
              borderBottom: tab === t.id ? `2px solid ${PRIMARY}` : "2px solid transparent",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {loi && <div style={{ color: "#E24B4A", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8 }}>{loi}</div>}

        {/* ── Tab: Thông tin ── */}
        {tab === "thongTin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Màu avatar</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Avatar ten={form.ten} mau={form.mauAvatar} size={40} />
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {MAU_AVATAR.map(m => (
                    <div key={m} onClick={() => setForm(f => ({ ...f, mauAvatar: m }))} style={{
                      width: 22, height: 22, borderRadius: "50%", background: m, cursor: "pointer",
                      border: form.mauAvatar === m ? "2.5px solid #1A1A1A" : "2.5px solid transparent",
                    }} />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Họ và tên</label>
              <input value={form.ten} onChange={e => setForm(f => ({ ...f, ten: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Bộ phận</label>
              <input value={form.boPhan} onChange={e => setForm(f => ({ ...f, boPhan: e.target.value }))} placeholder="Marketing, R&D, Kế toán..." style={inputStyle} />
            </div>

            <button onClick={luuThongTin} disabled={dangLuu} style={{ ...btnPrimary, alignSelf: "flex-start" }}>
              {dangLuu ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Lưu thay đổi
            </button>
          </div>
        )}

        {/* ── Tab: Phân quyền ── */}
        {tab === "quyen" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle}>Cấp quyền</label>
              <DropdownCapQuyen value={capQuyen} onChange={setCapQuyen} />
            </div>

            <div>
              <label style={labelStyle}>Dự án được gán & quyền chi tiết</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {danhSachDA.map(da => {
                  const assigned = da.id in quyenDA;
                  const q = quyenDA[da.id];
                  return (
                    <div key={da.id} style={{
                      border: "1px solid", borderColor: assigned ? da.mau + "44" : "#E0E0DD",
                      borderRadius: 10, overflow: "hidden",
                      background: assigned ? da.mau + "08" : "#FAFAFA",
                    }}>
                      {/* Dự án header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                        <input type="checkbox" checked={assigned} onChange={e => toggleDA(da.id, e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: da.mau, cursor: "pointer" }} />
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", background: da.mau, flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: "#1A1A1A" }}>{da.ten}</span>
                        <span style={{ fontSize: 11, color: "#9B9B98" }}>{da.ma}</span>
                      </div>

                      {/* Quyền chi tiết */}
                      {assigned && (
                        <div style={{ padding: "0 14px 12px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {([
                            { key: "xem" as const,         label: "Xem",           icon: "👁️" },
                            { key: "sua" as const,         label: "Sửa",           icon: "✏️" },
                            { key: "taoBuoc" as const,     label: "Tạo bước",      icon: "📋" },
                            { key: "taoCongViec" as const, label: "Tạo công việc", icon: "✅" },
                          ]).map(({ key, label, icon }) => (
                            <label key={key} style={{
                              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
                              borderRadius: 99, border: "1px solid", cursor: "pointer",
                              borderColor: q[key] ? da.mau + "66" : "#E0E0DD",
                              background: q[key] ? da.mau + "15" : "#fff",
                              fontSize: 12, fontFamily: FONT,
                            }}>
                              <input type="checkbox" checked={q[key]} onChange={e => setQuyenDA(qq => ({
                                ...qq, [da.id]: { ...qq[da.id], [key]: e.target.checked },
                              }))} style={{ display: "none" }} />
                              {icon} {label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={luuQuyen} disabled={dangLuu} style={{ ...btnPrimary, alignSelf: "flex-start" }}>
              {dangLuu ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
              Cập nhật phân quyền
            </button>
          </div>
        )}

        {/* ── Tab: Lark ── */}
        {tab === "lark" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: 14, background: "#F0F8F5", borderRadius: 10, fontSize: 13, color: "#075740" }}>
              <b>Kết nối Lark</b> — Nhập Lark User ID để hệ thống có thể gửi thông báo tự động khi có thay đổi liên quan đến thành viên này.
            </div>
            <div>
              <label style={labelStyle}>Lark User ID</label>
              <input value={larkId} onChange={e => setLarkId(e.target.value)}
                placeholder="ou_xxxxxxxxxxxxxxxx" style={inputStyle} />
              <div style={{ fontSize: 11, color: "#9B9B98", marginTop: 4 }}>
                Tìm trong Lark Admin hoặc Profile của thành viên
              </div>
            </div>
            <button onClick={luuThongTin} disabled={dangLuu} style={{ ...btnPrimary, alignSelf: "flex-start" }}>
              {dangLuu ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Lưu kết nối Lark
            </button>
          </div>
        )}

        {/* ── Tab: Lịch sử ── */}
        {tab === "lichSu" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tv.nhatKy.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#9B9B98", fontSize: 13 }}>
                <Clock size={28} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                <div>Chưa có hoạt động nào</div>
              </div>
            ) : tv.nhatKy.map(nk => (
              <div key={nk.id} style={{
                padding: "10px 14px", borderRadius: 10, background: "#FAFAFA",
                border: "1px solid #F0F0EE",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
                    {nk.hanhDong}
                    {nk.duAn && <span style={{ color: "#9B9B98", fontWeight: 400 }}> · {nk.duAn.ten}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "#9B9B98", flexShrink: 0 }}>
                    {new Date(nk.taoLuc).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#9B9B98", marginTop: 2 }}>
                  {nk.bangDuLieu}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "#1A1A1A", color: "#fff", padding: "8px 18px", borderRadius: 99,
          fontSize: 13, fontFamily: FONT, display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 4px 16px rgba(0,0,0,.2)", whiteSpace: "nowrap",
        }}>
          <CheckCircle2 size={14} color="#4ADE80" /> {toast}
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E0E0DD",
  fontFamily: FONT, fontSize: 13, outline: "none", boxSizing: "border-box",
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 5, fontWeight: 500,
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
  borderRadius: 8, background: PRIMARY, color: "#fff", border: "none",
  fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
  borderRadius: 8, background: "#F5F5F3", color: "#4B4B48", border: "1px solid #E0E0DD",
  fontFamily: FONT, fontSize: 13, fontWeight: 500, cursor: "pointer",
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function QuanTriThanhVien() {
  const [danhSach, setDanhSach]     = useState<ThanhVien[]>([]);
  const [danhSachDA, setDanhSachDA] = useState<DuAnNho[]>([]);
  const [dang, setDang]             = useState(true);
  const [loi, setLoi]               = useState("");
  const [tuKhoa, setTuKhoa]         = useState("");
  const [locTT, setLocTT]           = useState<"tat-ca" | "hoat-dong" | "vo-hieu">("hoat-dong");
  const [chon, setChon]             = useState<ThanhVien | null>(null);
  const [showModal, setShowModal]   = useState(false);

  const taiDuLieu = useCallback(async () => {
    setDang(true); setLoi("");
    try {
      const params = locTT !== "tat-ca" ? `?trangThai=${locTT}` : "";
      const kq = await goiApi(`/api/thanh-vien${params}`) as { thanhVien: ThanhVien[]; danhSachDuAn: DuAnNho[] };
      setDanhSach(kq.thanhVien);
      setDanhSachDA(kq.danhSachDuAn);
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDang(false);
    }
  }, [locTT]);

  useEffect(() => { taiDuLieu(); }, [taiDuLieu]);

  // Sync chon khi danhSach thay đổi
  useEffect(() => {
    if (chon) {
      const updated = danhSach.find(t => t.id === chon.id);
      if (updated) setChon(updated);
    }
  }, [danhSach]); // eslint-disable-line react-hooks/exhaustive-deps

  function capNhatDanhSach(updated: ThanhVien) {
    setDanhSach(ds => ds.map(t => t.id === updated.id ? updated : t));
    setChon(updated);
  }

  function themThanhVien(newTV: ThanhVien) {
    setDanhSach(ds => [newTV, ...ds]);
    setChon(newTV);
    setShowModal(false);
  }

  const danhSachLoc = danhSach.filter(tv => {
    if (!tuKhoa.trim()) return true;
    const kw = tuKhoa.toLowerCase();
    return tv.ten.toLowerCase().includes(kw) || tv.email.toLowerCase().includes(kw) || (tv.boPhan || "").toLowerCase().includes(kw);
  });

  const soDA = (tv: ThanhVien) => {
    const set = new Set([...tv.duAnTruong.map(d => d.id), ...tv.phanQuyenDuAn.map(q => q.duAnId)]);
    return set.size;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F7F7F5", fontFamily: FONT }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 28px 0", background: "#F7F7F5" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>Quản trị thành viên</h1>
            <p style={{ fontSize: 13, color: "#9B9B98", margin: "3px 0 0" }}>
              Quản lý tài khoản và phân quyền thành viên ATK · {danhSach.length} thành viên
            </p>
          </div>
          <button onClick={() => setShowModal(true)} style={btnPrimary}>
            <Plus size={15} /> Thêm thành viên
          </button>
        </div>

        {/* Bộ lọc + tìm kiếm */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9B9B98" }} />
            <input value={tuKhoa} onChange={e => setTuKhoa(e.target.value)}
              placeholder="Tìm theo tên, email, bộ phận..."
              style={{ ...inputStyle, paddingLeft: 32 }} />
          </div>
          <div style={{ display: "flex", background: "#EEEEED", borderRadius: 8, padding: 3 }}>
            {([
              { val: "hoat-dong", label: "Đang hoạt động" },
              { val: "vo-hieu",   label: "Vô hiệu" },
              { val: "tat-ca",    label: "Tất cả" },
            ] as const).map(({ val, label }) => (
              <button key={val} onClick={() => setLocTT(val)} style={{
                padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                background: locTT === val ? "#fff" : "transparent",
                color: locTT === val ? "#1A1A1A" : "#9B9B98",
                fontWeight: locTT === val ? 600 : 400, fontSize: 12, fontFamily: FONT,
                boxShadow: locTT === val ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main 2-col ── */}
      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden", padding: "0 28px 20px" }}>

        {/* Left: danh sách */}
        <div style={{
          flex: chon ? "0 0 55%" : "1",
          transition: "flex 0.2s",
          background: "#fff", borderRadius: chon ? "12px 0 0 12px" : 12,
          border: "1px solid #E0E0DD",
          borderRight: chon ? "none" : "1px solid #E0E0DD",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {dang ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#9B9B98", fontSize: 13 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: PRIMARY }} /> Đang tải...
            </div>
          ) : loi ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#E24B4A" }}>{loi}</div>
              <button onClick={taiDuLieu} style={btnPrimary}>↺ Thử lại</button>
            </div>
          ) : (
            <div style={{ overflowY: "auto", flex: 1 }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1.2fr 0.6fr 0.8fr 0.6fr",
                padding: "10px 16px", borderBottom: "1px solid #F0F0EE",
                fontSize: 11, fontWeight: 700, color: "#9B9B98", letterSpacing: ".5px",
                textTransform: "uppercase", position: "sticky", top: 0, background: "#fff", zIndex: 1,
              }}>
                <div>Tên</div>
                <div>Bộ phận</div>
                <div>Cấp quyền</div>
                <div style={{ textAlign: "center" }}>Dự án</div>
                <div style={{ textAlign: "center" }}>Trạng thái</div>
                <div style={{ textAlign: "center" }}>Hành động</div>
              </div>

              {danhSachLoc.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9B9B98", fontSize: 13 }}>
                  <Users size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                  <div>Không có thành viên nào</div>
                </div>
              ) : danhSachLoc.map(tv => (
                <div key={tv.id} onClick={() => setChon(chon?.id === tv.id ? null : tv)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1.2fr 0.6fr 0.8fr 0.6fr",
                    padding: "11px 16px", borderBottom: "1px solid #F7F7F5",
                    cursor: "pointer", alignItems: "center",
                    background: chon?.id === tv.id ? "#F0F8F5" : "transparent",
                    opacity: tv.trangThai ? 1 : 0.55,
                  }}>

                  {/* Tên */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar ten={tv.ten} mau={tv.mauAvatar} size={32} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1A1A" }}>{tv.ten}</div>
                      <div style={{ fontSize: 11, color: "#9B9B98" }}>{tv.email}</div>
                    </div>
                  </div>

                  {/* Bộ phận */}
                  <div style={{ fontSize: 12, color: "#6B6B6B" }}>{tv.boPhan || <span style={{ color: "#C8C8C5" }}>—</span>}</div>

                  {/* Cấp quyền */}
                  <div><BadgeCapQuyen cq={tv.capQuyen} /></div>

                  {/* Số DA */}
                  <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{soDA(tv)}</div>

                  {/* Trạng thái */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                      color: tv.trangThai ? "#008264" : "#9B9B98",
                      padding: "2px 8px", borderRadius: 99,
                      background: tv.trangThai ? "#E8F5F1" : "#F5F5F3",
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                      {tv.trangThai ? "Hoạt động" : "Vô hiệu"}
                    </span>
                  </div>

                  {/* Hành động */}
                  <div style={{ textAlign: "center" }}>
                    <button onClick={e => { e.stopPropagation(); setChon(tv); }} style={{
                      padding: "4px 10px", borderRadius: 6, border: "1px solid #E0E0DD",
                      background: "#fff", cursor: "pointer", fontSize: 11, fontFamily: FONT,
                      color: "#6B6B6B", display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      <Eye size={11} /> Xem
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Chi tiết */}
        {chon && (
          <div style={{
            flex: "0 0 45%", background: "#fff",
            borderRadius: "0 12px 12px 0",
            border: "1px solid #E0E0DD", borderLeft: "none",
            display: "flex", flexDirection: "column", overflow: "hidden",
            position: "relative",
          }}>
            <PanelChiTiet
              key={chon.id}
              tv={chon}
              danhSachDA={danhSachDA}
              onCapNhat={capNhatDanhSach}
              onDong={() => setChon(null)}
            />
          </div>
        )}
      </div>

      {/* Modal thêm */}
      {showModal && <ModalThemThanhVien onDong={() => setShowModal(false)} onTao={themThanhVien} />}
    </div>
  );
}
