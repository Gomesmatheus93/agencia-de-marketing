import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Bot,
  User,
  Sparkles,
  Loader2,
  Zap,
  ChevronLeft,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

type Conversation = {
  id: number;
  title: string;
  updatedAt: Date;
};

export default function Chat() {
  const utils = trpc.useUtils();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: loadingConvs } = trpc.chat.getConversations.useQuery();
  const { data: messages = [], isLoading: loadingMsgs } = trpc.chat.getMessages.useQuery(
    { conversationId: activeConvId! },
    { enabled: !!activeConvId }
  );
  const { data: webhookSettings } = trpc.settings.getWebhooks.useQuery();

  const createConv = trpc.chat.createConversation.useMutation({
    onSuccess: (conv) => {
      utils.chat.getConversations.invalidate();
      setActiveConvId(conv.id);
    },
  });

  const sendMsg = trpc.chat.sendMessage.useMutation({
    onMutate: () => setIsTyping(true),
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ conversationId: activeConvId! });
      utils.chat.getConversations.invalidate();
      utils.chat.getStats.invalidate();
      setIsTyping(false);
    },
    onError: (err) => {
      setIsTyping(false);
      toast.error("Erro ao enviar mensagem: " + err.message);
    },
  });

  const deleteConv = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      utils.chat.getConversations.invalidate();
      if (activeConvId) setActiveConvId(null);
    },
  });

  const updateTitle = trpc.chat.updateTitle.useMutation({
    onSuccess: () => {
      utils.chat.getConversations.invalidate();
      setEditingId(null);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = await createConv.mutateAsync({ title: input.slice(0, 60) });
      convId = conv.id;
    }

    const msg = input.trim();
    setInput("");
    sendMsg.mutate({
      conversationId: convId,
      content: msg,
      useWebhook: webhookSettings?.hasChat ?? false,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const confirmEdit = () => {
    if (editingId && editTitle.trim()) {
      updateTitle.mutate({ id: editingId, title: editTitle.trim() });
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <AppLayout activeModule="chat">
      <div className="flex h-[calc(100vh-0px)] lg:h-screen overflow-hidden">
        {/* Conversations sidebar */}
        <div
          className={cn(
            "flex-shrink-0 flex flex-col border-r border-border/30 bg-background/40 backdrop-blur-sm transition-all duration-300",
            sidebarVisible ? "w-72" : "w-0 overflow-hidden"
          )}
        >
          <div className="p-4 border-b border-border/30 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">Conversas</h2>
            <Button
              size="sm"
              onClick={() => createConv.mutate({})}
              disabled={createConv.isPending}
              className="h-8 gap-1.5 text-xs gradient-primary text-white border-0 hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {loadingConvs ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 shimmer rounded-xl" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma conversa ainda</p>
                <p className="text-xs text-muted-foreground/60">Clique em "Nova" para começar</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150",
                    activeConvId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  {editingId === conv.id ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 text-xs bg-background/80 border border-border rounded-lg px-2 py-1 text-foreground outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingId(null); }}
                      />
                      <button onClick={confirmEdit} className="p-1 rounded hover:bg-primary/10 text-primary">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 text-xs truncate">{conv.title}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-accent transition-all">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 glass-card border-border/50">
                          <DropdownMenuItem onClick={() => startEdit(conv)} className="gap-2 text-xs">
                            <Edit2 className="w-3.5 h-3.5" /> Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteConv.mutate({ id: conv.id })}
                            className="gap-2 text-xs text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-border/30 glass flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              className="w-8 h-8 rounded-lg flex-shrink-0"
            >
              <ChevronLeft className={cn("w-4 h-4 transition-transform", !sidebarVisible && "rotate-180")} />
            </Button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">
                  {activeConv?.title || "Chat com IA"}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {webhookSettings?.hasChat ? "n8n conectado" : "IA integrada"}
                </div>
              </div>
            </div>
            {webhookSettings?.hasChat && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
                <Zap className="w-3 h-3" />
                n8n ativo
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
            {!activeConvId ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-2">Como posso ajudar?</h2>
                  <p className="text-sm text-muted-foreground">
                    Sou seu assistente de marketing digital. Posso ajudar com criação de conteúdo, estratégias, copywriting e muito mais.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {[
                    "Crie um post para Instagram sobre minha empresa",
                    "Sugira estratégias de marketing digital",
                    "Escreva um email de boas-vindas para clientes",
                    "Como melhorar meu SEO?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left text-xs p-3 glass-card hover:scale-[1.02] transition-all duration-200 text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : loadingMsgs ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn("flex gap-3", i % 2 === 0 && "flex-row-reverse")}>
                    <div className="w-8 h-8 rounded-xl shimmer flex-shrink-0" />
                    <div className={cn("space-y-1.5", i % 2 === 0 ? "items-end" : "items-start", "flex flex-col")}>
                      <div className="h-4 w-48 shimmer rounded-full" />
                      <div className="h-4 w-32 shimmer rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Envie uma mensagem para começar</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 animate-fade-in-up",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-violet-500 to-purple-600"
                        : "bg-gradient-to-br from-slate-600 to-slate-700"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={cn("max-w-[75%] space-y-1", msg.role === "user" ? "items-end" : "items-start", "flex flex-col")}>
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-sm"
                          : "glass-card text-foreground rounded-tl-sm"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3 animate-fade-in-up">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-border/30 glass">
            <div className="flex gap-3 items-end max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escreva sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                  className="resize-none min-h-[48px] max-h-[200px] pr-12 glass border-border/50 focus:border-primary/50 rounded-2xl text-sm"
                  rows={1}
                  disabled={isTyping}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                size="icon"
                className="w-11 h-11 rounded-xl gradient-primary text-white border-0 hover:opacity-90 flex-shrink-0 shadow-md"
              >
                {isTyping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              A IA pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
