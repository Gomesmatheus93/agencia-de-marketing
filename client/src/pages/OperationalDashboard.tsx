import AppLayout from "@/components/AppLayout";
import UpgradeModal from "@/components/UpgradeModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePlan } from "@/_core/hooks/usePlan";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Bot, Building2, CalendarRange, ClipboardCheck, Clock3, Crown, GalleryHorizontal, Image, Layers, Lock,
  Megaphone, Send, Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

type Recent = { threadId: number; title: string; status: string; createdAt: string | Date; summary: string | null; images: string[] } | null;

function when(date: string | Date) {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Um passo do fluxo da agência, com o último resultado do agente responsável. */
function Step({ n, title, icon: Icon, href, cta, recent, empty, children }: {
  n: number; title: string; icon: React.ComponentType<{ className?: string }>; href: string; cta: string;
  recent?: Recent; empty: string; children?: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col border-border/60">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{n}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="font-semibold">{title}</p>
        </div>
        <div className="flex-1 text-sm">
          {children ?? (recent ? (
            <div className="space-y-2">
              <p className="line-clamp-1 font-medium">{recent.title}</p>
              {recent.status === "running" ? <Badge variant="outline" className="border-primary/30 text-primary">trabalhando…</Badge>
                : recent.status === "failed" ? <Badge variant="outline" className="border-amber-500/40 text-amber-700">parou com erro</Badge>
                : recent.summary && <p className="line-clamp-3 text-muted-foreground">{recent.summary}</p>}
              {recent.images.length > 0 && (
                <div className="flex gap-1.5">{recent.images.map((src) => <img key={src} src={src} alt="" className="h-16 w-12 rounded-md border object-cover" loading="lazy" />)}</div>
              )}
              <p className="text-xs text-muted-foreground">{when(recent.createdAt)}</p>
            </div>
          ) : <p className="text-muted-foreground">{empty}</p>)}
        </div>
        <Button variant="outline" size="sm" asChild className="justify-between"><Link href={href}>{cta}<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
      </CardContent>
    </Card>
  );
}

export default function OperationalDashboard() {
  const { user } = useAuth();
  const { isExpired, isTrialActive, isLegacy, isPaid, daysLeft } = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const office = trpc.agents.office.useQuery(undefined, { refetchInterval: 5000 });
  const recent = trpc.agents.recent.useQuery();
  const agents = trpc.agents.list.useQuery();
  const postStats = trpc.posts.getStats.useQuery();
  const campaigns = trpc.campaignHub.list.useQuery();

  const firstName = user?.name?.split(" ")[0] || "Usuário";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const working = (office.data ?? []).filter((a) => a.state === "tool" || a.state === "thinking");
  const waiting = (office.data ?? []).filter((a) => a.state === "waiting_approval");
  const nameOf = (slug: string) => agents.data?.agents.find((a) => a.slug === slug)?.name ?? slug;
  const r = recent.data ?? {};
  const latestCreation = [r.carrossel, r.stories, r.legendas].filter(Boolean).sort((a, b) => +new Date(b!.createdAt) - +new Date(a!.createdAt))[0];
  const activeCampaigns = (campaigns.data ?? []).filter((c) => !["archived", "completed"].includes(c.status));

  return (
    <AppLayout activeModule="dashboard">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{greeting}, <span className="bg-gradient-to-r from-alle-purple to-alle-orange bg-clip-text text-transparent">{firstName}</span></h1>
              <p className="mt-1 text-sm text-muted-foreground">A agência da Alle Energia: planejar, criar, publicar e medir, com os agentes fazendo o trabalho pesado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild><Link href="/escritorio"><Building2 className="mr-2 h-4 w-4" />Ver escritório</Link></Button>
              <Button asChild><Link href="/dashboard/planejamento"><CalendarRange className="mr-2 h-4 w-4" />Planejar a semana</Link></Button>
            </div>
          </header>

          {!isPaid && !isLegacy && (isExpired || isTrialActive) && (
            <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center", isExpired ? "border-destructive/25 bg-destructive/[.07]" : "border-amber-500/25 bg-amber-500/[.07]")}>
              <div className="flex flex-1 items-center gap-3">{isExpired ? <Lock className="h-5 w-5 text-destructive" /> : <Clock3 className="h-5 w-5 text-amber-500" />}
                <p className="text-sm font-semibold">{isExpired ? "Seu período de teste terminou" : `Teste gratuito · ${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"}`}</p></div>
              <Button size="sm" onClick={() => setUpgradeOpen(true)}><Crown className="mr-1.5 h-3.5 w-3.5" />{isExpired ? "Ver planos" : "Fazer upgrade"}</Button>
            </div>
          )}
          <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} expired={isExpired} />

          <Card className="border-primary/20 bg-gradient-to-r from-primary/[.06] to-alle-orange/[.05]">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-alle-purple to-alle-orange text-white"><Bot className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">
                    {working.length ? `${working.length} agente${working.length > 1 ? "s" : ""} trabalhando agora` : "Nenhum agente trabalhando agora"}
                    {waiting.length > 0 && <span className="text-alle-orange"> · {waiting.length} aguardando sua aprovação</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {working.length ? working.map((a) => nameOf(a.agentSlug)).join(", ") : "Mande uma tarefa pelo menu Criar ou converse com um agente."}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild><Link href="/dashboard/agents">Ver equipe<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
            </CardContent>
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fluxo da semana</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Step n={1} title="Planejar" icon={CalendarRange} href="/dashboard/planejamento" cta="Abrir planejamento" recent={r.planejamento} empty="Nenhum plano ainda. Gere o plano da semana ou do mês." />
              <Step n={2} title="Criar" icon={Sparkles} href="/dashboard/criar/carrossel" cta="Criar com agente" recent={latestCreation} empty="Nenhuma peça criada ainda." />
              <Step n={3} title="Publicar" icon={Send} href="/dashboard/posts" cta="Abrir postagens" empty="">
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{postStats.data?.count ?? 0}</p>
                  <p className="text-muted-foreground">postagens na plataforma</p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <Link href="/dashboard/criar/carrossel" className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent"><GalleryHorizontal className="h-3 w-3" />Carrossel</Link>
                    <Link href="/dashboard/criar/post" className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent"><Image className="h-3 w-3" />Post</Link>
                    <Link href="/dashboard/criar/stories" className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent"><Layers className="h-3 w-3" />Stories</Link>
                  </div>
                </div>
              </Step>
              <Step n={4} title="Medir" icon={ClipboardCheck} href="/dashboard/auditoria" cta="Abrir auditoria" recent={r.auditoria} empty="Nenhuma auditoria ainda. Ela ensina a voz da Alle aos outros agentes." />
            </div>
          </section>

          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold"><Megaphone className="h-4 w-4 text-muted-foreground" />Campanhas em andamento</p>
                <Button variant="ghost" size="sm" asChild><Link href="/dashboard/campaign">Ver todas<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
              </div>
              {activeCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma campanha ativa. Use campanhas para agrupar plano, peças e resultados de uma ação (ex.: lançamento, sazonal, collab).</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {activeCampaigns.slice(0, 6).map((c) => (
                    <Link key={c.id} href="/dashboard/campaign" className="rounded-xl border p-3 text-sm transition hover:border-primary/30 hover:bg-accent/40">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.objective || "Objetivo a definir"} · {c.assets.length} peças</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
  );
}
