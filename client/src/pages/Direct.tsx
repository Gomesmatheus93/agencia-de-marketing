import AppLayout from "@/components/AppLayout";
import { DmAutoReplyDialog } from "@/components/DmAutoReplyDialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowLeft, Bot, ExternalLink, Instagram, Loader2, MessageCircle, RefreshCw, Search, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const LIST_REFRESH_MS = 30_000;
const THREAD_REFRESH_MS = 15_000;

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function listTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return "Hoje";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
const hour = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Avatar com a inicial do @ (a API de conversas não traz a foto de perfil). */
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-alle-purple to-alle-orange font-semibold uppercase text-white shadow-sm",
        size === "md" ? "h-11 w-11 text-base" : "h-9 w-9 text-sm",
      )}
    >
      {name.replace(/^@/, "").charAt(0) || "?"}
    </span>
  );
}

/** Direct do Instagram: conversas à esquerda, chat à direita (no celular, um de cada vez). */
export default function Direct() {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [autoOpen, setAutoOpen] = useState(false);
  const list = trpc.inbox.conversations.useQuery(undefined, { refetchInterval: LIST_REFRESH_MS, staleTime: 20_000 });
  const conversations = list.data?.conversations ?? [];
  const filtered = useMemo(
    () => conversations.filter((c) => (c.customer?.username ?? "").toLowerCase().includes(query.trim().toLowerCase().replace(/^@/, ""))),
    [conversations, query],
  );
  const waiting = conversations.filter((c) => !c.lastFromMe).length;
  const current = conversations.find((c) => c.id === selected);

  useEffect(() => {
    // No computador abre a primeira conversa; no celular começa pela lista.
    if (!selected && conversations.length && window.matchMedia("(min-width: 768px)").matches) setSelected(conversations[0].id);
  }, [conversations, selected]);

  return (
    <AppLayout activeModule="direct">
      <main className="min-h-screen p-3 md:p-6">
        <div className="mx-auto max-w-6xl">
          {list.isLoading ? (
            <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando conversas…</div>
          ) : list.error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{list.error.message}</div>
          ) : !list.data?.connected ? (
            <div className="rounded-3xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              <Instagram className="mx-auto mb-3 h-10 w-10 text-primary/60" />Conecte o Instagram (com a página do Facebook) para ver o Direct.
            </div>
          ) : (
            <section className="grid h-[calc(100vh-48px)] min-h-[520px] overflow-hidden rounded-3xl border bg-card shadow-sm md:h-[calc(100vh-72px)] md:grid-cols-[320px_1fr]">
              {/* ── Lista de conversas ── */}
              <aside className={cn("flex min-h-0 flex-col border-r", selected && "hidden md:flex")}>
                <div className="space-y-3 border-b p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h1 className="text-xl font-bold tracking-tight">Direct</h1>
                      <p className="text-xs text-muted-foreground">
                        {list.data.account ? `@${list.data.account} · ` : ""}{waiting ? `${waiting} aguardando resposta` : "tudo respondido"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAutoOpen(true)}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Respostas automáticas"
                    >
                      <Bot className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => list.refetch()}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Atualizar"
                    >
                      <RefreshCw className={cn("h-4 w-4", list.isFetching && "animate-spin")} />
                    </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 rounded-full bg-muted/70 px-3 py-2 text-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar @" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
                  </label>
                </div>
                <ul className="flex-1 overflow-y-auto p-2">
                  {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</li>}
                  {filtered.map((c) => {
                    const name = c.customer?.username ?? "?";
                    const pending = !c.lastFromMe;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(c.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                            selected === c.id ? "bg-primary/10" : "hover:bg-muted/60",
                          )}
                        >
                          <Avatar name={name} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className={cn("truncate text-sm", pending ? "font-bold" : "font-medium")}>{name}</span>
                              <span className={cn("shrink-0 text-[11px]", pending ? "font-semibold text-alle-orange" : "text-muted-foreground")}>{listTime(c.updatedTime)}</span>
                            </span>
                            <span className="flex items-center gap-2">
                              <span className={cn("truncate text-xs", pending ? "text-foreground" : "text-muted-foreground")}>
                                {c.lastFromMe ? "Você: " : ""}{c.lastMessage}
                              </span>
                              {pending && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-alle-orange" aria-label="aguardando resposta" />}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>

              {/* ── Chat ── */}
              {selected ? (
                <Thread key={selected} conversationId={selected} fallbackName={current?.customer?.username ?? ""} onBack={() => setSelected(null)} />
              ) : (
                <div className="hidden flex-col items-center justify-center gap-3 text-muted-foreground md:flex">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-alle-purple/15 to-alle-orange/15">
                    <MessageCircle className="h-7 w-7 text-primary" />
                  </span>
                  <p className="text-sm">Escolha uma conversa para começar</p>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
      <DmAutoReplyDialog open={autoOpen} onOpenChange={setAutoOpen} />
    </AppLayout>
  );
}

function Thread({ conversationId, fallbackName, onBack }: { conversationId: string; fallbackName: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const thread = trpc.inbox.messages.useQuery({ conversationId }, { refetchInterval: THREAD_REFRESH_MS, staleTime: 8_000 });
  const reply = trpc.inbox.reply.useMutation({
    onSuccess: () => { setText(""); thread.refetch(); utils.inbox.conversations.invalidate(); input.current?.focus(); },
    onError: (e) => toast.error(e.message),
  });
  const messages = thread.data?.messages ?? [];
  const name = thread.data?.customer?.username ?? fallbackName;
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  // Altura do campo acompanha o texto (até 5 linhas).
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  const send = () => { if (text.trim() && !reply.isPending) reply.mutate({ conversationId, text: text.trim() }); };

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur">
        <button type="button" onClick={onBack} className="-ml-1 rounded-full p-1.5 hover:bg-muted md:hidden" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></button>
        <Avatar name={name || "?"} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name ? `@${name}` : "…"}</p>
          <p className="text-[11px] text-muted-foreground">Instagram Direct</p>
        </div>
        {name && (
          <a href={`https://instagram.com/${name}`} target="_blank" rel="noreferrer" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Abrir perfil">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </header>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-alle-purple/[0.04] via-transparent to-alle-orange/[0.04] px-3 py-4 md:px-6">
        {thread.isLoading && <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando mensagens…</p>}
        {thread.error && <p className="py-6 text-center text-sm text-destructive">{thread.error.message}</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || !sameDay(new Date(prev.createdTime), new Date(m.createdTime));
          const groupedWithPrev = !newDay && prev?.fromMe === m.fromMe;
          const lastOfGroup = !next || next.fromMe !== m.fromMe || !sameDay(new Date(next.createdTime), new Date(m.createdTime));
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">{dayLabel(m.createdTime)}</span>
                </div>
              )}
              <div className={cn("flex items-end gap-2", m.fromMe ? "justify-end" : "justify-start", groupedWithPrev ? "mt-0.5" : "mt-3")}>
                {!m.fromMe && (lastOfGroup ? <Avatar name={name || "?"} size="sm" /> : <span className="w-9 shrink-0" />)}
                <div
                  className={cn(
                    "max-w-[78%] px-3.5 py-2 text-sm shadow-sm md:max-w-[65%]",
                    m.fromMe
                      ? "rounded-2xl bg-gradient-to-br from-alle-purple to-alle-purple-light text-white"
                      : "rounded-2xl border bg-background text-foreground",
                    lastOfGroup && (m.fromMe ? "rounded-br-md" : "rounded-bl-md"),
                  )}
                >
                  {m.attachmentUrl && (
                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer">
                      <img src={m.attachmentUrl} alt="anexo" className="mb-1 max-h-64 rounded-xl" />
                    </a>
                  )}
                  {m.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>}
                  <p className={cn("mt-0.5 text-right text-[10px]", m.fromMe ? "text-white/70" : "text-muted-foreground")}>{hour(m.createdTime)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <footer className="border-t bg-card p-3">
        {thread.data && !thread.data.canReply ? (
          <p className="rounded-2xl bg-muted/70 px-4 py-3 text-center text-xs text-muted-foreground">
            Passaram mais de 24 h desde a última mensagem do cliente: a Meta não deixa responder por aqui. Responda pelo app do Instagram.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={input}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Mensagem…"
              className="max-h-[132px] min-h-[44px] flex-1 resize-none rounded-3xl border bg-muted/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || reply.isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-alle-purple to-alle-orange text-white shadow-md transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-40"
              aria-label="Enviar"
            >
              {reply.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
