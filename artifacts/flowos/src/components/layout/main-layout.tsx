import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAppStore } from "@/lib/store";
import { Redirect } from "wouter";

export function MainLayout({ children }: { children: ReactNode }) {
  const token = useAppStore((state) => state.token);

  if (!token) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
