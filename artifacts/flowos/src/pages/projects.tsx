import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Folder, MoreVertical, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Link } from "wouter";

export default function Projects() {
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useListProjects();
  const createMutation = useCreateProject();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newProject, setNewProject] = useState({ name: "", description: "", color: "#008264" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { data: newProject },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
          setIsCreateOpen(false);
          setNewProject({ name: "", description: "", color: "#008264" });
        }
      }
    );
  };

  const filteredProjects = projects?.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dự án</h1>
            <p className="text-muted-foreground mt-1">Quản lý tất cả dự án và chiến dịch của bạn.</p>
          </div>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 transition-all"
          >
            <Plus className="w-5 h-5" />
            Tạo dự án mới
          </button>
        </div>

        <div className="relative max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Tìm kiếm dự án..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl"></div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border border-dashed">
            <Folder className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Chưa có dự án nào</h3>
            <p className="text-muted-foreground mt-1">Hãy tạo dự án đầu tiên của bạn để bắt đầu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link 
                key={project.id} 
                href={`/projects/${project.id}`}
                className="group bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 block"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${project.color}15` }}>
                    <Folder className="w-6 h-6" style={{ color: project.color }} />
                  </div>
                  <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors" onClick={(e) => e.preventDefault()}>
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{project.name}</h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2 min-h-[2.5rem]">
                  {project.description || "Không có mô tả."}
                </p>
                
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span title="Thành viên">👥 {project.memberCount}</span>
                    <span title="Công việc">✅ {project.completedTaskCount}/{project.taskCount}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium px-2.5 py-1 bg-muted rounded-md">
                    {formatDate(project.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold">Tạo dự án mới</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Tên dự án *</label>
                <input 
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                  placeholder="Nhập tên dự án..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Mô tả</label>
                <textarea 
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none h-24"
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                  placeholder="Mô tả ngắn về dự án..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Màu sắc</label>
                <div className="flex gap-3">
                  {['#008264', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewProject({...newProject, color: c})}
                      className={`w-8 h-8 rounded-full shadow-sm transition-transform ${newProject.color === c ? 'scale-110 ring-2 ring-offset-2 ring-foreground' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="pt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-5 py-2.5 font-medium rounded-xl hover:bg-muted transition-colors">Hủy</button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {createMutation.isPending ? "Đang tạo..." : "Tạo dự án"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
