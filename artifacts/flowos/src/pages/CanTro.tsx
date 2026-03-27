import { AlertCircle } from "lucide-react";

export default function CanTro() {
  return (
    <div className="p-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Cản trở</h1>
        <p className="text-sm text-[#6B6B6B] mt-0.5">Các vấn đề đang cản trở tiến độ dự án</p>
      </div>
      <div className="bg-white rounded-xl border border-[#E0E0DD] p-16 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-50">
          <AlertCircle size={28} className="text-red-500" />
        </div>
        <div>
          <div className="font-semibold text-[#1A1A1A]">Quản lý cản trở</div>
          <div className="text-sm text-[#9B9B98] mt-1">Đang xây dựng chức năng này...</div>
        </div>
      </div>
    </div>
  );
}
