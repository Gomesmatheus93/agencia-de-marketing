import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowRight, BarChart3, CalendarDays, CheckCircle2, CircleDollarSign,
  Clock3, FileText, Layers3, Megaphone, MoreHorizontal, Plus, Rocket,
  Sparkles, Target, Trash2, Users, Wand2, Lightbulb,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const CHANNELS = [
  ["instagram", "Instagram"], ["facebook", "Facebook"], ["linkedin", "LinkedIn"],
  ["email", "E-mail"], ["blog", "Blog"], ["whatsapp", "WhatsApp"],
  ["meta_ads", "Meta Ads"], ["google_ads", "Google Ads"],
] as const;

const STATUS = {
  draft: { label: "Rascunho", color: "bg-slate-500", progress: 8 },
  planning: { label: "Planejamento", color: "bg-blue-500", progress: 20 },
  production: { label: "Em produção", color: "bg-violet-500", progress: 45 },
  approval: { label: "Em aprovação", color: "bg-amber-500", progress: 65 },
  active: { label: "Em veiculação", color: "bg-emerald-500", progress: 82 },
  completed: { label: "Concluída", color: "bg-teal-500", progress: 100 },
  archived: { label: "Arquivada", color: "bg-zinc-500", progress: 100 },
} as const;

type CampaignStatus = keyof typeof STATUS;

const emptyForm = {
  name: "", clientName: "", objective: "", audience: "", offer: "",
  description: "", channels: ["instagram"] as string[], budget: "", startDate: "", endDate: "",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function CampaignHub() {
  const utils = trpc.useUtils();
  const campaignsQuery = trpc.campaignHub.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createMutation = trpc.campaignHub.create.useMutation({
    onSuccess: async (campaign) => {
      await utils.campaignHub.list.invalidate();
      setCreateOpen(false);
      setForm(emptyForm);
      setSelectedId(campaign?.id ?? null);
      toast.success("Campanha criada. Agora organize os ativos e a execução.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = trpc.campaignHub.update.useMutation({
    onSuccess: () => utils.campaignHub.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.campaignHub.delete.useMutation({
    onSuccess: async () => { setSelectedId(null); await utils.campaignHub.list.invalidate(); toast.success("Campanha removida."); },
    onError: (error) => toast.error(error.message),
  });

  const campaigns = campaignsQuery.data ?? [];
  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const totals = useMemo(() => campaigns.reduce((acc, campaign) => ({
    budget: acc.budget + campaign.budgetCents,
    spent: acc.spent + campaign.spentCents,
    revenue: acc.revenue + campaign.revenueCents,
    active: acc.active + (campaign.status === "active" ? 1 : 0),
    approvals: acc.approvals + (campaign.status === "approval" ? 1 : 0),
  }), { budget: 0, spent: 0, revenue: 0, active: 0, approvals: 0 }), [campaigns]);
  const roas = totals.spent > 0 ? totals.revenue / totals.spent : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({
      name: form.name,
      clientName: form.clientName || undefined,
      objective: form.objective || undefined,
      audience: form.audience || undefined,
      offer: form.offer || undefined,
      description: form.description || undefined,
      channels: form.channels as Array<"instagram" | "facebook" | "linkedin" | "email" | "google_ads" | "meta_ads" | "blog" | "whatsapp">,
      budgetCents: Math.round((Number(form.budget) || 0) * 100),
      startDate: form.startDate ? new Date(`${form.startDate}T12:00:00`).toISOString() : undefined,
      endDate: form.endDate ? new Date(`${form.endDate}T12:00:00`).toISOString() : undefined,
    });
  }

  return (
    <AppLayout activeModule="campaign">
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/.08),transparent_32%),radial-gradient(circle_at_top_right,hsl(220_90%_60%/.08),transparent_28%)] p-4 md:p-8">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className="mb-3 gap-1.5 border-primary/20 bg-primary/5 text-primary"><Sparkles className="h-3 w-3" />Central de operação</Badge>
              <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Planeje, produza, aprove, distribua e acompanhe resultados sem perder o contexto entre ferramentas.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild><Link href="/dashboard/campaign/create"><Wand2 className="mr-2 h-4 w-4" />Gerar campanha com IA</Link></Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild><Button className="shadow-lg shadow-primary/20"><Plus className="mr-2 h-4 w-4" />Nova campanha</Button></DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                  <DialogHeader><DialogTitle>Nova campanha</DialogTitle><DialogDescription>Comece pelo resultado de negócio. Os ativos serão organizados dentro desta campanha.</DialogDescription></DialogHeader>
                  <form onSubmit={submit} className="grid gap-4 pt-2 md:grid-cols-2">
                    <Field label="Nome da campanha *"><Input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Lançamento Primavera 2026" /></Field>
                    <Field label="Cliente / marca"><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Ex: Clínica Vital" /></Field>
                    <Field label="Objetivo"><Input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Ex: Gerar 80 leads qualificados" /></Field>
                    <Field label="Orçamento de mídia"><Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="R$ 0,00" /></Field>
                    <Field label="Público"><Textarea value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Quem queremos alcançar?" rows={3} /></Field>
                    <Field label="Oferta"><Textarea value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="Proposta, condição e CTA principal" rows={3} /></Field>
                    <div className="md:col-span-2"><Field label="Canais"><div className="flex flex-wrap gap-2">{CHANNELS.map(([value, label]) => { const active = form.channels.includes(value); return <button key={value} type="button" onClick={() => setForm({ ...form, channels: active ? form.channels.filter((item) => item !== value) : [...form.channels, value] })} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40")}>{label}</button>; })}</div></Field></div>
                    <Field label="Início"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
                    <Field label="Fim"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
                    <div className="md:col-span-2"><Field label="Contexto adicional"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mensagem central, restrições, diferenciais e observações" rows={3} /></Field></div>
                    <div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={createMutation.isPending || form.channels.length === 0}>{createMutation.isPending ? "Criando..." : "Criar campanha"}</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi icon={Rocket} label="Em veiculação" value={String(totals.active)} helper={`${campaigns.length} campanhas no total`} />
            <Kpi icon={CircleDollarSign} label="Orçamento" value={brl.format(totals.budget / 100)} helper="Planejado no período" />
            <Kpi icon={BarChart3} label="Investido" value={brl.format(totals.spent / 100)} helper="Dados registrados" />
            <Kpi icon={Target} label="ROAS consolidado" value={`${roas.toFixed(2)}x`} helper={brl.format(totals.revenue / 100) + " em receita"} />
            <Kpi icon={Clock3} label="Aguardando aprovação" value={String(totals.approvals)} helper="Itens que precisam de ação" />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <Card className="border-border/60 bg-card/80 backdrop-blur">
              <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-lg">Visão geral</CardTitle><p className="mt-1 text-xs text-muted-foreground">Clique em uma campanha para abrir o espaço de trabalho.</p></div><Badge variant="secondary">{campaigns.length}</Badge></CardHeader>
              <CardContent>
                {campaignsQuery.isLoading ? <div className="py-16 text-center text-sm text-muted-foreground">Carregando campanhas...</div> : campaigns.length === 0 ? <EmptyState onCreate={() => setCreateOpen(true)} /> : (
                  <div className="space-y-3">{campaigns.map((campaign) => {
                    const status = STATUS[campaign.status as CampaignStatus] ?? STATUS.draft;
                    const spentPercent = campaign.budgetCents > 0 ? Math.min(100, campaign.spentCents / campaign.budgetCents * 100) : 0;
                    return <button key={campaign.id} onClick={() => setSelectedId(campaign.id)} className={cn("w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md", selectedId === campaign.id ? "border-primary/40 bg-primary/[.035]" : "border-border/60 bg-background/60")}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", status.color)}><Megaphone className="h-5 w-5" /></div>
                        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{campaign.name}</h3><Badge variant="outline" className="text-[10px]"><span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", status.color)} />{status.label}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{campaign.clientName || "Marca não informada"} · {campaign.objective || "Defina o objetivo da campanha"}</p><div className="mt-2 flex flex-wrap gap-1">{campaign.channels.slice(0, 4).map((channel) => <span key={channel} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{CHANNELS.find(([value]) => value === channel)?.[1] ?? channel}</span>)}</div></div>
                        <div className="w-full md:w-36"><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Execução</span><span>{status.progress}%</span></div><Progress value={status.progress} className="h-1.5" /><p className="mt-2 text-right text-xs font-medium">{campaign.assets.length} ativos</p></div>
                        <div className="w-full md:w-32"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mídia</p><p className="mt-1 text-sm font-semibold">{brl.format(campaign.spentCents / 100)}</p>{campaign.budgetCents > 0 && <p className="text-[10px] text-muted-foreground">{spentPercent.toFixed(0)}% do orçamento</p>}</div>
                        <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                      </div>
                    </button>;
                  })}</div>
                )}
              </CardContent>
            </Card>

            <CampaignWorkspace campaign={selected} onStatus={(status) => selected && updateMutation.mutate({ id: selected.id, status })} onDelete={() => selected && confirm(`Excluir a campanha “${selected.name}”?`) && deleteMutation.mutate({ id: selected.id })} />
          </div>
        </div>
      </main>
    </AppLayout>
  );
}

function CampaignWorkspace({ campaign, onStatus, onDelete }: { campaign: any; onStatus: (status: CampaignStatus) => void; onDelete: () => void }) {
  if (!campaign) return <Card className="border-dashed bg-card/50"><CardContent className="flex min-h-[440px] flex-col items-center justify-center p-8 text-center"><Layers3 className="mb-4 h-10 w-10 text-muted-foreground/40" /><h2 className="font-semibold">Espaço de trabalho</h2><p className="mt-2 max-w-xs text-sm text-muted-foreground">Selecione uma campanha para ver briefing, ativos, andamento e próximos passos.</p></CardContent></Card>;
  const status = STATUS[campaign.status as CampaignStatus] ?? STATUS.draft;
  const recommendations = getRecommendations(campaign);
  return <Card className="sticky top-6 h-fit border-primary/10 bg-card/90 backdrop-blur"><CardHeader><div className="flex items-start justify-between gap-3"><div><Badge className={cn("mb-3 border-0 text-white", status.color)}>{status.label}</Badge><CardTitle className="text-xl">{campaign.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{campaign.clientName || "Sem cliente informado"}</p></div><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></div></CardHeader><CardContent className="space-y-5">
    <div className="rounded-xl border bg-muted/20 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objetivo</p><p className="mt-2 text-sm leading-relaxed">{campaign.objective || "Defina um objetivo mensurável para orientar a produção."}</p></div>
    <div className="grid grid-cols-2 gap-2"><MiniStat icon={FileText} label="Ativos" value={String(campaign.assets.length)} /><MiniStat icon={CircleDollarSign} label="Orçamento" value={brl.format(campaign.budgetCents / 100)} /></div>
    <div><Label className="text-xs">Etapa atual</Label><Select value={campaign.status} onValueChange={(value: CampaignStatus) => onStatus(value)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS).filter(([key]) => key !== "archived").map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    <div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold">Ativos da campanha</p><Badge variant="secondary">{campaign.assets.length}</Badge></div>{campaign.assets.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">Nenhum conteúdo vinculado ainda.</div> : <div className="space-y-2">{campaign.assets.slice(0, 5).map((asset: any) => <div key={asset.id} className="flex items-center gap-2 rounded-lg border p-2.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{asset.label || asset.assetType}</p><p className="text-[10px] text-muted-foreground">{asset.assetType} · {asset.status}</p></div></div>)}</div>}</div>
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[.06] p-4"><div className="mb-2 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /><p className="text-xs font-semibold">Próximos passos recomendados</p></div><ul className="space-y-1.5">{recommendations.map((item) => <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />{item}</li>)}</ul></div>
    <div className="grid gap-2"><Button asChild><Link href={`/dashboard/campaign/create?campaignId=${campaign.id}`}><Sparkles className="mr-2 h-4 w-4" />Criar conteúdo com IA</Link></Button><Button variant="outline" asChild><Link href="/dashboard/calendar"><CalendarDays className="mr-2 h-4 w-4" />Ver no calendário</Link></Button><Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Excluir campanha</Button></div>
  </CardContent></Card>;
}

function getRecommendations(campaign: any): string[] {
  const items: string[] = [];
  if (!campaign.objective) items.push("Defina um objetivo mensurável, como leads, vendas ou alcance.");
  if (!campaign.audience) items.push("Detalhe o público para melhorar conteúdo e segmentação de mídia.");
  if (!campaign.offer) items.push("Registre a oferta e o CTA principal da campanha.");
  if (campaign.assets.length === 0) items.push("Gere o primeiro conteúdo e vincule-o a esta campanha.");
  if (campaign.channels.some((channel: string) => channel.includes("ads")) && !campaign.assets.some((asset: any) => asset.assetType === "ad")) items.push("Importe ou vincule uma campanha de tráfego pago.");
  if (campaign.status === "production" && !campaign.assets.some((asset: any) => asset.status === "pending_approval" || asset.status === "approved")) items.push("Envie os ativos prontos para aprovação antes de publicar.");
  if (campaign.spentCents > 0 && campaign.revenueCents === 0) items.push("Registre receita ou conversões para acompanhar o retorno da mídia.");
  return items.slice(0, 3).length ? items.slice(0, 3) : ["Acompanhe os resultados e atualize investimento, receita e aprendizados."];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Kpi({ icon: Icon, label, value, helper }: { icon: any; label: string; value: string; helper: string }) { return <Card className="border-border/50 bg-card/75"><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{helper}</p></CardContent></Card>; }
function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="rounded-xl border p-3"><Icon className="h-4 w-4 text-primary" /><p className="mt-2 text-[10px] text-muted-foreground">{label}</p><p className="text-sm font-semibold">{value}</p></div>; }
function EmptyState({ onCreate }: { onCreate: () => void }) { return <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"><Megaphone className="h-7 w-7 text-primary" /></div><h2 className="text-lg font-semibold">Sua operação começa por uma campanha</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Centralize objetivo, público, conteúdos, aprovações, mídia e resultados para não perder contexto entre módulos.</p><Button className="mt-5" onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Criar primeira campanha</Button></div>; }
