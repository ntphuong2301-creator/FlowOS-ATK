import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useListTasks, useUpdateTask, useCreateTask, useListProjects, Task, TaskStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, MoreHorizontal, Calendar, Tag as TagIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: "todo", title: "Cần làm", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { id: "in_progress", title: "Đang làm", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { id: "done", title: "Hoàn thành", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { id: "cancelled", title: "Đã hủy", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
];

export default function Tasks() {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string>("");
  
  const { data: projects } = useListProjects();
  const { data: tasks, isLoading } = useListTasks(selectedProject ? { projectId: selectedProject } : undefined);
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", projectId: "", status: "todo" as TaskStatus });

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as TaskStatus;
    
    // Optimistic update
    queryClient.setQueryData<Task[]>([`/api/tasks`, selectedProject ? { projectId: selectedProject } : undefined], (old) => {
      if (!old) return old;
      return old.map(t => t.id === draggableId ? { ...t, status: newStatus } : t);
    });

    updateTask.mutate({ id: draggableId, data: { status: newStatus } }, {
      onError: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] })
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.projectId) return alert("Vui lòng chọn dự án");
    
    createTask.mutate({ data: newTask }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        setIsCreateOpen(false);
        setNewTask({ ...newTask, title: "", description: "" });
      }
    });
  };

  const tasksByColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks?.filter(t => t.status === col.id) || [];
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <MainLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bảng công việc</h1>
            <p className="text-muted-foreground mt-1">Kéo thả để cập nhật trạng thái.</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={selectedProject} 
              onChange={e => setSelectedProject(e.target.value)}
              className="px-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            >
              <option value="">Tất cả dự án</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button 
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-5 h-5" />
              Thêm task
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex-1 overflow-x-auto pb-4">
              <div className="flex gap-6 h-full min-w-max">
                {COLUMNS.map(col => (
                  <div key={col.id} className="w-80 flex flex-col bg-muted/40 rounded-2xl border border-border/50">
                    <div className="p-4 flex items-center justify-between shrink-0 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{col.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.color}`}>
                          {tasksByColumn[col.id].length}
                        </span>
                      </div>
                      <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="w-5 h-5"/></button>
                    </div>
                    
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef} 
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                        >
                          {tasksByColumn[col.id].map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-card p-4 rounded-xl shadow-sm border border-border group hover:border-primary/30 transition-colors ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20 rotate-2 scale-105' : ''}`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                                      task.priority === 'urgent' ? 'bg-rose-100 text-rose-700' :
                                      task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                      task.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {task.priority === 'urgent' ? 'Khẩn cấp' : task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'TB' : 'Thấp'}
                                    </span>
                                  </div>
                                  <h4 className="font-medium text-foreground leading-snug">{task.title}</h4>
                                  
                                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                    {task.dueDate && (
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{formatDate(task.dueDate)}</span>
                                      </div>
                                    )}
                                    {task.project && (
                                      <div className="flex items-center gap-1.5 ml-auto truncate" title={task.project.name}>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.project.color }}></div>
                                        <span className="truncate max-w-[100px]">{task.project.name}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold">Thêm công việc</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Tiêu đề *</label>
                <input 
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  placeholder="Làm gì đó..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Dự án *</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={newTask.projectId}
                  onChange={e => setNewTask({...newTask, projectId: e.target.value})}
                >
                  <option value="">-- Chọn dự án --</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-5 py-2.5 font-medium rounded-xl hover:bg-muted">Hủy</button>
                <button type="submit" disabled={createTask.isPending} className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md">
                  {createTask.isPending ? "Đang lưu..." : "Lưu công việc"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
