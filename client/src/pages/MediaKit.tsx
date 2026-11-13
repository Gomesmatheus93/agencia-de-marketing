import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Download, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Mídia kit impresso das academias (display, banner, panfleto, windbanner):
// a equipe edita, gera para revisão, aprova e só então o material vai para o portal das unidades.

// ── Design do mídia kit impresso ───────────────────────────────────────────
const KIT_FIELD_GROUPS: Array<{ title: string; layouts: string[]; fields: Array<[string, string, boolean?]> }> = [
  { title: "Mensagem principal", layouts: ["poster"], fields: [["eyebrow", "Chamada (laranja, acima)"], ["headline1", "Título, linha 1"], ["headline2", "Título, linha 2"], ["headline3", "Título, linha 3"], ["highlight", "Destaque laranja"], ["offer", "Selo da oferta"]] },
  { title: "Como ativar (use | para separar título e complemento)", layouts: ["poster"], fields: [["stepsTitle", "Título dos passos"], ["step1", "Passo 1"], ["step2", "Passo 2"], ["step3", "Passo 3"]] },
  { title: "QR code", layouts: ["poster"], fields: [["qrLabel", "Chamada no quadro"], ["qrSub", "Texto embaixo do QR"]] },
  { title: "Benefícios e ressalva", layouts: ["poster"], fields: [["benefit1", "Benefício 1"], ["benefit2", "Benefício 2"], ["benefit3", "Benefício 3"], ["disclaimer", "Ressalva (obrigatória com o %)", true]] },
  { title: "Bandeira", layouts: ["flag"], fields: [["wbLine1", "Linha 1"], ["wbLine2", "Linha 2 (grande)"]] },
];

function KitDesigner() {
  const formats = trpc.unitKit.formats.useQuery();
  const templates = trpc.unitKit.templates.useQuery();
  const defaults = trpc.unitKit.defaults.useQuery();
  const kitUnits = trpc.unitKit.units.useQuery();
  const utils = trpc.useUtils();
  const [format, setFormat] = useState("display");
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [unitId, setUnitId] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const job = trpc.unitKit.job.useQuery(undefined, { refetchInterval: (q) => (q.state.data && !q.state.data.finishedAt ? 1500 : false) });
  const tpl = templates.data?.find((t) => t.format === format);
  const fields = draft[format] ?? tpl?.fields;
  const fmt = formats.data?.find((f) => f.id === format);
  const dirty = !!draft[format];
  const previewM = trpc.unitKit.preview.useMutation({ onSuccess: (r) => setPreview(r.dataUrl), onError: (e) => toast.error(e.message) });
  const save = trpc.unitKit.save.useMutation({ onSuccess: () => { toast.success("Texto salvo."); setDraft(({ [format]: _x, ...rest }) => rest); utils.unitKit.templates.invalidate(); }, onError: (e) => toast.error(e.message) });
  const exportOne = trpc.unitKit.exportOne.useMutation({ onSuccess: (r) => { toast.success("PDF de conferência gerado (não vai para a academia)."); window.open(r.url, "_blank", "noopener"); }, onError: (e) => toast.error(e.message) });
  const approver = trpc.unitKit.approver.useQuery();
  const canApprove = !!approver.data?.canApprove;
  const approve = trpc.unitKit.approve.useMutation({ onSuccess: (r) => { toast.success(`Aprovado! Enviado ao mídia kit de ${r.sent} academias.`); utils.unitKit.templates.invalidate(); }, onError: (e) => toast.error(e.message) });
  const discard = trpc.unitKit.discard.useMutation({ onSuccess: () => { toast.success("Versão descartada."); utils.unitKit.templates.invalidate(); }, onError: (e) => toast.error(e.message) });
  const genAll = trpc.unitKit.generateAll.useMutation({ onSuccess: () => utils.unitKit.job.invalidate(), onError: (e) => toast.error(e.message) });

  // Prévia automática ao trocar formato, academia ou texto (com uma pausa enquanto digita).
  useEffect(() => {
    if (!fields) return;
    const t = setTimeout(() => previewM.mutate({ format: format as never, fields: fields as never, unitId }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, unitId, JSON.stringify(fields)]);
  useEffect(() => { if (job.data?.finishedAt) { utils.unitKit.templates.invalidate(); utils.unitAdmin.overview.invalidate(); } }, [job.data?.finishedAt, utils]);

  const setField = (k: string, v: string) => fields && setDraft((d) => ({ ...d, [format]: { ...fields, [k]: v } }));
  const running = job.data && !job.data.finishedAt;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(formats.data ?? []).map((f) => {
          const t = templates.data?.find((x) => x.format === f.id);
          return (
            <button key={f.id} type="button" onClick={() => setFormat(f.id)} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition", format === f.id ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40")}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                <span className="block rounded-sm bg-primary/70" style={{ width: 22, height: Math.min(40, 22 * f.ratio) }} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{f.label}</span>
                <span className="block text-xs text-muted-foreground">{String(f.wCm).replace(".", ",")} × {String(f.hCm).replace(".", ",")} cm</span>
                <span className={cn("block text-[11px]", t?.pendingCount ? "font-semibold text-amber-600" : "text-muted-foreground")}>
                  {t?.pendingCount ? `aguardando aprovação (${t.pendingCount})` : t?.sentCount ? `enviado a ${t.sentCount} academias` : "ainda não enviado"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="border-border/60"><CardContent className="space-y-4 p-4">
          {fields && fmt && KIT_FIELD_GROUPS.filter((g) => g.layouts.includes(fmt.layout)).map((g) => (
            <div key={g.title} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.fields.map(([k, label, long]) => (
                  <label key={k} className={cn("space-y-1 text-sm", long && "sm:col-span-2")}>
                    <span className="text-xs text-muted-foreground">{label}</span>
                    {long ? <Textarea rows={3} value={fields[k] ?? ""} onChange={(e) => setField(k, e.target.value)} className="text-sm" />
                      : <Input value={fields[k] ?? ""} onChange={(e) => setField(k, e.target.value)} className="h-9" />}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {fmt?.layout === "flag" && <p className="text-xs text-muted-foreground">O windbanner leva as duas faces da bandeira lado a lado no molde, cada uma com o QR da academia.</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            {defaults.data && <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, [format]: { ...defaults.data } }))}>Voltar ao texto padrão</Button>}
            <Button size="sm" disabled={!dirty || save.isPending} onClick={() => fields && save.mutate({ format: format as never, fields: fields as never })}>{save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar texto</Button>
          </div>
        </CardContent></Card>

        <Card className="border-border/60"><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm font-semibold">Prévia {fmt ? `· ${fmt.label} ${String(fmt.wCm).replace(".", ",")} × ${String(fmt.hCm).replace(".", ",")} cm` : ""}</p>
            <select value={unitId ?? ""} onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : null)} className="h-8 max-w-[220px] rounded-md border bg-background px-2 text-xs">
              <option value="">Sem academia (espaço do QR)</option>
              {(kitUnits.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border bg-muted/40 p-3">
            {preview ? <img src={preview} alt="Prévia" className="max-h-[70vh] w-auto rounded shadow-lg" /> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            {previewM.isPending && preview && <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2 py-0.5 text-[11px] text-muted-foreground shadow"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />atualizando</span>}
          </div>
          {dirty && <p className="text-xs text-amber-600">Salve o texto antes de gerar: a geração usa o texto salvo.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!unitId || dirty || exportOne.isPending} title={!unitId ? "Escolha uma academia na prévia" : undefined}
              onClick={() => unitId && exportOne.mutate({ format: format as never, unitId })}>
              {exportOne.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}PDF de conferência
            </Button>
            <Button size="sm" className="ml-auto" disabled={dirty || !!running || genAll.isPending}
              onClick={() => { if (confirm(`Gerar o ${fmt?.label} de ${kitUnits.data?.length ?? 0} academias para revisão? Nada vai para as academias antes da aprovação.`)) genAll.mutate({ format: format as never }); }}>
              <Sparkles className="mr-1.5 h-4 w-4" />Gerar para aprovação ({kitUnits.data?.length ?? 0} academias)
            </Button>
          </div>
          {job.data && (
            <div className="rounded-xl border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{job.data.label}: {job.data.finishedAt ? (job.data.error ? "erro" : "concluído") : "gerando…"}</span>
                <span className="text-xs text-muted-foreground">{job.data.done} de {job.data.total}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", job.data.error ? "bg-destructive" : "bg-primary")} style={{ width: `${job.data.total ? (job.data.done / job.data.total) * 100 : 0}%` }} /></div>
              {job.data.error && <p className="mt-1 text-xs text-destructive">{job.data.error}</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Cada academia ganha um PDF no tamanho real ({fmt ? `${fmt.px.w} × ${fmt.px.h} px, ${fmt.dpi} dpi` : "…"}) com o QR code dela. Ele só aparece no mídia kit da academia depois da aprovação. Academias sem QR nem link ficam de fora.</p>
        </CardContent></Card>
      </div>

      {tpl && tpl.pendingCount > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/[.04]"><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600"><ShieldCheck className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{fmt?.label}: {canApprove ? "aguardando a sua aprovação" : `aguardando a aprovação de ${approver.data?.email ?? "Matheus"}`}</p>
              <p className="text-sm text-muted-foreground">{tpl.pendingCount} academias com o material gerado{tpl.generatedAt ? ` em ${new Date(tpl.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}. Confira as amostras e abra os PDFs antes de aprovar.{tpl.sentCount ? " Ao aprovar, a versão atual das academias é substituída." : ""}</p>
            </div>
            {canApprove && <>
            <Button variant="ghost" size="sm" disabled={discard.isPending} onClick={() => { if (confirm("Descartar esta versão? As academias continuam com o que já têm.")) discard.mutate({ format: format as never }); }}>Descartar</Button>
            <Button size="sm" disabled={approve.isPending || !!running} onClick={() => { if (confirm(`Aprovar e enviar o ${fmt?.label} para o mídia kit de ${tpl.pendingCount} academias?`)) approve.mutate({ format: format as never }); }}>
              {approve.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Aprovar e enviar às unidades
            </Button>
            </>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {tpl.samples.map((s) => (
              <a key={s.pdfUrl} href={s.pdfUrl} target="_blank" rel="noreferrer" title={`Abrir o PDF de ${s.unitName}`} className="group overflow-hidden rounded-lg border bg-card transition hover:border-primary">
                {s.previewUrl && <img src={s.previewUrl} alt="" loading="lazy" className="w-full object-cover" />}
                <p className="truncate p-1.5 text-[11px] font-medium group-hover:text-primary">{s.unitName}</p>
              </a>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

export default function MediaKit() {
  const { user } = useAuth();
  if (user && user.role !== "admin") return <AppLayout activeModule="midiakit"><p className="p-8 text-sm text-muted-foreground">Apenas administradores.</p></AppLayout>;
  return (
    <AppLayout activeModule="midiakit">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-5">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Mídia kit das academias</h1>
            <p className="text-sm text-muted-foreground">Display, banner, panfleto e windbanner com o QR code de cada academia. Edite e gere para revisão. O envio ao mídia kit das unidades só acontece depois da aprovação do Matheus.</p>
          </header>
          <KitDesigner />
        </div>
      </main>
    </AppLayout>
  );
}
