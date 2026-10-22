import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TOOL_LABELS } from "@/lib/agentLabels";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ArrowLeft, AtSign, Bot, CalendarRange, Check, CircleDashed, ClipboardCheck, Clapperboard, Copy,
  FileText, Flame, GalleryHorizontal, Loader2, MessageCircle, Plus, Recycle, Reply, Send, Trash2, Type, UserRound,
  ShieldCheck, Wand2, Wrench, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Link, useLocation, useParams } from "wouter";

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  marca: ShieldCheck,
  auditoria: ClipboardCheck,
  planejamento: CalendarRange,
  legendas: Type,
  carrossel: GalleryHorizontal,
  reels: Clapperboard,
  stories: CircleDashed,
  "pesquisa-viral": Flame,
  perfil: UserRound,
  humanizador: Wand2,
  respostas: Reply,
  comentarios: MessageCircle,
  direct: Send,
  reaproveitamento: Recycle,
};

type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string; tool_use_id?: string; is_error?: boolean; content?: unknown };

function toolDetail(block: Block): string {
  const input = block.input ?? {};
  if (block.name === "run_script") return String(input.script ?? "");
  if (block.name === "read_file" || block.name === "write_file") return String(input.path ?? "");
  if (block.name === "load_skill") return String(input.name ?? "");
  if (block.name === "get_instagram_posts") return input.limit ? `${input.limit} posts` : "";
  return "";
}

// ─── Lista de agentes ─────────────────────────────────────────────────────────

function AgentsHome() {
  const { data } = trpc.agents.list.useQuery();
  const [openFile, setOpenFile] = useState<string | null>(null);
  const files = trpc.agents.files.useQuery();

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-[1400px] space-y-7">
        <header className="rounded-3xl border border-primary/10 bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-3 border-primary/20 bg-primary/5 text-primary">
                <Bot className="mr-1.5 h-3 w-3" />Equipe interna
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Agentes</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                Cada agente cuida de uma parte do trabalho de uma agência. Eles leem a identidade da Alle, os posts publicados e a
                memória da equipe, e entregam tudo pronto para você aprovar. Nada é publicado sem você.
              </p>
            </div>
            <div className="flex flex-col gap-2">
            <Link href="/escritorio" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10">
              <Bot className="h-4 w-4" />Ver o escritório ao vivo
            </Link>
            <div className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm",
              data?.instagram.connected ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
            )}>
              <AtSign className={cn("h-5 w-5", data?.instagram.connected ? "text-emerald-600" : "text-amber-600")} />
              <div>
                <p className="font-medium">{data?.instagram.connected ? `Instagram conectado${data.instagram.username ? `: @${data.instagram.username}` : ""}` : "Instagram não conectado"}</p>
                <p className="text-xs text-muted-foreground">
                  {data?.instagram.connected ? "Os agentes leem os posts e métricas reais." : <>Conecte em <Link href="/dashboard/settings" className="underline">Configurações</Link> para os agentes lerem os posts.</>}
                </p>
              </div>
            </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.agents.map((agent) => {
            const Icon = AGENT_ICONS[agent.slug] ?? Bot;
            return (
              <Link key={agent.slug} href={`/dashboard/agents/${agent.slug}`}>
                <Card className="group h-full cursor-pointer border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <CardContent className="flex h-full gap-4 p-5">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-alle-purple to-alle-purple-light p-2.5 text-white shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{agent.name}</p>
                      <p className="text-xs font-medium text-primary">{agent.role}</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{agent.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>

        <section className="rounded-3xl border bg-card/80 p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Memória da equipe</h2>
              <p className="text-sm text-muted-foreground">
                Arquivos que todos os agentes leem e atualizam: a voz da marca (voice.md), o plano (plan.md), as referências (swipe.md) e o histórico (log.md).
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpenFile("")}><Plus className="h-4 w-4" />Novo arquivo</Button>
          </div>
          {files.data?.length ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {files.data.map((f) => (
                <button key={f.path} onClick={() => setOpenFile(f.path)} className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent/50">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.path}</p>
                    <p className="text-xs text-muted-foreground">{f.size.toLocaleString("pt-BR")} caracteres · {new Date(f.updatedAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Vazia por enquanto. Os agentes criam esses arquivos conforme trabalham. Um bom começo: peça ao Agente de Auditoria para analisar os posts da Alle e escrever o voice.md.
            </p>
          )}
        </section>
      </div>
      {openFile !== null && <FileEditor path={openFile} onClose={() => setOpenFile(null)} />}
    </main>
  );
}

function FileEditor({ path: initialPath, onClose }: { path: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const isNew = initialPath === "";
  const [path, setPath] = useState(initialPath);
  const [content, setContent] = useState("");
  const file = trpc.agents.file.useQuery({ path: initialPath }, { enabled: !isNew });
  useEffect(() => { if (file.data?.content != null) setContent(file.data.content); }, [file.data]);
  const save = trpc.agents.saveFile.useMutation({
    onSuccess: () => { toast.success("Arquivo salvo"); utils.agents.files.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.agents.deleteFile.useMutation({
    onSuccess: () => { toast.success("Arquivo apagado"); utils.agents.files.invalidate(); onClose(); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{isNew ? "Novo arquivo" : path}</DialogTitle></DialogHeader>
        {isNew && <Input placeholder="nome.md" value={path} onChange={(e) => setPath(e.target.value)} />}
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[50vh] font-mono text-xs" />
        <div className="flex justify-between gap-2">
          {!isNew ? (
            <Button variant="ghost" className="gap-2 text-destructive" onClick={() => confirm(`Apagar ${path}?`) && remove.mutate({ path })}>
              <Trash2 className="h-4 w-4" />Apagar
            </Button>
          ) : <span />}
          <Button onClick={() => save.mutate({ path, content })} disabled={save.isPending || !path}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Conversa com um agente ───────────────────────────────────────────────────

function AgentChat({ slug }: { slug: string }) {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const { data } = trpc.agents.list.useQuery();
  const agent = data?.agents.find((a) => a.slug === slug);
  const threads = trpc.agents.threads.useQuery({ agentSlug: slug });
  const [threadId, setThreadId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Pauta enviada por outra tela (ex.: "criar com agente" no planejamento): abre conversa nova já preenchida.
  const prefilled = useRef(false);
  useEffect(() => {
    prefilled.current = false;
    const key = `agent_prefill_${slug}`;
    const prefill = sessionStorage.getItem(key);
    if (prefill) {
      sessionStorage.removeItem(key);
      prefilled.current = true;
      setThreadId(null);
      setDraft(prefill);
    }
  }, [slug]);

  useEffect(() => {
    if (prefilled.current) return;
    setThreadId(threads.data?.[0]?.id ?? null);
  }, [slug, threads.data?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const thread = trpc.agents.thread.useQuery(
    { threadId: threadId ?? 0 },
    { enabled: threadId !== null, refetchInterval: (q) => (q.state.data?.thread.status === "running" ? 2000 : false) }
  );
  const running = thread.data?.thread.status === "running";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.data?.messages.length, running]);
  useEffect(() => { if (!running) utils.agents.files.invalidate(); }, [running, utils]);

  const start = trpc.agents.start.useMutation({
    onSuccess: ({ threadId: id }) => { setDraft(""); setThreadId(id); utils.agents.threads.invalidate({ agentSlug: slug }); },
    onError: (e) => toast.error(e.message),
  });
  const send = trpc.agents.send.useMutation({
    onSuccess: () => { setDraft(""); utils.agents.thread.invalidate({ threadId: threadId! }); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.agents.deleteThread.useMutation({
    onSuccess: () => { setThreadId(null); utils.agents.threads.invalidate({ agentSlug: slug }); },
  });
  const approve = trpc.agents.setApproval.useMutation({
    onSuccess: () => utils.agents.thread.invalidate({ threadId: threadId! }),
  });

  const submit = () => {
    const text = draft.trim();
    if (!text || running) return;
    if (threadId === null) start.mutate({ agentSlug: slug, message: text });
    else send.mutate({ threadId, message: text });
  };

  // Resultados de ferramenta por id: falhas (para marcar o passo) e artes renderizadas (para exibir).
  const { toolErrors, artUrls } = useMemo(() => {
    const errors = new Set<string>();
    const arts = new Map<string, string>();
    for (const m of thread.data?.messages ?? []) {
      for (const b of m.content as Block[]) {
        if (b.type !== "tool_result") continue;
        if (b.is_error) errors.add(b.tool_use_id!);
        const texts = Array.isArray(b.content) ? (b.content as Block[]).filter((c) => c.type === "text").map((c) => c.text) : [String(b.content ?? "")];
        const url = texts.join("\n").match(/ARTE_URL=(\S+)/)?.[1];
        if (url) arts.set(b.tool_use_id!, url);
      }
    }
    return { toolErrors: errors, artUrls: arts };
  }, [thread.data]);

  const Icon = AGENT_ICONS[slug] ?? Bot;
  if (data && !agent) return <main className="p-8"><p>Agente não encontrado.</p></main>;

  return (
    <main className="flex h-[calc(100vh-0px)] min-h-0">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/40 bg-card/40 md:flex">
        <div className="space-y-2 p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => navigate("/dashboard/agents")}><ArrowLeft className="h-4 w-4" />Todos os agentes</Button>
          <Button size="sm" className="w-full gap-2" onClick={() => setThreadId(null)}><Plus className="h-4 w-4" />Nova conversa</Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 scrollbar-thin">
          {threads.data?.map((t) => (
            <div key={t.id} className={cn("group flex items-center gap-1 rounded-lg px-2 py-2 text-sm", t.id === threadId ? "bg-accent" : "hover:bg-accent/50")}>
              <button className="min-w-0 flex-1 truncate text-left" onClick={() => setThreadId(t.id)}>
                {t.status === "running" && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                {t.status === "failed" && <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-500" />}
                {t.title}
              </button>
              <button className="opacity-0 group-hover:opacity-100" onClick={() => confirm("Apagar esta conversa?") && remove.mutate({ threadId: t.id })}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border/40 px-5 py-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate("/dashboard/agents")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-alle-purple to-alle-purple-light p-2 text-white"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{agent?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{agent?.description}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 scrollbar-thin">
          <div className="mx-auto max-w-3xl space-y-5">
            {threadId === null && (
              <div className="space-y-4 py-10 text-center">
                <p className="text-lg font-semibold">Como o {agent?.name} pode ajudar?</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {agent?.starters.map((s) => (
                    <button key={s} onClick={() => setDraft(s)} className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent">{s}</button>
                  ))}
                </div>
              </div>
            )}

            {thread.data?.messages.map((m) => {
              const blocks = m.content as Block[];
              if (m.role === "user") {
                const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
                if (!text) return null;
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-gradient-to-br from-alle-purple to-alle-purple-light px-4 py-2.5 text-sm text-white">{text}</div>
                  </div>
                );
              }
              const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
              const tools = blocks.filter((b) => b.type === "tool_use");
              return (
                <div key={m.id} className="space-y-2">
                  {tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map((b) => (
                        <span key={b.id} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground", toolErrors.has(b.id!) && "border-amber-500/40 text-amber-700 dark:text-amber-400")}>
                          <Wrench className="h-3 w-3" />{TOOL_LABELS[b.name!] ?? b.name}{toolDetail(b) && <span className="font-mono">· {toolDetail(b)}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  {tools.some((b) => artUrls.has(b.id!)) && (
                    <div className="flex flex-wrap gap-2">
                      {tools.filter((b) => artUrls.has(b.id!)).map((b) => (
                        <a key={b.id} href={artUrls.get(b.id!)} target="_blank" rel="noreferrer" title={String(b.input?.title ?? "")}>
                          <img src={artUrls.get(b.id!)} alt={String(b.input?.title ?? "Arte")} className="h-56 rounded-xl border object-contain shadow-sm transition-transform hover:scale-[1.02]" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}
                  {text && (
                    <div className={cn("rounded-2xl border bg-card px-5 py-4", m.approval === "approved" && "border-emerald-500/40", m.approval === "rejected" && "border-destructive/40 opacity-70")}>
                      <div className="prose prose-sm max-w-none dark:prose-invert"><Streamdown>{text}</Streamdown></div>
                      {m.approval && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                          {m.approval === "pending" ? (
                            <>
                              <Button size="sm" variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400" onClick={() => approve.mutate({ messageId: m.id, approval: "approved" })}><Check className="h-3.5 w-3.5" />Aprovar</Button>
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => approve.mutate({ messageId: m.id, approval: "rejected" })}><X className="h-3.5 w-3.5" />Reprovar</Button>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className={m.approval === "approved" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>{m.approval === "approved" ? "Aprovado" : "Reprovado"}</Badge>
                              <button className="text-xs text-muted-foreground underline" onClick={() => approve.mutate({ messageId: m.id, approval: "pending" })}>desfazer</button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="ml-auto gap-1.5" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copiado"); }}><Copy className="h-3.5 w-3.5" />Copiar</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {running && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{agent?.name} está trabalhando…</div>
            )}
            {thread.data?.thread.status === "failed" && (
              <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <div><p className="font-medium">O agente parou com um erro.</p><p className="text-muted-foreground">{thread.data.thread.lastError}</p></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-border/40 p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={running ? "Aguarde o agente terminar…" : `Peça algo ao ${agent?.name ?? "agente"}…`}
              className="max-h-48 min-h-[52px] resize-none"
              disabled={running}
            />
            <Button onClick={submit} disabled={!draft.trim() || running || start.isPending || send.isPending} className="h-[52px] w-[52px] shrink-0" size="icon">
              {start.isPending || send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Agents() {
  const params = useParams<{ slug?: string }>();
  return (
    <AppLayout activeModule={params.slug === "reels" ? "agentReels" : "agents"}>
      {params.slug ? <AgentChat slug={params.slug} /> : <AgentsHome />}
    </AppLayout>
  );
}
