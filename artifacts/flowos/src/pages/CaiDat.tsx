import { Settings } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function CaiDat() {
  const user = useAppStore((s) => s.user);

  const ROLE_LABEL: Record<string, string> = {
    QUAN_TRI_VIEN: "Quản trị viên",
    TRUONG_NHOM: "Trưởng nhóm",
    THANH_VIEN: "Thành viên",
    QUAN_SAT: "Quan sát viên",
  };

  return (
    <div className="p-6 max-w-xl" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Cài đặt</h1>
        <p className="text-sm text-[#6B6B6B] mt-0.5">Thông tin tài khoản và tuỳ chỉnh</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E0E0DD] p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0"
            style={{ background: "#008264" }}
          >
            {user?.name?.split(" ").slice(0, 2).map((t: string) => t[0]).join("") ?? "?"}
          </div>
          <div>
            <div className="font-semibold text-[#1A1A1A]">{user?.name}</div>
            <div className="text-sm text-[#6B6B6B]">{user?.email}</div>
            <div className="text-xs mt-0.5 font-medium" style={{ color: "#008264" }}>
              {user?.role ? ROLE_LABEL[user.role] ?? user.role : ""}
            </div>
          </div>
        </div>

        <hr className="border-[#E0E0DD]" />

        <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
          <Settings size={24} className="text-[#BDBDBA]" />
          <div className="text-sm text-[#9B9B98]">Các tuỳ chỉnh đang được phát triển...</div>
        </div>
      </div>
    </div>
  );
}
