import AppLayout from "@/components/AppLayout";
import { TaskError, TaskHistory, TaskProgress, useAgentTask } from "@/components/agents/AgentTask";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, CalendarCheck, CalendarRange, Check, Handshake, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PlanItem = {
  date: string; time: string; format: "reel" | "carrossel" | "imagem" | "stories"; type: string; title: string;
  angle: string; hook: string; captionIdea: string; collab: string | null; notes: string | null;
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
  const [goal, setGoal] = useState<"vendas" | "equilibrado" | "alcance">("vendas");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

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
  const days = plan ? daysBetween(plan.startDate, plan.endDate) : [];

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
              <p className="mt-1 text-sm text-muted-foreground">O agente lê a memória da equipe, a identidade da Alle e os posts recentes, e monta o plano. Você escolhe o que vai para o calendário.</p>
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
                  <option value="vendas">Vendas</option><option value="equilibrado">Equilibrado</option><option value="alcance">Alcance e autoridade</option>
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
                <p className="text-sm text-muted-foreground">{plan.items.length} pautas · {sent.size} no calendário</p>
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
                  <div key={day} className="min-h-[140px] rounded-2xl border bg-card/60 p-2.5">
                    <p className="mb-2 text-xs font-semibold capitalize text-muted-foreground">{fmtDay(day)}</p>
                    <div className="space-y-2">
                      {(byDay.get(day) ?? []).map(({ item, index }) => (
                        <div key={index} className={cn("rounded-xl border bg-background p-2.5 text-xs shadow-sm", selected.has(index) && "ring-2 ring-primary", sent.has(index) && "opacity-70")}>
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <input type="checkbox" checked={selected.has(index)} disabled={sent.has(index)} onChange={() => toggle(index)} aria-label="Selecionar pauta" />
                            <span className="font-mono">{item.time}</span>
                            <span className={cn("rounded-full px-1.5 py-0.5 font-medium", FORMAT_STYLE[item.format].className)}>{FORMAT_STYLE[item.format].label}</span>
                          </div>
                          <p className="font-semibold leading-snug">{item.title}</p>
                          <p className="mt-0.5 text-[11px] text-primary">{item.type}</p>
                          {item.collab && <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300"><Handshake className="h-3 w-3" />{item.collab}</p>}
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-muted-foreground">detalhes</summary>
                            <p className="mt-1"><b>Ângulo:</b> {item.angle}</p>
                            <p className="mt-1"><b>Gancho:</b> {item.hook}</p>
                            <p className="mt-1"><b>Legenda:</b> {item.captionIdea}</p>
                            {item.notes && <p className="mt-1"><b>Obs.:</b> {item.notes}</p>}
                          </details>
                          <div className="mt-2 flex items-center justify-between">
                            {sent.has(index) ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" />no calendário</span> : <span />}
                            <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => createWithAgent(item)}><MessageSquareText className="h-3 w-3" />criar com agente</button>
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
    </AppLayout>
  );
}
