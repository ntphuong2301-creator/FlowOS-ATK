import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";
import { useUndoRedoGlobal } from "@/hooks/dung-undo";

import DangNhap from "@/pages/DangNhap";
import BangDieuKhien from "@/pages/BangDieuKhien";
import DongChayDuAn from "@/pages/DongChayDuAn";
import CongViec from "@/pages/CongViec";
import SanPham from "@/pages/SanPham";
import QuanLyCanTro from "@/pages/QuanLyCanTro";
import QuanTri from "@/pages/QuanTri";
import CaiDat from "@/pages/CaiDat";
import NotFound from "@/pages/not-found";

import BoCucChinh from "@/components/bo-cuc/BoCucChinh";
import BanDoNutChan from "@/pages/BanDoNutChan";

// Gắn token vào mọi request
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem("auth-token");
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return originalFetch(input, { ...init, headers });
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function TrangDaXacThuc({ children }: { children: React.ReactNode }) {
  const token = useAppStore((s) => s.token);
  const [location] = useLocation();
  if (!token) {
    return <Redirect to={`/dang-nhap?tiep=${encodeURIComponent(location)}`} />;
  }
  return <BoCucChinh>{children}</BoCucChinh>;
}

// ─── Undo/Redo global keyboard controller ─────────────────────────────────────

function UndoRedoController() {
  const { undo, redo, lastAction } = useUndoRedoGlobal();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastAction) return;
    const msg =
      lastAction.type === "undo"
        ? `↩ Đã hoàn tác: ${lastAction.label}`
        : `↪ Đã làm lại: ${lastAction.label}`;
    setToastMsg(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastMsg(null), 2000);
  }, [lastAction]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      const isContentEditable = (e.target as HTMLElement)?.isContentEditable;
      if (isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  if (!toastMsg) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 24,
        background: "#1A1A1A",
        color: "#fff",
        borderRadius: 10,
        padding: "9px 20px",
        fontSize: 13,
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "'DM Sans', sans-serif",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {toastMsg}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            {/* Trang công khai */}
            <Route path="/" component={() => <Redirect to="/bang-dieu-khien" />} />
            <Route path="/dang-nhap" component={DangNhap} />
            <Route path="/login" component={() => <Redirect to="/dang-nhap" />} />
            <Route path="/register" component={() => <Redirect to="/dang-nhap" />} />

            {/* Trang yêu cầu đăng nhập */}
            <Route path="/bang-dieu-khien">
              {() => (
                <TrangDaXacThuc>
                  <BangDieuKhien />
                </TrangDaXacThuc>
              )}
            </Route>
            <Route path="/dashboard">
              {() => <Redirect to="/bang-dieu-khien" />}
            </Route>

            <Route path="/dong-chay">
              {() => (
                <TrangDaXacThuc>
                  <DongChayDuAn />
                </TrangDaXacThuc>
              )}
            </Route>

            <Route path="/cong-viec">
              {() => (
                <TrangDaXacThuc>
                  <CongViec />
                </TrangDaXacThuc>
              )}
            </Route>

            <Route path="/san-pham">
              {() => (
                <TrangDaXacThuc>
                  <SanPham />
                </TrangDaXacThuc>
              )}
            </Route>

            <Route path="/can-tro">
              {() => (
                <TrangDaXacThuc>
                  <QuanLyCanTro />
                </TrangDaXacThuc>
              )}
            </Route>

            <Route path="/quan-tri">
              {() => (
                <TrangDaXacThuc>
                  <QuanTri />
                </TrangDaXacThuc>
              )}
            </Route>

            <Route path="/cai-dat">
              {() => (
                <TrangDaXacThuc>
                  <CaiDat />
                </TrangDaXacThuc>
              )}
            </Route>

            <Route path="/ban-do-nut-chan">
              {() => (
                <TrangDaXacThuc>
                  <BanDoNutChan />
                </TrangDaXacThuc>
              )}
            </Route>

            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
        <UndoRedoController />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
