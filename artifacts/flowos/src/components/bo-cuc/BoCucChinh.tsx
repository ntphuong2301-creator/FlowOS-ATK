/**
 * BoCucChinh — Layout chính với sidebar Zapier-style
 * Default: 56px (icon only) | Hover: 220px (icon + text)
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAppStore } from "@/lib/store";
import {
  LayoutGrid,
  GitBranch,
  CheckSquare,
  Package,
  AlertCircle,
  Users,
  Settings,
  Bell,
  Search,
  LogOut,
  ChevronRight,
  Network,
} from "lucide-react";

interface MucMenu {
  duongDan: string;
  nhan: string;
  icon: React.ReactNode;
  chiQuanTri?: boolean;
  caoBao?: boolean;
}

const MENU: MucMenu[] = [
  {
    duongDan: "/bang-dieu-khien",
    nhan: "Bảng chỉ huy",
    icon: <LayoutGrid size={20} />,
  },
  {
    duongDan: "/dong-chay",
    nhan: "Dòng chảy dự án",
    icon: <GitBranch size={20} />,
  },
  {
    duongDan: "/cong-viec",
    nhan: "Công việc",
    icon: <CheckSquare size={20} />,
  },
  {
    duongDan: "/san-pham",
    nhan: "Sản phẩm",
    icon: <Package size={20} />,
  },
  {
    duongDan: "/can-tro",
    nhan: "Cản trở",
    icon: <AlertCircle size={20} />,
    caoBao: true,
  },
  {
    duongDan: "/ban-do-nut-chan",
    nhan: "Bản đồ nút chặn",
    icon: <Network size={20} />,
    chiQuanTri: true,
  },
  {
    duongDan: "/quan-tri",
    nhan: "Quản trị thành viên",
    icon: <Users size={20} />,
    chiQuanTri: true,
  },
  {
    duongDan: "/cai-dat",
    nhan: "Cài đặt",
    icon: <Settings size={20} />,
  },
];

const TEN_TRANG: Record<string, string> = {
  "/bang-dieu-khien": "Bảng chỉ huy",
  "/dong-chay": "Dòng chảy dự án",
  "/cong-viec": "Công việc",
  "/san-pham": "Sản phẩm",
  "/can-tro": "Cản trở",
  "/ban-do-nut-chan": "Bản đồ nút chặn",
  "/quan-tri": "Quản trị thành viên",
  "/cai-dat": "Cài đặt",
};

function layChuVietTat(ten: string): string {
  return ten
    .split(" ")
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? "")
    .join("");
}

interface Props {
  children: React.ReactNode;
}

export default function BoCucChinh({ children }: Props) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAppStore();
  const [timKiem, setTimKiem]         = useState("");
  const [hienTimKiem, setHienTimKiem] = useState(false);
  const [expanded, setExpanded]       = useState(false);

  const isAdmin = user?.role === "QUAN_TRI_VIEN";
  const tenTrang = TEN_TRANG[location] ?? "FlowOS";

  const moTimKiem   = useCallback(() => setHienTimKiem(true), []);
  const dongTimKiem = useCallback(() => { setHienTimKiem(false); setTimKiem(""); }, []);

  useEffect(() => {
    const xuLy = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); moTimKiem(); }
      if (e.key === "Escape") dongTimKiem();
    };
    window.addEventListener("keydown", xuLy);
    return () => window.removeEventListener("keydown", xuLy);
  }, [moTimKiem, dongTimKiem]);

  const xuLyDangXuat = () => {
    localStorage.removeItem("auth-token");
    logout();
    setLocation("/dang-nhap");
  };

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="flex h-screen w-screen overflow-hidden bg-[#F8F8F7]"
    >
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          width: expanded ? 220 : 56,
          transition: "width 200ms ease",
          borderRight: "0.5px solid #E0E0DD",
          overflow: "hidden",
          flexShrink: 0,
          zIndex: 20,
        }}
        className="flex flex-col bg-white py-3"
      >
        {/* Logo */}
        <div style={{ padding: "0 8px", marginBottom: 16, flexShrink: 0 }}>
          <button
            onClick={() => setLocation("/bang-dieu-khien")}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "#008264", color: "#fff",
              fontWeight: 700, fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", cursor: "pointer", flexShrink: 0,
              transition: "opacity 150ms ease",
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseOut={e => (e.currentTarget.style.opacity = "1")}
          >
            A
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#E0E0DD", margin: "0 8px 10px" }} />

        {/* Menu items */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 6px" }}>
          {MENU.filter((m) => !m.chiQuanTri || isAdmin).map((muc) => {
            const active = location === muc.duongDan || location.startsWith(muc.duongDan + "/");
            return (
              <button
                key={muc.duongDan}
                onClick={() => setLocation(muc.duongDan)}
                title={expanded ? undefined : muc.nhan}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "9px 10px", borderRadius: 8,
                  border: "none", cursor: "pointer", textAlign: "left",
                  background: active ? "#008264" : "transparent",
                  color: active ? "#fff" : muc.caoBao ? "#E24B4A" : "#6B6B6B",
                  transition: "background 150ms ease, color 150ms ease",
                  whiteSpace: "nowrap", width: "100%", flexShrink: 0,
                }}
                onMouseOver={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = muc.caoBao ? "#FEF2F2" : "#F3F3F1";
                    (e.currentTarget as HTMLElement).style.color = muc.caoBao ? "#E24B4A" : "#1A1A1A";
                  }
                }}
                onMouseOut={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = muc.caoBao ? "#E24B4A" : "#6B6B6B";
                  }
                }}
              >
                {/* Icon */}
                <span style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 20 }}>
                  {muc.icon}
                </span>

                {/* Label */}
                <span style={{
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  opacity: expanded ? 1 : 0,
                  maxWidth: expanded ? 160 : 0,
                  overflow: "hidden",
                  transition: "opacity 150ms ease 30ms, max-width 200ms ease",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {muc.nhan}
                  {muc.caoBao && !active && (
                    <span style={{ marginLeft: 4, color: "#E24B4A" }}>●</span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: 1, background: "#E0E0DD", margin: "10px 8px 10px" }} />

        {/* Avatar + Đăng xuất */}
        <div style={{ padding: "0 6px" }}>
          <button
            onClick={xuLyDangXuat}
            title={expanded ? undefined : `${user?.name ?? ""} — Đăng xuất`}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "6px 10px", borderRadius: 8,
              border: "none", cursor: "pointer", background: "transparent",
              width: "100%", whiteSpace: "nowrap",
              transition: "background 150ms ease",
            }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "#FEF2F2")}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#008264", color: "#fff",
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {user ? layChuVietTat(user.name) : "?"}
            </div>
            <div style={{
              opacity: expanded ? 1 : 0,
              maxWidth: expanded ? 140 : 0,
              overflow: "hidden",
              transition: "opacity 150ms ease 30ms, max-width 200ms ease",
              textAlign: "left",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: "#E24B4A", display: "flex", alignItems: "center", gap: 3 }}>
                <LogOut size={10} /> Đăng xuất
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main (Topbar + Content) ──────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          style={{ borderBottom: "0.5px solid #E0E0DD" }}
          className="h-12 bg-white flex items-center px-4 gap-3 shrink-0 z-10"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A] min-w-0 shrink-0">
            <span className="text-[#6B6B6B] text-xs font-normal hidden sm:inline">ATK</span>
            <ChevronRight size={12} className="text-[#BDBDBA] hidden sm:block" />
            <span className="truncate">{tenTrang}</span>
          </div>

          <div className="flex-1" />

          {/* Ô tìm kiếm */}
          <button
            onClick={moTimKiem}
            className="flex items-center gap-2 px-3 h-8 rounded-lg border border-[#E0E0DD] bg-[#F8F8F7] text-[#9B9B98] text-xs hover:border-[#008264]/40 hover:bg-white transition-all w-48 max-w-xs"
          >
            <Search size={13} />
            <span className="flex-1 text-left">Tìm kiếm...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[#E0E0DD] px-1 py-0.5 text-[10px] text-[#BDBDBA]">⌘K</kbd>
          </button>

          {/* Thông báo */}
          <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#6B6B6B] hover:bg-[#F3F3F1] transition-all">
            <Bell size={17} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          {/* Avatar */}
          <button
            onClick={() => setLocation("/cai-dat")}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#008264" }}
          >
            {user ? layChuVietTat(user.name) : "?"}
          </button>
        </header>

        {/* Nội dung trang */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* ── Modal tìm kiếm (Ctrl+K) ─────────────────────────────────── */}
      {hienTimKiem && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={dongTimKiem}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E0E0DD] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E0E0DD]">
              <Search size={16} className="text-[#9B9B98] shrink-0" />
              <input
                autoFocus
                value={timKiem}
                onChange={(e) => setTimKiem(e.target.value)}
                placeholder="Tìm kiếm công việc, dự án, thành viên..."
                className="flex-1 text-sm outline-none text-[#1A1A1A] placeholder:text-[#9B9B98] bg-transparent"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
              <kbd className="text-[10px] text-[#BDBDBA] border border-[#E0E0DD] rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <div className="px-4 py-6 text-center text-sm text-[#9B9B98]">
              {timKiem ? `Không tìm thấy kết quả cho "${timKiem}"` : "Nhập để bắt đầu tìm kiếm..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
