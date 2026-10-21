import AppLayout from "@/components/AppLayout";
import { TaskError, TaskHistory, TaskProgress, useAgentTask } from "@/components/agents/AgentTask";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Ban, Bot, ClipboardCheck, ExternalLink, Loader2, Rocket, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type AuditPost = {
  date: string; format: "reel" | "carrossel" | "imagem" | "outro"; theme: string; hook: string;
  likes: number; comments: number; reach: number | null; saves: number | null; shares: number | null;
  engagement: number; outlierMultiple: number; permalink: string | null; imageUrl: string | null;
};
type Audit = {
  summary: string; period: string; dataSource: "instagram" | "colado" | "sem_dados"; medianEngagement: number;
  posts: AuditPost[]; findings: Array<{ title: string; evidence: string; confidence: "alta" | "média" | "baixa" }>;
  stop: string[]; doMore: string[]; assumptions: string[];
};

const FORMAT_LABEL: Record<AuditPost["format"], string> = { reel: "Reel", carrossel: "Carrossel", imagem: "Imagem", outro: "Outro" };
const CONFIDENCE_STYLE = {
  alta: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  média: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};
const nf = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"));

export default function AuditPage() {
  const t = useAgentTask<Audit>("auditoria");
  const ig = trpc.agents.list.useQuery();
  const [postCount, setPostCount] = useState(30);
  const [focus, setFocus] = useState("");
  const [pasted, setPasted] = useState("");
  const audit = t.result;

  const byFormat = useMemo(() => {
    if (!audit) return [];
    const groups = new Map<string, number[]>();
    for (const p of audit.posts) groups.set(FORMAT_LABEL[p.format], [...(groups.get(FORMAT_LABEL[p.format]) ?? []), p.outlierMultiple]);
    return [...groups].map(([format, values]) => ({
      format,
      media: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      posts: values.length,
    })).sort((a, b) => b.media - a.media);
  }, [audit]);
  const ranked = useMemo(() => [...(audit?.posts ?? [])].sort((a, b) => b.outlierMultiple - a.outlierMultiple), [audit]);

  const connected = ig.data?.instagram.connected;

  return (
    <AppLayout activeModule="audit">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary"><Bot className="mr-1.5 h-3 w-3" />Agente de Auditoria</Badge>
              <h1 className="text-3xl font-bold tracking-tight">Auditoria do Instagram</h1>
              <p className="mt-1 text-sm text-muted-foreground">O agente lê os posts publicados, compara cada um com a mediana da própria conta e diz o que funciona, o que parar e o que fazer mais. Também atualiza a voz da marca na memória da equipe.</p>
            </div>
            <TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} />
          </header>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
                <label className="space-y-1.5 text-sm"><span className="font-medium">Posts a analisar</span>
                  <select value={postCount} onChange={(e) => setPostCount(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-2">
                    {[15, 30, 50, 100].map((n) => <option key={n} value={n}>Últimos {n}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm"><span className="font-medium">Foco (opcional)</span>
                  <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex.: por que os reels caíram em setembro?" />
                </label>
                <Button className="gap-2" disabled={t.running || t.starting} onClick={() => t.start({ postCount, focus: focus || undefined, pastedData: pasted || undefined })}>
                  {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Rodar auditoria
                </Button>
              </div>
              {connected === false && (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <p>O Instagram não está conectado. <Link href="/dashboard/settings" className="underline">Conecte em Configurações</Link> ou cole abaixo os posts com legenda e métricas (pode ser copiado de uma planilha).</p>
                  <Textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="data · formato · curtidas · comentários · salvamentos · legenda…" />
                </div>
              )}
            </CardContent>
          </Card>

          {t.running && <TaskProgress agentName="Agente de Auditoria" activity={t.activity} startedAt={t.thread?.createdAt} />}
          {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
          {!t.thread && !t.running && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-primary/60" />Nenhuma auditoria ainda. Clique em Rodar auditoria.
            </div>
          )}

          {audit && !t.running && (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Posts analisados", value: nf(audit.posts.length) },
                  { label: "Período", value: audit.period },
                  { label: "Mediana de engajamento", value: nf(audit.medianEngagement) },
                  { label: "Melhor formato", value: byFormat[0] ? `${byFormat[0].format} · ${byFormat[0].media}x` : "—" },
                ].map((k) => (
                  <Card key={k.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k.label}</p><p className="mt-1 text-xl font-bold">{k.value}</p></CardContent></Card>
                ))}
              </section>

              <Card><CardContent className="p-5 text-sm leading-relaxed">{audit.summary}</CardContent></Card>

              {audit.findings.length > 0 && (
                <section className="grid gap-3 md:grid-cols-2">
                  {audit.findings.map((f, i) => (
                    <Card key={i}><CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3"><p className="font-semibold">{f.title}</p><Badge variant="outline" className={cn("shrink-0", CONFIDENCE_STYLE[f.confidence])}>confiança {f.confidence}</Badge></div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{f.evidence}</p>
                    </CardContent></Card>
                  ))}
                </section>
              )}

              <section className="grid gap-4 lg:grid-cols-3">
                <Card className="border-destructive/20"><CardContent className="p-5">
                  <p className="mb-2 flex items-center gap-2 font-semibold"><Ban className="h-4 w-4 text-destructive" />Pare de fazer</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{audit.stop.map((s) => <li key={s}>{s}</li>)}</ul>
                </CardContent></Card>
                <Card className="border-emerald-500/20"><CardContent className="p-5">
                  <p className="mb-2 flex items-center gap-2 font-semibold"><Rocket className="h-4 w-4 text-emerald-600" />Faça mais</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{audit.doMore.map((s) => <li key={s}>{s}</li>)}</ul>
                </CardContent></Card>
                <Card><CardContent className="p-5">
                  <p className="mb-2 text-sm font-semibold">Desempenho médio por formato (× mediana)</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byFormat}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="format" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={28} />
                        <Tooltip formatter={(v) => [`${v}x`, "média"]} />
                        <Bar dataKey="media" radius={[6, 6, 0, 0]}>
                          {byFormat.map((f, i) => <Cell key={f.format} fill={i === 0 ? "#ff7300" : "#7c00ae"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent></Card>
              </section>

              {ranked.length > 0 && (
                <Card><CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr>{["", "Data", "Formato", "Tema / gancho", "Curtidas", "Coment.", "Salv.", "Compart.", "× mediana", ""].map((h, i) => <th key={i} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {ranked.map((p, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2">{p.imageUrl ? <img src={p.imageUrl} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" /> : <div className="h-10 w-10 rounded bg-muted" />}</td>
                          <td className="whitespace-nowrap px-3 py-2">{p.date.split("-").reverse().join("/")}</td>
                          <td className="px-3 py-2">{FORMAT_LABEL[p.format]}</td>
                          <td className="max-w-md px-3 py-2"><p className="font-medium">{p.theme}</p><p className="line-clamp-1 text-xs text-muted-foreground">{p.hook}</p></td>
                          <td className="px-3 py-2">{nf(p.likes)}</td>
                          <td className="px-3 py-2">{nf(p.comments)}</td>
                          <td className="px-3 py-2">{nf(p.saves)}</td>
                          <td className="px-3 py-2">{nf(p.shares)}</td>
                          <td className={cn("px-3 py-2 font-mono font-semibold", p.outlierMultiple >= 2 ? "text-emerald-600" : p.outlierMultiple < 0.7 ? "text-destructive" : "")}>{p.outlierMultiple.toFixed(1)}x</td>
                          <td className="px-3 py-2">{p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent></Card>
              )}

              {audit.assumptions.length > 0 && (
                <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">O agente assumiu:</p>
                  <ul className="list-disc space-y-0.5 pl-4">{audit.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
