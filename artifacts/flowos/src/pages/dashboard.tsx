import { MainLayout } from "@/components/layout/main-layout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Activity
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetDashboardStats();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      </MainLayout>
    );
  }

  if (error || !stats) {
    return (
      <MainLayout>
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20">
          <p className="font-semibold">Lỗi tải dữ liệu tổng quan</p>
        </div>
      </MainLayout>
    );
  }

  const statCards = [
    { label: "Dự án đang hoạt động", value: stats.activeProjects, total: stats.totalProjects, icon: FolderKanban, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Công việc hoàn thành", value: stats.completedTasks, total: stats.totalTasks, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Đang thực hiện", value: stats.inProgressTasks, total: stats.totalTasks, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Quá hạn", value: stats.overdueTasks, total: stats.totalTasks, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tổng quan</h1>
          <p className="text-muted-foreground mt-1">Theo dõi tiến độ và hiệu suất công việc của bạn.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, i) => (
            <div key={i} className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-3xl font-display font-bold text-foreground">{stat.value}</h3>
                    <span className="text-sm text-muted-foreground">/ {stat.total}</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${stat.color.replace('text-', 'bg-')}`} 
                  style={{ width: `${stat.total > 0 ? (stat.value / stat.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-2 bg-card p-6 rounded-2xl border border-border shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-6">Biểu đồ hoàn thành công việc (7 ngày)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.taskCompletionByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={(val) => new Date(val).getDate().toString()} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString('vi-VN')}
                  />
                  <Area type="monotone" dataKey="completed" name="Hoàn thành" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" />
                  <Area type="monotone" dataKey="created" name="Tạo mới" stroke="hsl(var(--muted-foreground))" strokeWidth={2} fill="none" strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Hoạt động gần đây</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {stats.recentActivity.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Chưa có hoạt động nào</p>
              ) : (
                stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-[-24px] before:w-0.5 before:bg-border last:before:hidden">
                    <div className="absolute left-0.5 top-1.5 w-3.5 h-3.5 bg-background border-2 border-primary rounded-full z-10" />
                    <p className="text-sm font-medium text-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(activity.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
