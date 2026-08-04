import { useState, useEffect, useRef } from "react";
import type { RadarPrefill } from "@/pages/Radar";
const RADAR_PREFILL_KEY = "radar_prefill";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Film,
  Trash2,
  Wand2,
  ChevronRight,
  Clock,
  Eye,
  Volume2,
  Type,
  Lightbulb,
  Zap,
  Award,
  RotateCcw,
  Hash,
  Video,
} from "lucide-react";

const VIDEOS_SCRIPT_PREFILL_KEY = "videos_script_prefill";
import type { ReelsScript } from "@/../../server/db";

type SceneType = "hook" | "context" | "content" | "reward" | "loop_close" | "cta";

const SCENE_META: Record<SceneType, { label: string; color: string; icon: React.ElementType }> = {
  hook:       { label: "Gancho",     color: "bg-red-500/20 text-red-400 border-red-500/30",    icon: Zap },
  context:    { label: "Contexto",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: ChevronRight },
  content:    { label: "Conteúdo",   color: "bg-violet-500/20 text-violet-400 border-violet-500/30", icon: Eye },
  reward:     { label: "Recompensa", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: Award },
  loop_close: { label: "Loop",       color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: RotateCcw },
  cta:        { label: "CTA",        color: "bg-pink-500/20 text-pink-400 border-pink-500/30",  icon: Film },
};

const TONE_OPTIONS = [
  { value: "educational",  label: "Educativo" },
  { value: "entertaining", label: "Entretenimento" },
  { value: "inspiring",    label: "Inspirador" },
  { value: "informative",  label: "Informativo" },
] as const;

const DURATION_OPTIONS = [
  { value: "short",  label: "Curto (~15s)" },
  { value: "medium", label: "Médio (~30-45s)" },
  { value: "long",   label: "Longo (~60s)" },
] as const;

const DURATION_DISPLAY: Record<string, string> = {
  short: "15-20s",
  medium: "30-45s",
  long: "50-60s",
};

export default function Reels() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<"educational" | "entertaining" | "inspiring" | "informative">("educational");
  const [duration, setDuration] = useState<"short" | "medium" | "long">("medium");
  const [extraContext, setExtraContext] = useState("");
  const [selected, setSelected] = useState<ReelsScript | null>(null);
  const radarPrefillRef = useRef<RadarPrefill | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(RADAR_PREFILL_KEY);
    if (!raw) return;
    try {
      const prefill = JSON.parse(raw) as RadarPrefill;
      sessionStorage.removeItem(RADAR_PREFILL_KEY);
      radarPrefillRef.current = prefill;
      setTopic(prefill.topic);
      toast.info("Pauta do Radar carregada — revise o tema e clique em Gerar.");
    } catch { /* ignore */ }
  }, []);

  const { data: scripts = [], refetch } = trpc.reels.getAll.useQuery();

  const generateMut = trpc.reels.generate.useMutation({
    onSuccess: (script) => {
      toast.success("Roteiro gerado!");
      refetch();
      setSelected(script as unknown as ReelsScript);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.reels.delete.useMutation({
    onSuccess: () => {
      toast.success("Roteiro excluído");
      setSelected(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleGenerate() {
    if (!topic.trim()) { toast.error("Digite o tema do Reel"); return; }
    const prefill = radarPrefillRef.current;
    generateMut.mutate({
      topic: topic.trim(),
      tone,
      duration,
      extraContext: extraContext.trim() || undefined,
      sourceTopicAngleId: prefill?.topicAngleId,
      hookType: prefill?.hookType,
    });
    radarPrefillRef.current = null;
  }

  const [, navigate] = useLocation();
  const displayScript = selected ?? (scripts.length > 0 ? scripts[0] as unknown as ReelsScript : null);

  return (
    <AppLayout activeModule="reels">
      <div className="flex h-full min-h-screen bg-background">
        {/* Left panel */}
        <div className="w-80 min-w-[280px] border-r border-border flex flex-col h-screen sticky top-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Film className="h-5 w-5 text-red-400" />
              <h1 className="font-semibold text-lg">Roteiro Reels</h1>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tema do Reel *</label>
                <Input
                  placeholder="Ex: 3 erros fatais em finanças pessoais"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tom</label>
                  <select
                    className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as typeof tone)}
                  >
                    {TONE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duração</label>
                  <select
                    className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as typeof duration)}
                  >
                    {DURATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contexto adicional (opcional)</label>
                <Textarea
                  placeholder="Nicho, público-alvo, ângulo específico..."
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={generateMut.isPending}
              >
                {generateMut.isPending ? (
                  <>
                    <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando roteiro...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Gerar Roteiro
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Script list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {scripts.length === 0 && !generateMut.isPending && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum roteiro ainda. Gere o primeiro!
              </p>
            )}
            {(scripts as unknown as ReelsScript[]).map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                  displayScript?.id === s.id
                    ? "bg-red-500/10 border border-red-500/30"
                    : "hover:bg-muted border border-transparent"
                )}
              >
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {DURATION_DISPLAY[s.duration] ?? s.duration}
                  <span className="ml-auto">{s.scenes?.length ?? 0} cenas</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto">
          {!displayScript && !generateMut.isPending ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <Film className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-medium">Nenhum roteiro selecionado</p>
              <p className="text-sm">Gere um roteiro para começar</p>
            </div>
          ) : generateMut.isPending ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <Wand2 className="h-12 w-12 mb-4 opacity-50 animate-spin" />
              <p className="font-medium">Gerando roteiro...</p>
              <p className="text-sm">Isso pode levar alguns segundos</p>
            </div>
          ) : displayScript ? (
            <ScriptViewer
              script={displayScript}
              onDelete={() => deleteMut.mutate({ id: displayScript.id })}
              deleting={deleteMut.isPending}
              onCreateVideo={(scriptText) => {
                sessionStorage.setItem(VIDEOS_SCRIPT_PREFILL_KEY, JSON.stringify({ script: scriptText }));
                navigate("/dashboard/videos");
              }}
            />
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}

function ScriptViewer({
  script,
  onDelete,
  deleting,
  onCreateVideo,
}: {
  script: ReelsScript;
  onDelete: () => void;
  deleting: boolean;
  onCreateVideo: (scriptText: string) => void;
}) {
  const [copiedCaption, setCopiedCaption] = useState(false);

  function copyCaption() {
    const text = [script.caption, "", ...script.hashtags.map((h) => `#${h}`)].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{script.title}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{DURATION_DISPLAY[script.duration] ?? script.duration}</span>
            <span>{script.scenes?.length ?? 0} cenas</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const fullScript = [
                script.hook,
                ...(script.scenes ?? []).map((s) => s.audio).filter(Boolean),
                script.loopClose,
              ].join("\n\n");
              onCreateVideo(fullScript);
            }}
          >
            <Video className="h-4 w-4 mr-1.5" />
            Criar Vídeo com Avatar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          icon={Zap}
          label="Gancho"
          value={script.hook}
          colorClass="border-red-500/30 bg-red-500/5"
          iconColor="text-red-400"
        />
        <SummaryCard
          icon={Award}
          label="Recompensa"
          value={script.reward}
          colorClass="border-green-500/30 bg-green-500/5"
          iconColor="text-green-400"
        />
        <SummaryCard
          icon={RotateCcw}
          label="Loop de fechamento"
          value={script.loopClose}
          colorClass="border-orange-500/30 bg-orange-500/5"
          iconColor="text-orange-400"
        />
      </div>

      {/* Scenes */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Roteiro por cena
        </h3>
        <div className="space-y-3">
          {(script.scenes ?? []).map((scene) => {
            const meta = SCENE_META[scene.type as SceneType] ?? SCENE_META.content;
            const Icon = meta.icon;
            return (
              <div
                key={scene.id}
                className="border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs border", meta.color)}>
                    <Icon className="h-3 w-3 mr-1" />
                    {meta.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {scene.duration}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground ml-auto">
                    #{scene.id}
                  </span>
                </div>

                <div className="grid gap-2">
                  <SceneField icon={Eye} label="Visual" value={scene.visual} />
                  <SceneField icon={Volume2} label="Áudio" value={scene.audio} highlight />
                  {scene.caption && (
                    <SceneField icon={Type} label="Overlay" value={scene.caption} />
                  )}
                  {scene.note && (
                    <SceneField icon={Lightbulb} label="Nota" value={scene.note} muted />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caption */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Legenda para o post</h3>
          <Button variant="outline" size="sm" onClick={copyCaption}>
            {copiedCaption ? "Copiado!" : "Copiar legenda"}
          </Button>
        </div>
        <p className="text-sm whitespace-pre-line text-foreground/80">{script.caption}</p>
        {script.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
            {script.hashtags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Hash className="h-2.5 w-2.5 mr-0.5" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  colorClass,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  colorClass: string;
  iconColor: string;
}) {
  return (
    <div className={cn("border rounded-lg p-3 space-y-1.5", colorClass)}>
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", iconColor)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{value}</p>
    </div>
  );
}

function SceneField({
  icon: Icon,
  label,
  value,
  highlight,
  muted,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex items-start gap-1 text-xs text-muted-foreground mt-0.5 w-16 shrink-0">
        <Icon className="h-3 w-3 mt-0.5 shrink-0" />
        <span>{label}</span>
      </div>
      <p
        className={cn(
          "text-sm flex-1",
          highlight && "font-medium",
          muted && "text-muted-foreground italic"
        )}
      >
        {value}
      </p>
    </div>
  );
}