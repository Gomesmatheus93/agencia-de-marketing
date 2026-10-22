import AppLayout from "@/components/AppLayout";
import { TaskError, TaskHistory, TaskProgress, useAgentTask } from "@/components/agents/AgentTask";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, CalendarCheck, CalendarRange, Check, GripVertical, Handshake, Loader2, MessageSquareText, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PlanItem = {
  date: string; time: string; format: "reel" | "carrossel" | "imagem" | "stories"; type: string; title: string;
  angle: string; hook: string; captionIdea: string; collab: string | null; notes: string | null; addresses?: string | null;
};
type Plan = {
  periodLabel: string; startDate: string; endDate: string; strategy: string;
  pillars: Array<{ name: string; share: number }>; items: PlanItem[]; stories: string;
  engagement: Array<{ handle: string; reason: string; group: "alcance" | "pares" | "compradores" }>;
  assumptions: string[]; calendarSent?: number[];
};

// screen: tela de criação com agente (arte pronta); sem screen, abre o chat do agente.
const FORMAT_STYLE: Record<PlanItem["format"], { label: string; className: string; agent: string; screen?: string }> = {
  reel: { label: "Reel", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300", agent: "reels" },
  carrossel: { label: "Carrossel", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300", agent: "carrossel", screen: "/dashboard/criar/carrossel" },
  imagem: { label: "Imagem", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300", agent: "legendas", screen: "/dashboard/criar/post" },
  stories: { label: "Stories", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", agent: "stories", screen: "/dashboard/criar/stories" },
};
const GROUP_LABEL = { alcance: "Alcance", pares: "Pares", compradores: "Compradores" } as const;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtDay(s: string) {
  const d = parseDate(s);
  return `${WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function daysBetween(start: string, end: string) {
  const out: string[] = [];
  const d = parseDate(start);
  const last = parseDate(end);
  while (d <= last && out.length < 62) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function Planning() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const t = useAgentTask<Plan>("planejamento");
  const [startDate, setStartDate] = useState(nextMonday);
  const [period, setPeriod] = useState<"semana" | "mes">("semana");
  const [postsPerWeek, setPostsPerWeek] = useState(5);
  const [goal, setGoal] = useState<"vendas" | "equilibrado" | "alcance" | "engajamento">("vendas");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragging, setDragging] = useState<number | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ index: number; item: PlanItem } | null>(null);
  const [redoing, setRedoing] = useState<{ index: number; item: PlanItem } | null>(null);
  const [redoFeedback, setRedoFeedback] = useState("");
  const regenerate = trpc.agents.regeneratePlanItem.useMutation({
    onSuccess: ({ item }) => { toast.success(`Nova pauta: ${item.title}`); setRedoing(null); setRedoFeedback(""); t.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateItem = trpc.agents.updatePlanItem.useMutation({
    onSuccess: () => t.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const saveItem = (index: number, item: PlanItem, message: string) =>
    updateItem.mutate({ threadId: t.threadId!, index, item: { ...item, addresses: item.addresses ?? null } }, { onSuccess: () => toast.success(message) });
  const moveTo = (index: number, day: string) => {
    const item = plan?.items[index];
    if (!item || item.date === day) return;
    saveItem(index, { ...item, date: day }, `Movida para ${fmtDay(day)}`);
  };

  const plan = t.result;
  const sent = new Set(plan?.calendarSent ?? []);
  const toCalendar = trpc.agents.planToCalendar.useMutation({
    onSuccess: ({ added }) => { toast.success(`${added} pauta(s) enviada(s) ao calendário`); setSelected(new Set()); t.refetch(); utils.editorialPlan.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Array<{ item: PlanItem; index: number }>>();
    plan?.items.forEach((item, index) => map.set(item.date, [...(map.get(item.date) ?? []), { item, index }]));
    map.forEach((list) => list.sort((a, b) => a.item.time.localeCompare(b.item.time)));
    return map;
  }, [plan]);
  // Dias do período mais qualquer dia para onde uma pauta tenha sido movida fora dele.
  const days = plan ? [...new Set([...daysBetween(plan.startDate, plan.endDate), ...plan.items.map((it) => it.date)])].sort() : [];

  const createWithAgent = (item: PlanItem) => {
    const { agent, screen } = FORMAT_STYLE[item.format];
    sessionStorage.setItem(screen ? `task_prefill_${agent}` : `agent_prefill_${agent}`, [
      `Crie este conteúdo do planejamento da Alle Energia:`,
      `- ${FORMAT_STYLE[item.format].label} em ${fmtDay(item.date)} às ${item.time}${item.collab ? `, collab com ${item.collab}` : ""}`,
      `- Pauta: ${item.title}`,
      `- Ângulo: ${item.angle}`,
      `- Gancho sugerido: ${item.hook}`,
      `- Direção da legenda: ${item.captionIdea}`,
      item.notes ? `- Observações: ${item.notes}` : "",
    ].filter(Boolean).join("\n"));
    navigate(screen ?? `/dashboard/agents/${agent}`);
  };

  const toggle = (i: number) => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <AppLayout activeModule="planning">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary"><Bot className="mr-1.5 h-3 w-3" />Agente de Planejamento</Badge>
              <h1 className="text-3xl font-bold tracking-tight">Planejamento de postagens</h1>
              <p className="mt-1 text-sm text-muted-foreground">O agente usa automaticamente a última Auditoria e a última análise de Marca, além da memória da equipe e dos posts recentes, e monta o plano. Você escolhe o que vai para o calendário.</p>
            </div>
            <TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} />
          </header>

          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[repeat(4,minmax(0,170px))_1fr_auto] md:items-end">
              <label className="space-y-1.5 text-sm"><span className="font-medium">Começa em</span><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Período</span>
                <select value={period} onChange={(e) => setPeriod(e.target.value as "semana" | "mes")} className="h-9 w-full rounded-md border bg-background px-2">
                  <option value="semana">Semana</option><option value="mes">Mês</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Foco do período</span>
                <select value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)} className="h-9 w-full rounded-md border bg-background px-2" title="A estratégia permanente da Alle fica em estrategia.md, na memória da equipe (página Agentes).">
                  <option value="vendas">Vendas</option><option value="equilibrado">Equilibrado</option><option value="engajamento">Engajamento</option><option value="alcance">Alcance e autoridade</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Posts por semana</span><Input type="number" min={1} max={14} value={postsPerWeek} onChange={(e) => setPostsPerWeek(Number(e.target.value))} /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Observações para o agente</span>
                <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: quarta-feira, post collab com @allpfit; evitar falar de preço" className="min-h-9" />
              </label>
              <Button className="gap-2" disabled={t.running || t.starting} onClick={() => t.start({ startDate, period, postsPerWeek, goal, notes: notes || undefined })}>
                {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Gerar planejamento
              </Button>
            </CardContent>
          </Card>

          {t.running && <TaskProgress agentName="Agente de Planejamento" activity={t.activity} startedAt={t.thread?.createdAt} />}
          {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
          {!t.thread && !t.running && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <CalendarRange className="mx-auto mb-3 h-8 w-8 text-primary/60" />Nenhum planejamento ainda. Preencha acima e clique em Gerar planejamento.
            </div>
          )}

          {plan && !t.running && (
            <>
              <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <Card><CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">{plan.periodLabel}</p>
                  <p className="mt-2 text-sm leading-relaxed">{plan.strategy}</p>
                </CardContent></Card>
                <Card><CardContent className="space-y-2 p-5">
                  <p className="text-sm font-semibold">Pilares</p>
                  {plan.pillars.map((p) => (
                    <div key={p.name}>
                      <div className="flex justify-between text-xs"><span>{p.name}</span><span className="text-muted-foreground">{p.share}%</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-gradient-to-r from-alle-purple to-alle-orange" style={{ width: `${Math.min(100, p.share)}%` }} /></div>
                    </div>
                  ))}
                </CardContent></Card>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{plan.items.length} pautas · {sent.size} no calendário · arraste os cards para trocar o dia ou use "editar"</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" disabled={!selected.size || toCalendar.isPending} onClick={() => toCalendar.mutate({ threadId: t.threadId!, indexes: [...selected] })}>
                    <CalendarCheck className="h-4 w-4" />Enviar selecionadas ({selected.size})
                  </Button>
                  <Button size="sm" className="gap-2" disabled={sent.size === plan.items.length || toCalendar.isPending} onClick={() => toCalendar.mutate({ threadId: t.threadId!, indexes: plan.items.map((_, i) => i) })}>
                    <CalendarCheck className="h-4 w-4" />Enviar todas ao calendário
                  </Button>
                </div>
              </div>

              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {days.map((day) => (
                  <div
                    key={day}
                    onDragOver={(e) => { e.preventDefault(); setOverDay(day); }}
                    onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
                    onDrop={(e) => { e.preventDefault(); if (dragging !== null) moveTo(dragging, day); setDragging(null); setOverDay(null); }}
                    className={cn("min-h-[140px] rounded-2xl border bg-card/60 p-2.5 transition-colors", overDay === day && dragging !== null && "border-primary bg-primary/5")}
                  >
                    <p className="mb-2 text-xs font-semibold capitalize text-muted-foreground">{fmtDay(day)}</p>
                    <div className="space-y-2">
                      {(byDay.get(day) ?? []).map(({ item, index }) => (
                        <div
                          key={index}
                          draggable
                          onDragStart={(e) => { setDragging(index); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); }}
                          onDragEnd={() => { setDragging(null); setOverDay(null); }}
                          className={cn("cursor-grab rounded-xl border bg-background p-2.5 text-xs shadow-sm active:cursor-grabbing", selected.has(index) && "ring-2 ring-primary", sent.has(index) && "opacity-70", dragging === index && "opacity-40")}
                        >
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                            <input type="checkbox" checked={selected.has(index)} disabled={sent.has(index)} onChange={() => toggle(index)} aria-label="Selecionar pauta" />
                            <span className="font-mono">{item.time}</span>
                            <span className={cn("rounded-full px-1.5 py-0.5 font-medium", FORMAT_STYLE[item.format].className)}>{FORMAT_STYLE[item.format].label}</span>
                          </div>
                          <p className="font-semibold leading-snug">{item.title}</p>
                          <p className="mt-0.5 text-[11px] text-primary">{item.type}</p>
                          {item.collab && <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300"><Handshake className="h-3 w-3" />{item.collab}</p>}
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-muted-foreground">detalhes</summary>
                            {item.addresses && <p className="mt-1 rounded bg-primary/5 px-1.5 py-1 text-primary"><b>Por quê:</b> {item.addresses}</p>}
                            <p className="mt-1"><b>Ângulo:</b> {item.angle}</p>
                            <p className="mt-1"><b>Gancho:</b> {item.hook}</p>
                            <p className="mt-1"><b>Legenda:</b> {item.captionIdea}</p>
                            {item.notes && <p className="mt-1"><b>Obs.:</b> {item.notes}</p>}
                          </details>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {sent.has(index) ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" />no calendário</span> : (
                              <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline" onClick={() => setEditing({ index, item: { ...item } })}><Pencil className="h-3 w-3" />editar</button>
                            )}
                            {!sent.has(index) && (
                              <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline" onClick={() => setRedoing({ index, item })}><RefreshCw className="h-3 w-3" />refazer</button>
                            )}
                            <button className="ml-auto inline-flex items-center gap-1 text-primary hover:underline" onClick={() => createWithAgent(item)}><MessageSquareText className="h-3 w-3" />criar com agente</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <Card><CardContent className="p-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Stories</p>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                      sessionStorage.setItem("task_prefill_stories", `Stories do planejamento (${plan.periodLabel}):\n${plan.stories}`);
                      navigate("/dashboard/criar/stories");
                    }}><MessageSquareText className="h-3.5 w-3.5" />Criar estes stories</Button>
                  </div>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{plan.stories}</p>
                </CardContent></Card>
                <Card><CardContent className="p-5">
                  <p className="mb-2 text-sm font-semibold">Perfis para interagir</p>
                  {plan.engagement.length ? (
                    <ul className="space-y-1.5 text-sm">
                      {plan.engagement.map((e) => (
                        <li key={e.handle} className="flex gap-2"><Badge variant="outline" className="shrink-0">{GROUP_LABEL[e.group]}</Badge><span><b>{e.handle}</b> — <span className="text-muted-foreground">{e.reason}</span></span></li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">Nenhum perfil sugerido.</p>}
                </CardContent></Card>
              </section>

              {plan.assumptions.length > 0 && (
                <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">O agente assumiu:</p>
                  <ul className="list-disc space-y-0.5 pl-4">{plan.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Dialog open={redoing !== null} onOpenChange={(o) => { if (!o && !regenerate.isPending) setRedoing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Refazer pauta</DialogTitle></DialogHeader>
          {redoing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O Agente de Planejamento cria outra pauta para <b className="text-foreground">{fmtDay(redoing.item.date)}</b> no lugar de “{redoing.item.title}”, sem repetir as outras da semana.
              </p>
              <label className="block space-y-1 text-xs font-medium">O que não ficou bom / o que você quer (opcional)
                <Textarea rows={3} value={redoFeedback} onChange={(e) => setRedoFeedback(e.target.value)} placeholder="Ex.: muito parecido com o de terça; quero um reel com depoimento de cliente" />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRedoing(null)} disabled={regenerate.isPending}>Cancelar</Button>
                <Button onClick={() => regenerate.mutate({ threadId: t.threadId!, index: redoing.index, feedback: redoFeedback.trim() || undefined })} disabled={regenerate.isPending}>
                  {regenerate.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando…</> : <><Sparkles className="mr-2 h-4 w-4" />Refazer</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {editing && (
        <PlanItemEditor
          item={editing.item}
          saving={updateItem.isPending}
          onClose={() => setEditing(null)}
          onSave={(item) => updateItem.mutate(
            { threadId: t.threadId!, index: editing.index, item: { ...item, addresses: item.addresses ?? null } },
            { onSuccess: () => { toast.success("Pauta atualizada"); setEditing(null); } },
          )}
        />
      )}
    </AppLayout>
  );
}

function PlanItemEditor({ item, saving, onClose, onSave }: { item: PlanItem; saving: boolean; onClose: () => void; onSave: (item: PlanItem) => void }) {
  const [draft, setDraft] = useState<PlanItem>(item);
  const set = <K extends keyof PlanItem>(key: K, value: PlanItem[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const label = "space-y-1 text-xs font-medium";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar pauta</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>Dia<Input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className={label}>Horário<Input type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} /></label>
          <label className={label}>Formato
            <select value={draft.format} onChange={(e) => set("format", e.target.value as PlanItem["format"])} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="reel">Reel</option><option value="carrossel">Carrossel</option><option value="imagem">Imagem</option><option value="stories">Stories</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className={label}>Tipo<Input value={draft.type} onChange={(e) => set("type", e.target.value)} placeholder="Prova, Ensino, Oferta…" /></label>
          <label className={label}>Título<Input value={draft.title} onChange={(e) => set("title", e.target.value)} /></label>
        </div>
        <label className={label}>Ângulo<Textarea rows={3} value={draft.angle} onChange={(e) => set("angle", e.target.value)} /></label>
        <label className={label}>Gancho<Textarea rows={2} value={draft.hook} onChange={(e) => set("hook", e.target.value)} /></label>
        <label className={label}>Direção da legenda<Textarea rows={2} value={draft.captionIdea} onChange={(e) => set("captionIdea", e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Collab (@)<Input value={draft.collab ?? ""} onChange={(e) => set("collab", e.target.value.trim() || null)} placeholder="vazio = sem collab" /></label>
          <label className={label}>Observações<Input value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(draft)} disabled={saving || !draft.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
