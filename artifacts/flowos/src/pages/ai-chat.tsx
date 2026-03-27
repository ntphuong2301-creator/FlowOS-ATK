import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAiChat, useGetAiHistory, AiMessage } from "@workspace/api-client-react";
import { Send, Bot, User as UserIcon, Loader2, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function AiChat() {
  const user = useAppStore(state => state.user);
  const { data: history, isLoading } = useGetAiHistory();
  const chatMutation = useAiChat();
  
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history) {
      setMessages(history);
    }
  }, [history]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMsg = input.trim();
    setInput("");
    
    // Optimistic user message
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, message: userMsg, role: 'user', createdAt: new Date().toISOString() }]);

    chatMutation.mutate(
      { data: { message: userMsg } },
      {
        onSuccess: (data) => {
          setMessages(prev => [...prev, data]);
        }
      }
    );
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-border px-6 flex items-center gap-3 shrink-0 bg-primary/5">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">FlowOS Assistant</h2>
            <p className="text-xs text-primary font-medium">Trợ lý AI Claude Anthropic</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <Bot className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold text-foreground">Xin chào {user?.name}!</h3>
              <p className="text-muted-foreground mt-2">Tôi là trợ lý AI của FlowOS. Tôi có thể giúp bạn tóm tắt dự án, viết mô tả công việc, hoặc phân tích dữ liệu.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg.id || i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 rounded-tr-sm' 
                    : 'bg-muted text-foreground border border-border/50 rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                </div>
              </div>
            ))
          )}
          {chatMutation.isPending && (
             <div className="flex gap-4">
               <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground"><Bot className="w-4 h-4" /></div>
               <div className="bg-muted px-5 py-4 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
                 <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
             </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-background/50 shrink-0">
          <form onSubmit={handleSend} className="relative max-w-4xl mx-auto flex items-end gap-2 bg-card border border-border rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Nhập câu hỏi cho trợ lý AI..."
              className="w-full bg-transparent resize-none max-h-32 min-h-[44px] py-2.5 px-3 focus:outline-none text-foreground"
              rows={1}
              onKeyDown={e => {
                if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
              }}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || chatMutation.isPending}
              className="w-11 h-11 shrink-0 bg-primary text-primary-foreground rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-md"
            >
              <Send className="w-5 h-5 -ml-0.5" />
            </button>
          </form>
          <div className="text-center mt-2 text-[10px] text-muted-foreground">AI có thể cung cấp thông tin không chính xác. Hãy kiểm tra lại.</div>
        </div>
      </div>
    </MainLayout>
  );
}
