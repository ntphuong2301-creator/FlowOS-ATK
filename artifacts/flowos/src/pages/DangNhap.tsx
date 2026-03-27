import { useState } from "react";
import { useLocation } from "wouter";
import { useAppStore } from "@/lib/store";
import { Layers } from "lucide-react";

export default function DangNhap() {
  const [, setLocation] = useLocation();
  const setAuth = useAppStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [loi, setLoi] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);

  const xuLyDangNhap = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoi("");
    setDangXuLy(true);

    try {
      const res = await fetch("/api/xac-thuc/dang-nhap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, matKhau }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoi(data.thongBao || "Đăng nhập thất bại. Vui lòng thử lại.");
        return;
      }

      localStorage.setItem("auth-token", data.token);
      setAuth(
        {
          id: data.nguoiDung.id,
          name: data.nguoiDung.ten,
          email: data.nguoiDung.email,
          avatar: data.nguoiDung.mauAvatar ?? null,
          role: data.nguoiDung.capQuyen,
          createdAt: new Date().toISOString(),
        },
        data.token,
      );
      setLocation("/bang-dieu-khien");
    } catch {
      setLoi("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setDangXuLy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      <img
        src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
        alt="Nền"
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 mb-6">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
            Chào mừng trở lại
          </h1>
          <p className="text-muted-foreground mt-2">
            Đăng nhập vào FlowOS để tiếp tục công việc
          </p>
        </div>

        <form
          onSubmit={xuLyDangNhap}
          className="bg-card/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800 space-y-5"
        >
          {loi && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl font-medium border border-destructive/20">
              {loi}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground"
              placeholder="ten@atk.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-foreground">
                Mật khẩu
              </label>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground"
              placeholder="••••••••"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={dangXuLy}
            className="w-full py-3.5 mt-4 bg-gradient-to-r from-primary to-accent hover:to-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {dangXuLy ? "Đang xác thực..." : "Đăng nhập"}
          </button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            FlowOS — Hệ thống quản lý công việc ATK
          </p>
        </form>
      </div>
    </div>
  );
}
