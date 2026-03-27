import { useAppStore } from "@/lib/store";
import QuanTriThanhVien from "./QuanTriThanhVien";

export default function QuanTri() {
  const user = useAppStore(s => s.user);
  const role = (user as { role?: string; capQuyen?: string } | null)?.role
    ?? (user as { role?: string; capQuyen?: string } | null)?.capQuyen;

  if (role !== "QUAN_TRI_VIEN") {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12, fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div style={{ fontWeight: 700, color: "#1A1A1A" }}>Không có quyền truy cập</div>
        <div style={{ fontSize: 13, color: "#9B9B98" }}>
          Chỉ Quản trị viên mới có thể truy cập trang này.
        </div>
      </div>
    );
  }

  return <QuanTriThanhVien />;
}
