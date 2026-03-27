import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAppStore } from "@/lib/store";
import { Layers } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const setAuth = useAppStore(state => state.setAuth);
  const registerMutation = useRegister();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    registerMutation.mutate(
      { data: { name, email, password } },
      {
        onSuccess: (res) => {
          localStorage.setItem('auth-token', res.token);
          setAuth(res.user, res.token);
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          setError(err?.response?.data?.message || "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
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
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Tạo tài khoản</h1>
          <p className="text-muted-foreground mt-2">Tham gia FlowOS để bắt đầu quản lý công việc</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800 space-y-5">
          {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl font-medium border border-destructive/20">{error}</div>}
          
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">Họ và tên</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
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
            <label className="block text-sm font-semibold mb-2 text-foreground">Mật khẩu</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground"
              placeholder="Ít nhất 8 ký tự"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={registerMutation.isPending}
            className="w-full py-3.5 mt-4 bg-gradient-to-r from-primary to-accent hover:to-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50"
          >
            {registerMutation.isPending ? "Đang xử lý..." : "Đăng ký ngay"}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Đã có tài khoản? <Link href="/login" className="text-primary font-semibold hover:underline">Đăng nhập</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
