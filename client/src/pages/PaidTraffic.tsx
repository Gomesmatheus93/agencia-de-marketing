import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, CircleDollarSign, Link2, MousePointerClick, Plus, Target, Trash2, TrendingUp, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Status = "active" | "paused" | "finished";
type Platform = "Meta Ads" | "Google Ads" | "TikTok Ads" | "LinkedIn Ads";

type TrafficCampaign = {
  id: string;
  name: string;
  platform: Platform;
  status: Status;
  budget: number;
  spent: number;
  revenue: number;
  leads: number;
  clicks: number;
  startDate: string;
  endDate: string;
  postId?: number;
  objective?: string;
  audience?: string;
};

const STORAGE_KEY = "krythoslab-paid-traffic-v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");

const statusLabel: Record<Status, string> = { active: "Ativa", paused: "Pausada", finished: "Finalizada" };
const statusClass: Record<Status, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  paused: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  finished: "bg-slate-500/15 text-slate-600 border-slate-500/20",
};

const emptyForm = {
  name: "",
  platform: "Meta Ads" as Platform,
  budget: "",
  spent: "",
  revenue: "",
  leads: "",
  clicks: "",
  startDate: "",
  endDate: "",
  postId: "",
  objective: "",
  audience: "",
  hubCampaignId: "",
};

function readCampaigns(): TrafficCampaign[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PaidTraffic() {
  const [campaigns, setCampaigns] = useState<TrafficCampaign[]>(readCampaigns);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [adAccountId, setAdAccountId] = useState("");
  const [hubCampaignId, setHubCampaignId] = useState("");
  const utils = trpc.useUtils();
  const hubCampaignsQuery = trpc.campaignHub.list.useQuery();
  const attachAssetMutation = trpc.campaignHub.attachAsset.useMutation({
    onSuccess: async () => {
      await utils.campaignHub.list.invalidate();
      toast.success("Campanha de mídia vinculada ao hub.");
    },
    onError: (error) => toast.error(error.message),
  });
  const connectionQuery = trpc.paidTraffic.connection.useQuery();
  const postsQuery = trpc.posts.getAll.useQuery({ channel: "instagram" });
  const accountsQuery = trpc.paidTraffic.metaAdAccounts.useQuery(undefined, { enabled: connectionQuery.data?.connected === true, retry: false });
  const metaCampaignsQuery = trpc.paidTraffic.metaCampaigns.useQuery(
    { adAccountId },
    { enabled: /^act_\d+$/.test(adAccountId), retry: false }
  );
  const selectedHubCampaign = (hubCampaignsQuery.data ?? []).find((item) => String(item.id) === hubCampaignId);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns)), [campaigns]);

  const totals = useMemo(() => campaigns.reduce((acc, campaign) => ({
    budget: acc.budget + campaign.budget,
    spent: acc.spent + campaign.spent,
    revenue: acc.revenue + campaign.revenue,
    leads: acc.leads + campaign.leads,
    clicks: acc.clicks + campaign.clicks,
  }), { budget: 0, spent: 0, revenue: 0, leads: 0, clicks: 0 }), [campaigns]);

  const roas = totals.spent > 0 ? totals.revenue / totals.spent : 0;
  const cpl = totals.leads > 0 ? totals.spent / totals.leads : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    const budget = Number(form.budget);
    if (!form.name.trim() || budget <= 0) {
      toast.error("Informe o nome e um orçamento maior que zero.");
      return;
    }
    const campaign: TrafficCampaign = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      platform: form.platform,
      status: "active",
      budget,
      spent: Math.max(0, Number(form.spent) || 0),
      revenue: Math.max(0, Number(form.revenue) || 0),
      leads: Math.max(0, Number(form.leads) || 0),
      clicks: Math.max(0, Number(form.clicks) || 0),
      startDate: form.startDate,
      endDate: form.endDate,
      postId: form.postId ? Number(form.postId) : undefined,
      objective: form.objective.trim() || undefined,
      audience: form.audience.trim() || undefined,
    };
    setCampaigns((current) => [campaign, ...current]);
    if (form.hubCampaignId) {
      attachAssetMutation.mutate({
        campaignId: Number(form.hubCampaignId), assetType: "ad", externalId: campaign.id,
        label: campaign.name, status: "published",
        metadata: { platform: campaign.platform, budget, spent: campaign.spent, revenue: campaign.revenue, postId: campaign.postId },
      });
    }
    setForm(emptyForm);
    setShowForm(false);
    toast.success("Campanha adicionada ao controle de tráfego.");
  }

  function updateStatus(id: string, status: Status) {
    setCampaigns((current) => current.map((campaign) => campaign.id === id ? { ...campaign, status } : campaign));
  }

  return (
    <AppLayout activeModule="paidTraffic">
      <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-6 w-6 text-blue-500" />
              <h1 className="text-2xl font-bold">Tráfego Pago</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Acompanhe investimentos e resultados das campanhas de mídia.</p>
          </div>
          <Button onClick={() => setShowForm((value) => !value)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Nova campanha
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Orçamento", value: money.format(totals.budget), icon: CircleDollarSign },
            { label: "Investido", value: money.format(totals.spent), icon: TrendingUp },
            { label: "Receita", value: money.format(totals.revenue), icon: BarChart3 },
            { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: Target },
            { label: "Custo por lead", value: money.format(cpl), icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs font-medium">{label}</span><Icon className="h-4 w-4" /></div>
                <p className="text-xl font-bold mt-2">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-blue-500/20">
          <CardContent className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${connectionQuery.data?.connected ? "bg-emerald-500" : "bg-amber-500"}`} /><p className="font-semibold">Meta Ads</p></div>
              <p className="text-sm text-muted-foreground mt-1">
                {connectionQuery.data?.connected
                  ? `Conectado${connectionQuery.data.instagramUsername ? ` a @${connectionQuery.data.instagramUsername}` : ""}. Selecione a conta de anúncios.`
                  : "Conecte novamente sua conta Meta para autorizar ads_read e ads_management."}
              </p>
            </div>
            {connectionQuery.data?.connected ? (
              <Select value={adAccountId} onValueChange={setAdAccountId}>
                <SelectTrigger className="w-full lg:w-72"><SelectValue placeholder={accountsQuery.isLoading ? "Carregando contas..." : "Conta de anúncios"} /></SelectTrigger>
                <SelectContent>{(accountsQuery.data ?? []).map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.id}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Button asChild><a href="/api/oauth/instagram/connect?returnTo=paid-traffic">Conectar Meta Ads</a></Button>
            )}
          </CardContent>
        </Card>

        {adAccountId && (
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle className="text-base">Campanhas importadas do Meta Ads</CardTitle><p className="mt-1 text-xs text-muted-foreground">Vincule mídia, conteúdo e resultados em uma campanha central.</p></div>
              <Select value={hubCampaignId} onValueChange={setHubCampaignId}><SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Vincular ao hub..." /></SelectTrigger><SelectContent>{(hubCampaignsQuery.data ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
            </CardHeader>
            <CardContent className="space-y-3">
              {metaCampaignsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando campanhas e métricas...</p>}
              {metaCampaignsQuery.error && <p className="text-sm text-destructive">{metaCampaignsQuery.error.message}</p>}
              {(metaCampaignsQuery.data ?? []).map((raw) => {
                const campaign = raw as { id: string; name: string; effective_status?: string; objective?: string; insights?: { data?: Array<{ spend?: string; impressions?: string; reach?: string; clicks?: string }> } };
                const insight = campaign.insights?.data?.[0];
                const linked = selectedHubCampaign?.assets.some((asset) => asset.assetType === "ad" && asset.externalId === campaign.id);
                return <div key={campaign.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{campaign.name}</p><p className="text-xs text-muted-foreground">{campaign.objective ?? "Sem objetivo informado"} · ID {campaign.id}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{campaign.effective_status ?? "UNKNOWN"}</Badge><Button size="sm" variant="outline" disabled={!hubCampaignId || attachAssetMutation.isPending || linked} onClick={() => attachAssetMutation.mutate({ campaignId: Number(hubCampaignId), assetType: "ad", externalId: campaign.id, label: campaign.name, status: campaign.effective_status === "ACTIVE" ? "published" : "draft", metadata: { platform: "Meta Ads", objective: campaign.objective, adAccountId, spend: Number(insight?.spend ?? 0), impressions: Number(insight?.impressions ?? 0), reach: Number(insight?.reach ?? 0), clicks: Number(insight?.clicks ?? 0) } })}><Link2 className="mr-1.5 h-3.5 w-3.5" />{linked ? "Vinculada" : "Vincular"}</Button></div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3"><Metric label="Investido" value={money.format(Number(insight?.spend ?? 0))} /><Metric label="Impressões" value={number.format(Number(insight?.impressions ?? 0))} /><Metric label="Alcance" value={number.format(Number(insight?.reach ?? 0))} /><Metric label="Cliques" value={number.format(Number(insight?.clicks ?? 0))} /></div></div>;
              })}
              {!metaCampaignsQuery.isLoading && metaCampaignsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma campanha encontrada nessa conta.</p>}
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Cadastrar campanha</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Nome da campanha"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Leads - Agosto" /></Field>
                <Field label="Plataforma"><Select value={form.platform} onValueChange={(value: Platform) => setForm({ ...form, platform: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Meta Ads", "Google Ads", "TikTok Ads", "LinkedIn Ads"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Post promovido"><Select value={form.postId} onValueChange={(value) => setForm({ ...form, postId: value })}><SelectTrigger><SelectValue placeholder="Selecionar post da plataforma" /></SelectTrigger><SelectContent>{(postsQuery.data ?? []).map((post) => <SelectItem key={post.id} value={String(post.id)}>{post.title || post.content.slice(0, 55)}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Objetivo"><Input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Ex: Geração de leads" /></Field>
                <Field label="Público / segmentação"><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Ex: Empresários, 25-45, SP" /></Field>
                <Field label="Campanha central"><Select value={form.hubCampaignId} onValueChange={(value) => setForm({ ...form, hubCampaignId: value })}><SelectTrigger><SelectValue placeholder="Opcional: vincular ao hub" /></SelectTrigger><SelectContent>{(hubCampaignsQuery.data ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Orçamento (R$)"><Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
                <Field label="Valor investido (R$)"><Input type="number" min="0" step="0.01" value={form.spent} onChange={(e) => setForm({ ...form, spent: e.target.value })} /></Field>
                <Field label="Receita atribuída (R$)"><Input type="number" min="0" step="0.01" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} /></Field>
                <Field label="Leads"><Input type="number" min="0" value={form.leads} onChange={(e) => setForm({ ...form, leads: e.target.value })} /></Field>
                <Field label="Cliques"><Input type="number" min="0" value={form.clicks} onChange={(e) => setForm({ ...form, clicks: e.target.value })} /></Field>
                <Field label="Período"><div className="flex gap-2"><Input aria-label="Data inicial" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /><Input aria-label="Data final" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div></Field>
                <div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit">Salvar campanha</Button></div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Campanhas ({campaigns.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground"><MousePointerClick className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium text-foreground">Nenhuma campanha cadastrada</p><p className="text-sm mt-1">Adicione sua primeira campanha para visualizar os indicadores.</p></div>
            ) : campaigns.map((campaign) => {
              const consumption = campaign.budget > 0 ? Math.min(100, campaign.spent / campaign.budget * 100) : 0;
              const campaignRoas = campaign.spent > 0 ? campaign.revenue / campaign.spent : 0;
              return (
                <div key={campaign.id} className="rounded-xl border p-4 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{campaign.name}</p><Badge variant="outline">{campaign.platform}</Badge><Badge className={statusClass[campaign.status]}>{statusLabel[campaign.status]}</Badge></div><p className="text-xs text-muted-foreground mt-1">{campaign.objective || "Sem objetivo"}{campaign.postId ? ` · Post #${campaign.postId}` : " · Sem post vinculado"} · {campaign.startDate || "Sem data inicial"} — {campaign.endDate || "Sem data final"}</p>{campaign.audience && <p className="text-xs text-muted-foreground mt-1">Público: {campaign.audience}</p>}</div>
                    <div className="flex items-center gap-2"><Select value={campaign.status} onValueChange={(value: Status) => updateStatus(campaign.id, value)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativa</SelectItem><SelectItem value="paused">Pausada</SelectItem><SelectItem value="finished">Finalizada</SelectItem></SelectContent></Select><Button variant="ghost" size="icon" aria-label={`Excluir ${campaign.name}`} onClick={() => setCampaigns((current) => current.filter((item) => item.id !== campaign.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5"><Metric label="Investido" value={money.format(campaign.spent)} /><Metric label="Orçamento" value={money.format(campaign.budget)} /><Metric label="Leads" value={number.format(campaign.leads)} /><Metric label="Cliques" value={number.format(campaign.clicks)} /><Metric label="ROAS" value={`${campaignRoas.toFixed(2)}x`} /></div>
                  <div><div className="flex justify-between text-xs text-muted-foreground mb-1.5"><span>Consumo do orçamento</span><span>{consumption.toFixed(0)}%</span></div><Progress value={consumption} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold mt-1">{value}</p></div>;
}
