import { useState, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useGetFlow, useUpdateFlow } from "@workspace/api-client-react";
import { useParams } from "wouter";
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  addEdge,
  Connection,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowLeft, Save, MousePointer2 } from "lucide-react";
import { Link } from "wouter";

export default function FlowEditor() {
  const { id } = useParams();
  const { data: flow, isLoading } = useGetFlow(id || "");
  const updateMutation = useUpdateFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (flow) {
      try {
        setNodes(JSON.parse(flow.nodes || "[]"));
        setEdges(JSON.parse(flow.edges || "[]"));
      } catch (e) {
        console.error("Failed to parse flow data");
      }
    }
  }, [flow, setNodes, setEdges]);

  const onConnect = useCallback((params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleSave = () => {
    if (!id) return;
    updateMutation.mutate({
      id,
      data: {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges)
      }
    }, {
      onSuccess: () => alert("Đã lưu thành công!")
    });
  };

  const addNode = () => {
    const newNode = {
      id: `node_${Date.now()}`,
      data: { label: 'Node mới' },
      position: { x: Math.random() * 300, y: Math.random() * 300 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  if (isLoading) return <MainLayout><div className="p-8">Đang tải editor...</div></MainLayout>;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Editor Header */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/flows" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-bold text-foreground text-lg">{flow?.name}</h1>
            <p className="text-xs text-muted-foreground">Tự động lưu bị tắt. Vui lòng bấm lưu.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addNode} className="px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors text-sm flex items-center gap-2">
            <MousePointer2 className="w-4 h-4" /> Thêm Node
          </button>
          <button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {updateMutation.isPending ? "Đang lưu..." : "Lưu sơ đồ"}
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 w-full bg-slate-50 dark:bg-slate-900/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          className="bg-dot-pattern"
        >
          <Controls className="bg-card border-border shadow-lg rounded-lg overflow-hidden" />
          <MiniMap className="bg-card border-border shadow-lg rounded-lg" maskColor="hsl(var(--primary)/0.2)" />
          <Background gap={16} size={1} color="hsl(var(--muted-foreground)/0.3)" />
        </ReactFlow>
      </div>
    </div>
  );
}
