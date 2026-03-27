import { useAppStore } from "@/lib/store";
import { LayoutGrid, TrendingUp, CheckSquare, AlertCircle, Package } from "lucide-react";

export default function BangDieuKhien() {
  const user = useAppStore((s) => s.user);

  const the = [
    { icon: <LayoutGrid size={20} />, nhan: "Dự án đang chạy", gia: "8", mau: "#008264" },
    { icon: <CheckSquare size={20} />, nhan: "Công việc hôm nay", gia: "24", mau: "#3B82F6" },
    { icon: <AlertCircle size={20} />, nhan: "Cản trở mở", gia: "5", mau: "#EF4444" },
    { icon: <Package size={20} />, nhan: "Sản phẩm đang phát triển", gia: "12", mau: "#F59E0B" },
    { icon: <TrendingUp size={20} />, nhan: "Tiến độ trung bình", gia: "68%", mau: "#8B5CF6" },
  ];

  return (
    <div className="p-6 space-y-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">
          Chào buổi sáng, {user?.name?.split(" ").pop() ?? "bạn"} 👋
        </h1>
        <p className="text-sm text-[#6B6B6B] mt-0.5">
          Đây là tổng quan hoạt động của ATK hôm nay.
        </p>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {the.map((t) => (
          <div
            key={t.nhan}
            className="bg-white rounded-xl p-4 border border-[#E0E0DD] hover:shadow-sm transition-shadow"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-3"
              style={{ background: t.mau }}
            >
              {t.icon}
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{t.gia}</div>
            <div className="text-xs text-[#6B6B6B] mt-0.5 leading-snug">{t.nhan}</div>
          </div>
        ))}
      </div>

      {/* Placeholder nội dung */}
      <div className="bg-white rounded-xl border border-[#E0E0DD] p-8 text-center text-sm text-[#9B9B98]">
        Nội dung bảng chỉ huy đang được phát triển...
      </div>
    </div>
  );
}
