import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <AlertCircle className="w-20 h-20 text-destructive mb-6" />
      <h1 className="text-4xl font-display font-bold mb-4">404 - Không tìm thấy trang</h1>
      <p className="text-muted-foreground mb-8 text-lg">Trang bạn đang tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.</p>
      <Link href="/dashboard" className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-1 transition-all">
        Quay lại trang chủ
      </Link>
    </div>
  );
}
