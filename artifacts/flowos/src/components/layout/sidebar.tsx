import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  Workflow, 
  MessageSquare, 
  Bell,
  LogOut,
  Layers
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/tasks", label: "Công việc", icon: CheckSquare },
  { href: "/flows", label: "Quy trình (Flow)", icon: Workflow },
  { href: "/ai-chat", label: "Trợ lý AI", icon: MessageSquare },
  { href: "/notifications", label: "Thông báo", icon: Bell },
];

export function Sidebar() {
  const [location] = useLocation();
  const logout = useAppStore((state) => state.logout);

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex flex-col shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 group cursor-pointer">
          <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-colors">
            <Layers className="w-6 h-6 text-primary" />
          </div>
          <span className="font-display font-bold text-xl text-sidebar-foreground tracking-tight">FlowOS</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 translate-x-1" 
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <button 
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
