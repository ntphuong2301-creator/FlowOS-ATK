import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAppStore } from "@/lib/store";
import { Layers } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const setAuth = useAppStore(state => state.setAuth);
  const loginMutation = useLogin();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (res) => {
          localStorage.setItem('auth-token', res.token);
          setAuth(res.user, res.token);
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          setError(err?.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background Image injected via Base URL */}
      <img 
        src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
        alt="Background" 
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply"
      />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"></div>

      <div className="w-full max-w-md p-8 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 mb-6">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Chào mừng trở lại</h1>
          <p className="text-muted-foreground mt-2">Đăng nhập vào FlowOS để tiếp tục công việc</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800 space-y-5">
          {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl font-medium border border-destructive/20">{error}</div>}
          
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">Email</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-foreground">Mật khẩu</label>
              <a href="#" className="text-xs text-primary font-medium hover:underline">Quên mật khẩu?</a>
            </div>
            <input 
              type="password" 
              required
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loginMutation.isPending}
            className="w-full py-3.5 mt-4 bg-gradient-to-r from-primary to-accent hover:to-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50"
          >
            {loginMutation.isPending ? "Đang xử lý..." : "Đăng nhập"}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Chưa có tài khoản? <Link href="/register" className="text-primary font-semibold hover:underline">Đăng ký ngay</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
