/**
 * XoaCongViecModal — Modal xác nhận xóa công việc (soft delete)
 *
 * - Hiển thị cảnh báo nếu có downstream tasks
 * - Yêu cầu nhập lý do xóa (bắt buộc)
 * - Gọi DELETE /api/cong-viec/:id với lyDoXoa
 */

import { useState, useEffect } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { goiApi } from "@/lib/api";

interface PropsXoaModal {
  congViecId: string;
  tenCongViec: string;
  onHuy: () => void;
  onXoaThanhCong: (id: string) => void;
}

interface DownstreamInfo {
  soDownstream: number;
}

export function XoaCongViecModal({
  congViecId, tenCongViec, onHuy, onXoaThanhCong,
}: PropsXoaModal) {
  const [lyDoXoa, setLyDoXoa] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [downstream, setDownstream] = useState<DownstreamInfo | null>(null);
  const [dangTai, setDangTai] = useState(true);

  useEffect(() => {
    let active = true;
    goiApi(`/api/cong-viec/${congViecId}/dependency`)
      .then((data: unknown) => {
        if (!active) return;
        const d = data as { downstream?: { direct?: unknown[] } };
        const soDs = d.downstream?.direct?.length ?? 0;
        setDownstream({ soDownstream: soDs });
      })
      .catch(() => { if (active) setDownstream({ soDownstream: 0 }); })
      .finally(() => { if (active) setDangTai(false); });
    return () => { active = false; };
  }, [congViecId]);

  async function xacNhanXoa() {
    if (!lyDoXoa.trim()) return;
    setDangGui(true);
    try {
      await goiApi(`/api/cong-viec/${congViecId}`, {
        method: "DELETE",
        body: JSON.stringify({ lyDoXoa: lyDoXoa.trim() }),
      });
      onXoaThanhCong(congViecId);
    } catch {
      setDangGui(false);
    }
  }

  const canSubmit = lyDoXoa.trim().length >= 3 && !dangGui;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={e => e.target === e.currentTarget && onHuy()}
    >
      <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: "24px 28px",
        width: 420,
        maxWidth: "94vw",
        boxShadow: "0 8px 40px rgba(0,0,0,0.20)",
        fontFamily: "inherit",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E24B4A" }}>
            <Trash2 size={18} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Xóa công việc</span>
          </div>
          <button onClick={onHuy} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
            <X size={16} />
          </button>
        </div>

        {/* Task name */}
        <div style={{
          padding: "10px 14px",
          background: "#FEF2F2",
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 13,
          color: "#374151",
          borderLeft: "3px solid #E24B4A",
        }}>
          <span style={{ fontWeight: 600 }}>{tenCongViec}</span>
        </div>

        {/* Downstream warning */}
        {!dangTai && (downstream?.soDownstream ?? 0) > 0 && (
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-start",
            padding: "10px 14px",
            background: "#FFFBEB",
            borderRadius: 8,
            marginBottom: 14,
            fontSize: 12,
            color: "#885800",
            border: "1px solid #FDE68A",
          }}>
            <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              Công việc này có <strong>{downstream?.soDownstream}</strong> công việc phụ thuộc downstream.
              Các liên kết sẽ bị xóa, nhưng lịch của chúng không bị ảnh hưởng.
            </span>
          </div>
        )}

        {/* Lý do xóa */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 6 }}>
            Lý do xóa <span style={{ color: "#E24B4A" }}>*</span>
          </label>
          <textarea
            autoFocus
            value={lyDoXoa}
            onChange={e => setLyDoXoa(e.target.value)}
            placeholder="Nhập lý do xóa công việc này..."
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1.5px solid #D1D5DB",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = "#E24B4A")}
            onBlur={e => (e.target.style.borderColor = "#D1D5DB")}
          />
          {lyDoXoa.trim().length > 0 && lyDoXoa.trim().length < 3 && (
            <div style={{ fontSize: 11, color: "#E24B4A", marginTop: 4 }}>
              Vui lòng nhập ít nhất 3 ký tự
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onHuy}
            style={{
              padding: "8px 20px", borderRadius: 8, fontSize: 13,
              background: "none", border: "1.5px solid #D1D5DB",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Hủy
          </button>
          <button
            onClick={xacNhanXoa}
            disabled={!canSubmit}
            style={{
              padding: "8px 20px", borderRadius: 8, fontSize: 13,
              background: canSubmit ? "#E24B4A" : "#D1D5DB",
              color: "#fff", border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "inherit", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {dangGui && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            {dangTai ? "Đang kiểm tra..." : "Xác nhận xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}
