import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useListFlows, useCreateFlow } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Workflow, Plus, Play, MoreVertical } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Flows() {
  const queryClient = useQueryClient();
  const { data: flows, isLoading } = useListFlows();
  const createMutation = useCreateFlow();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFlow, setNewFlow] = useState({ name: "", description: "" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    // Default empty ReactFlow state
    const initialNodes = JSON.stringify([{ id: '1', type: 'input', data: { label: 'Start' }, position: { x: 250, y: 50 } }]);
    const initialEdges = JSON.stringify([]);
    
    createMutation.mutate(
      { data: { ...newFlow, nodes: initialNodes, edges: initialEdges } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/flows"] });
          setIsCreateOpen(false);
          setNewFlow({ name: "", description: "" });
        }
      }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sơ đồ Quy trình</h1>
            <p className="text-muted-foreground mt-1">Thiết kế luồng công việc và logic tự động hóa.</p>
          </div>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-5 h-5" />
            Tạo Flow
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl"></div>)}
          </div>
        ) : flows?.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border border-dashed">
            <Workflow className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Chưa có Flow nào</h3>
            <p className="text-muted-foreground mt-1">Sử dụng giao diện kéo thả để thiết kế quy trình mới.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {flows?.map((flow) => (
              <div key={flow.id} className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-xl hover:border-primary/30 transition-all group flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <button className="text-muted-foreground hover:bg-muted p-1 rounded-md"><MoreVertical className="w-4 h-4"/></button>
                </div>
                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{flow.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 mb-4 flex-1">{flow.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">{formatDate(flow.createdAt)}</span>
                  <Link href={`/flows/${flow.id}`} className="p-2 bg-primary text-primary-foreground rounded-full hover:scale-110 transition-transform shadow-md">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold">Flow Mới</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Tên Flow *</label>
                <input required autoFocus className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20" value={newFlow.name} onChange={e => setNewFlow({...newFlow, name: e.target.value})} placeholder="Vd: Xử lý đơn hàng..." />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Mô tả</label>
                <textarea className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 h-24" value={newFlow.description} onChange={e => setNewFlow({...newFlow, description: e.target.value})} />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-5 py-2.5 font-medium rounded-xl hover:bg-muted">Hủy</button>
                <button type="submit" disabled={createMutation.isPending} className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md">Tạo & Mở Editor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
