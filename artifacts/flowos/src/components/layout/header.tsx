import { useAppStore } from "@/lib/store";
import { Bell, Search } from "lucide-react";
import { Link } from "wouter";

export function Header() {
  const user = useAppStore((state) => state.user);

  return (
    <header className="h-16 bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-40 flex items-center justify-between px-8 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Tìm kiếm dự án, công việc..." 
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/notifications" className="relative p-2 rounded-full hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
        </Link>
        
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-foreground leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-1 capitalize">{user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground font-bold shadow-md shadow-primary/20 border-2 border-background">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
