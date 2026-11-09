import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Instagram, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const REFRESH_MS = 15_000;

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Direct do Instagram: conversas à esquerda, mensagens e resposta à direita. */
export default function Direct() {
  const [selected, setSelected] = useState<string | null>(null);
  const list = trpc.inbox.conversations.useQuery(undefined, { refetchInterval: REFRESH_MS });
  const conversations = list.data?.conversations ?? [];

  useEffect(() => {
    if (!selected && conversations.length) setSelected(conversations[0].id);
  }, [conversations, selected]);

  return (
    <AppLayout activeModule="direct">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Direct</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Mensagens do Instagram{list.data?.connected && list.data.account ? ` de @${list.data.account}` : ""}. Atualiza sozinho a cada 15 segundos.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => list.refetch()} disabled={list.isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5", list.isFetching && "animate-spin")} />Atualizar
            </Button>
          </header>

          {list.isLoading ? (
            <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando conversas…</div>
          ) : list.error ? (
            <div className="rounded-2xl border border-destructive/40 p-6 text-sm text-destructive">{list.error.message}</div>
          ) : !list.data?.connected ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <Instagram className="mx-auto mb-3 h-8 w-8 text-primary/60" />Conecte o Instagram (com a página do Facebook) para ver o Direct.
            </div>
          ) : (
            <section className="grid h-[calc(100vh-200px)] min-h-[480px] overflow-hidden rounded-2xl border bg-card md:grid-cols-[300px_1fr]">
              <ul className="overflow-y-auto border-b md:border-b-0 md:border-r">
                {conversations.length === 0 && <li className="p-6 text-sm text-muted-foreground">Nenhuma conversa ainda.</li>}
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.id)}
                      className={cn("flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50", selected === c.id && "bg-primary/10")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">@{c.customer?.username ?? "?"}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{when(c.updatedTime)}</span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{c.lastFromMe ? "Você: " : ""}{c.lastMessage}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {selected ? <Thread key={selected} conversationId={selected} /> : (
                <div className="flex items-center justify-center text-sm text-muted-foreground"><MessageCircle className="mr-2 h-4 w-4" />Escolha uma conversa</div>
              )}
            </section>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

function Thread({ conversationId }: { conversationId: string }) {
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const thread = trpc.inbox.messages.useQuery({ conversationId }, { refetchInterval: REFRESH_MS });
  const reply = trpc.inbox.reply.useMutation({
    onSuccess: () => { setText(""); thread.refetch(); utils.inbox.conversations.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const count = thread.data?.messages.length ?? 0;
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [count]);

  const send = () => { if (text.trim() && !reply.isPending) reply.mutate({ conversationId, text: text.trim() }); };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b px-4 py-3 text-sm font-semibold">@{thread.data?.customer?.username ?? "…"}</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {thread.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>}
        {thread.error && <p className="text-sm text-destructive">{thread.error.message}</p>}
        {thread.data?.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm", m.fromMe ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {m.attachmentUrl && <img src={m.attachmentUrl} alt="anexo" className="mb-1 max-h-60 rounded-lg" />}
              {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
              <p className={cn("mt-1 text-[10px]", m.fromMe ? "text-primary-foreground/70" : "text-muted-foreground")}>{when(m.createdTime)}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="border-t p-3">
        {thread.data && !thread.data.canReply ? (
          <p className="text-xs text-muted-foreground">Passaram mais de 24 h desde a última mensagem do cliente: a Meta não deixa responder por aqui. Responda pelo app do Instagram.</p>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escreva uma resposta… (Enter envia, Shift+Enter quebra linha)"
              className="min-h-[44px] resize-none"
            />
            <Button className="gap-1.5" onClick={send} disabled={!text.trim() || reply.isPending}>
              {reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
