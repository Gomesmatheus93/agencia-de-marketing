import AppLayout from "@/components/AppLayout";
import { TaskError, TaskHistory, TaskProgress, useAgentTask } from "@/components/agents/AgentTask";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bot, CheckCircle2, ExternalLink, Loader2, ScanEye, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

type BrandResult = {
  mode: "estudar" | "conferir";
  summary: string;
  dataSource: "instagram" | "perfil_publico" | "sem_dados";
  confidence: "alta" | "média" | "baixa";
  profile: null | {
    offer: string; tone: string; voiceExamples: string[]; pillars: Array<{ name: string; share: number }>;
    captionPattern: string; ctas: string[]; palette: Array<{ hex: string; role: string }>;
    typography: string; layouts: string; photoStyle: string; logoUsage: string; cadence: string; strategyGaps: string[];
  };
  overallScore: number | null;
  checks: Array<{
    date: string; format: string; hook: string; permalink: string | null; imageUrl: string | null; score: number;
    scores: { estrategia: number; voz: number; visual: number | null; execucao: number };
    onBrand: string[]; offBrand: string[]; fix: string | null;
  }>;
  recommendations: string[];
  assumptions: string[];
};

const SOURCE_LABEL = { instagram: "Instagram conectado", perfil_publico: "Perfil público (só imagens)", sem_dados: "Sem acesso ao Instagram" };

function scoreColor(n: number) {
  return n >= 80 ? "text-emerald-600" : n >= 60 ? "text-amber-600" : "text-destructive";
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-primary">{title}</p>
      <div className="text-sm leading-relaxed">{children}</div>
    </CardContent></Card>
  );
}

export default function Brand() {
  const t = useAgentTask<BrandResult>("marca");
  const ig = trpc.agents.list.useQuery();
  const [postCount, setPostCount] = useState(20);
  const [focus, setFocus] = useState("");
  const r = t.result;
  const run = (mode: "estudar" | "conferir") => t.start({ mode, postCount, focus: focus || undefined });

  return (
    <AppLayout activeModule="brandCheck">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1300px] space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary"><Bot className="mr-1.5 h-3 w-3" />Agente de Marca</Badge>
              <h1 className="text-3xl font-bold tracking-tight">Marca</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">O agente estuda o Instagram da Alle para entender a marca de verdade (o retrato vai para o marca.md, que todos os agentes leem) e confere se os posts seguem o padrão e a estratégia.</p>
            </div>
            <TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} />
          </header>

          <Card><CardContent className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto] md:items-end">
              <label className="space-y-1.5 text-sm"><span className="font-medium">Posts a analisar</span>
                <select value={postCount} onChange={(e) => setPostCount(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-2">
                  {[10, 20, 30, 50].map((n) => <option key={n} value={n}>Últimos {n}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Pedido específico (opcional)</span>
                <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex.: olhe principalmente os carrosséis de oferta" />
              </label>
              <Button variant="outline" className="gap-2" disabled={t.running || t.starting} onClick={() => run("estudar")}>
                {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanEye className="h-4 w-4" />}Estudar a marca
              </Button>
              <Button className="gap-2" disabled={t.running || t.starting} onClick={() => run("conferir")}>
                {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Conferir o padrão
              </Button>
            </div>
            {ig.data && !ig.data.instagram.connected && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                O Instagram não está conectado. O agente vai tentar ver o perfil público (só imagens, costuma ser bloqueado). Para a análise completa, <Link href="/dashboard/settings" className="underline">conecte o Instagram</Link>.
              </p>
            )}
          </CardContent></Card>

          {t.running && <TaskProgress agentName="Agente de Marca" activity={t.activity} startedAt={t.thread?.createdAt} />}
          {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
          {!t.thread && !t.running && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-primary/60" />Comece por <b>Estudar a marca</b>: o retrato que sai dali passa a guiar todos os agentes.
            </div>
          )}

          {r && !t.running && (
            <>
              <Card><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                {r.overallScore != null && (
                  <div className="text-center md:w-40">
                    <p className={cn("text-5xl font-bold", scoreColor(r.overallScore))}>{Math.round(r.overallScore)}</p>
                    <p className="text-xs text-muted-foreground">nota de aderência</p>
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{r.mode === "estudar" ? "Estudo da marca" : "Conferência do padrão"}</Badge>
                    <Badge variant="outline">{SOURCE_LABEL[r.dataSource]}</Badge>
                    <Badge variant="outline" className={r.confidence === "baixa" ? "border-amber-500/40 text-amber-700" : ""}>confiança {r.confidence}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed">{r.summary}</p>
                  {r.mode === "estudar" && r.profile && <p className="text-xs text-muted-foreground">Salvo em <b>marca.md</b> (Agentes → Memória da equipe). Todos os agentes passam a seguir.</p>}
                </div>
              </CardContent></Card>

              {r.profile && (
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Field title="O que vende e para quem">{r.profile.offer}</Field>
                  <Field title="Tom de voz">
                    <p>{r.profile.tone}</p>
                    {r.profile.voiceExamples.map((q) => <p key={q} className="mt-2 border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground">“{q}”</p>)}
                  </Field>
                  <Field title="Pilares">
                    {r.profile.pillars.map((p) => (
                      <div key={p.name} className="mb-1.5">
                        <div className="flex justify-between text-xs"><span>{p.name}</span><span className="text-muted-foreground">{p.share}%</span></div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-gradient-to-r from-alle-purple to-alle-orange" style={{ width: `${Math.min(100, p.share)}%` }} /></div>
                      </div>
                    ))}
                  </Field>
                  <Field title="Legendas e CTAs">
                    <p>{r.profile.captionPattern}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{r.profile.ctas.map((c) => <Badge key={c} variant="outline" className="font-normal">{c}</Badge>)}</div>
                  </Field>
                  <Field title="Paleta usada">
                    <div className="flex flex-wrap gap-2">
                      {r.profile.palette.map((c) => (
                        <div key={c.hex + c.role} className="flex items-center gap-1.5 text-xs">
                          <span className="h-6 w-6 rounded-md border" style={{ backgroundColor: /^#[0-9a-f]{3,8}$/i.test(c.hex) ? c.hex : undefined }} />
                          <span><span className="font-mono">{c.hex}</span><br /><span className="text-muted-foreground">{c.role}</span></span>
                        </div>
                      ))}
                    </div>
                  </Field>
                  <Field title="Tipografia e layouts"><p>{r.profile.typography}</p><p className="mt-1.5 text-muted-foreground">{r.profile.layouts}</p></Field>
                  <Field title="Fotos e logo"><p>{r.profile.photoStyle}</p><p className="mt-1.5 text-muted-foreground">{r.profile.logoUsage}</p></Field>
                  <Field title="Formatos e frequência">{r.profile.cadence}</Field>
                  {r.profile.strategyGaps.length > 0 && (
                    <Field title="Onde o feed diverge da estratégia">
                      <ul className="list-disc space-y-1 pl-4">{r.profile.strategyGaps.map((g) => <li key={g}>{g}</li>)}</ul>
                    </Field>
                  )}
                </section>
              )}

              {r.checks.length > 0 && (
                <section className="space-y-2">
                  {[...r.checks].sort((a, b) => a.score - b.score).map((c, i) => (
                    <Card key={i}><CardContent className="flex gap-4 p-4">
                      {c.imageUrl ? <img src={c.imageUrl} alt="" className="h-24 w-20 shrink-0 rounded-lg border object-cover" loading="lazy" /> : <div className="h-24 w-20 shrink-0 rounded-lg bg-muted" />}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("text-xl font-bold", scoreColor(c.score))}>{Math.round(c.score)}</span>
                          <span className="text-xs text-muted-foreground">{c.date} · {c.format}</span>
                          <span className="text-[11px] text-muted-foreground">estratégia {c.scores.estrategia} · voz {c.scores.voz} · visual {c.scores.visual ?? "—"} · execução {c.scores.execucao}</span>
                          {c.permalink && <a href={c.permalink} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a>}
                        </div>
                        <p className="line-clamp-1 text-sm font-medium">{c.hook}</p>
                        <div className="flex flex-wrap gap-1">
                          {c.onBrand.map((x) => <span key={x} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />{x}</span>)}
                          {c.offBrand.map((x) => <span key={x} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"><XCircle className="h-3 w-3" />{x}</span>)}
                        </div>
                        {c.fix && <p className="text-xs"><b>Como corrigir:</b> {c.fix}</p>}
                      </div>
                    </CardContent></Card>
                  ))}
                </section>
              )}

              {r.recommendations.length > 0 && (
                <Card><CardContent className="p-5">
                  <p className="mb-2 font-semibold">Recomendações</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ul>
                </CardContent></Card>
              )}
              {r.assumptions.length > 0 && (
                <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">O agente assumiu:</p>
                  <ul className="list-disc space-y-0.5 pl-4">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
