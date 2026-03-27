import { MainLayout } from "@/components/layout/main-layout";
import { useListNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Info, CheckCircle, AlertTriangle, AlertOctagon, Check } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ICONS = {
  info: <Info className="w-5 h-5 text-blue-500" />,
  success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  error: <AlertOctagon className="w-5 h-5 text-rose-500" />
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useListNotifications();
  const markRead = useMarkNotificationRead();

  const handleMarkRead = (id: string) => {
    markRead.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] })
    });
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Thông báo
          </h1>
          <p className="text-muted-foreground mt-1">Cập nhật những hoạt động mới nhất trong hệ thống.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Đang tải thông báo...</div>
          ) : notifications?.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-bold">Không có thông báo nào</h3>
              <p className="text-muted-foreground">Bạn đã xem hết tất cả thông báo.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications?.map((notif) => (
                <div key={notif.id} className={`p-5 flex gap-4 transition-colors ${notif.isRead ? 'bg-transparent opacity-70' : 'bg-primary/5'}`}>
                  <div className="mt-1 shrink-0">
                    {ICONS[notif.type]}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold ${notif.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>{notif.title}</h4>
                    <p className={`text-sm mt-1 ${notif.isRead ? 'text-muted-foreground/80' : 'text-muted-foreground'}`}>{notif.message}</p>
                    <span className="text-xs text-muted-foreground mt-3 block">{formatDateTime(notif.createdAt)}</span>
                  </div>
                  {!notif.isRead && (
                    <button 
                      onClick={() => handleMarkRead(notif.id)}
                      className="shrink-0 p-2 text-primary hover:bg-primary/10 rounded-full h-fit transition-colors"
                      title="Đánh dấu đã đọc"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
