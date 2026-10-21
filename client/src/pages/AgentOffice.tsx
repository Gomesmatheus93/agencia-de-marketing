import { trpc } from "@/lib/trpc";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { TOOL_LABELS } from "@/lib/agentLabels";

type State = "idle" | "thinking" | "tool" | "waiting_approval" | "failed";

// Paleta dos bonequinhos: laranjas e roxos da Alle.
const BOT_COLORS = ["#ff7300", "#a23fd6", "#ff9a3c", "#7c00ae", "#e8590c", "#c084fc"];

// Bonequinho em pixel art (12 × 8). X = corpo, E = olho.
const BOT_PIXELS = [
  "...XX..XX...",
  "..XXXXXXXX..",
  ".XXXXXXXXXX.",
  ".XXEXXXXEXX.",
  "XXXXXXXXXXXX",
  ".XXXXXXXXXX.",
  ".XXXXXXXXXX.",
  ".X.X....X.X.",
];

function PixelBot({ color, x, y, size, lookLeft }: { color: string; x: number; y: number; size: number; lookLeft: boolean }) {
  const rects: React.ReactNode[] = [];
  BOT_PIXELS.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      const eye = ch === "E";
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={x + (c - (eye && lookLeft ? 0.5 : 0)) * size}
          y={y + r * size}
          width={size}
          height={eye ? size * 1.4 : size}
          fill={eye ? "#1a1033" : color}
        />
      );
    })
  );
  return <g>{rects}</g>;
}

export function Workstation({ state, color }: { state: State; color: string }) {
  const working = state === "tool" || state === "thinking";
  const clipId = useId();
  const screen = { idle: "#111827", thinking: "#1e1b4b", tool: "#0f172a", waiting_approval: "#7c2d12", failed: "#7f1d1d" }[state];
  return (
    <svg viewBox="0 0 96 72" className="w-full" shapeRendering="crispEdges" aria-hidden>
      {/* monitor */}
      <rect x="8" y="18" width="38" height="28" fill="#1f2937" />
      <rect x="10" y="20" width="34" height="23" fill={screen} />
      <clipPath id={clipId}><rect x="10" y="20" width="34" height="23" /></clipPath>
      {state === "tool" && (
        <g clipPath={`url(#${clipId})`}>
          <g className="office-code">
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x={12 + (i % 3) * 3} y={22 + i * 4} width={8 + ((i * 7) % 16)} height="2" fill={i % 4 === 0 ? "#ff9a3c" : i % 3 === 0 ? "#c084fc" : "#86efac"} />
            ))}
          </g>
        </g>
      )}
      {state === "thinking" && [0, 1, 2].map((i) => <rect key={i} className="office-dot" style={{ animationDelay: `${i * 0.25}s` }} x={19 + i * 7} y="30" width="3" height="3" fill="#c4b5fd" />)}
      {state === "waiting_approval" && <><rect x="25" y="24" width="4" height="10" fill="#fdba74" /><rect x="25" y="36" width="4" height="4" fill="#fdba74" /></>}
      {state === "failed" && [0, 1, 2, 3, 4].flatMap((k) => [<rect key={`a${k}`} x={20 + k * 3} y={24 + k * 3} width="3" height="3" fill="#fca5a5" />, <rect key={`b${k}`} x={32 - k * 3} y={24 + k * 3} width="3" height="3" fill="#fca5a5" />])}
      {state === "idle" && <rect x="12" y="40" width="3" height="1" fill="#374151" />}
      <rect x="25" y="46" width="4" height="5" fill="#374151" />
      <rect x="19" y="50" width="16" height="2" fill="#4b5563" />

      {/* bonequinho atrás da mesa */}
      <g className={cn(working && "office-bob", state === "idle" && "office-breathe")}>
        <PixelBot color={color} x={50} y={26} size={3} lookLeft={working} />
      </g>
      {/* braço levantado quando terminou */}
      {state === "waiting_approval" && <rect className="office-wave" x="83" y="18" width="3" height="20" fill={color} />}

      {/* mesa */}
      <rect x="2" y="52" width="92" height="5" fill="#9a6a3a" />
      <rect x="2" y="57" width="92" height="2" fill="#6b4423" />
      <rect x="6" y="59" width="4" height="13" fill="#6b4423" />
      <rect x="86" y="59" width="4" height="13" fill="#6b4423" />
      {/* teclado e mãos */}
      <rect x="50" y="49" width="20" height="3" fill="#374151" />
      {working && <><rect className="office-type" x="52" y="47" width="4" height="3" fill={color} /><rect className="office-type office-type-b" x="63" y="47" width="4" height="3" fill={color} /></>}
      {/* caneca */}
      <rect x="1" y="45" width="5" height="7" fill="#e5e7eb" />
      <rect x="6" y="47" width="1" height="3" fill="#e5e7eb" />
      {state === "idle" && <text x="74" y="16" className="office-z" fontSize="7" fill="#c4b5fd" fontFamily="monospace">z</text>}
    </svg>
  );
}

function timeAgo(date: Date | string | null) {
  if (!date) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} d`;
}

const BUBBLE_STYLE: Record<State, string> = {
  idle: "bg-white/90 text-slate-600",
  thinking: "bg-violet-100 text-violet-900",
  tool: "bg-emerald-100 text-emerald-900",
  waiting_approval: "bg-orange-100 text-orange-900 ring-2 ring-orange-400",
  failed: "bg-red-100 text-red-900",
};

export default function AgentOffice() {
  const [, navigate] = useLocation();
  const list = trpc.agents.list.useQuery(undefined, { retry: false });
  const office = trpc.agents.office.useQuery(undefined, { refetchInterval: 2000, retry: false });

  if (list.error?.data?.code === "UNAUTHORIZED" || office.error?.data?.code === "UNAUTHORIZED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#140a24] text-white">
        <p>Faça <Link href="/login" className="underline">login</Link> para ver o escritório.</p>
      </div>
    );
  }

  const activity = new Map((office.data ?? []).map((a) => [a.agentSlug, a]));
  const counts = { working: 0, waiting: 0, failed: 0 };
  for (const a of office.data ?? []) {
    if (a.state === "tool" || a.state === "thinking") counts.working++;
    if (a.state === "waiting_approval") counts.waiting++;
    if (a.state === "failed") counts.failed++;
  }

  return (
    <div className="office-floor min-h-screen p-4 text-white md:p-6">
      <style>{OFFICE_CSS}</style>
      <header className="mx-auto mb-6 flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-lg bg-white p-1" />
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tight">Escritório da Alle</h1>
            <p className="text-xs text-white/60">Os agentes trabalhando ao vivo · atualiza a cada 2 s</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-300">● {counts.working} trabalhando</span>
          <span className="rounded-full bg-orange-400/15 px-3 py-1 text-orange-300">● {counts.waiting} aguardando você</span>
          {counts.failed > 0 && <span className="rounded-full bg-red-400/15 px-3 py-1 text-red-300">● {counts.failed} com erro</span>}
          <Link href="/dashboard/agents" className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">abrir plataforma →</Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {list.data?.agents.map((agent, i) => {
          const a = activity.get(agent.slug);
          const state: State = a?.state ?? "idle";
          const bubble =
            state === "tool" ? `${TOOL_LABELS[a!.tool!.name] ?? a!.tool!.name}${a!.tool!.detail ? ` · ${a!.tool!.detail}` : ""}…`
            : state === "thinking" ? "Pensando…"
            : state === "waiting_approval" ? "Terminei! Aguardando sua aprovação"
            : state === "failed" ? `Parei: ${(a?.error ?? "erro").slice(0, 70)}`
            : a?.threadTitle ? "Livre · pronto para o próximo" : "Livre · ainda sem tarefas";
          return (
            <button
              key={agent.slug}
              onClick={() => navigate(`/dashboard/agents/${agent.slug}`)}
              className="group flex flex-col items-center text-left"
              title={a?.threadTitle ?? agent.description}
            >
              <div className={cn("relative mb-2 min-h-[44px] w-full rounded-xl px-3 py-2 font-mono text-[11px] leading-snug shadow-lg", BUBBLE_STYLE[state])}>
                <p className="line-clamp-2">{bubble}</p>
                {a?.updatedAt && state !== "idle" && <p className="mt-0.5 text-[10px] opacity-60">{timeAgo(a.updatedAt)}</p>}
                <span className={cn("absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45", BUBBLE_STYLE[state].split(" ")[0])} />
              </div>
              <div className="w-full transition-transform group-hover:-translate-y-1">
                <Workstation state={state} color={BOT_COLORS[i % BOT_COLORS.length]} />
              </div>
              <div className="mt-1 w-full rounded-md bg-black/30 px-2 py-1 text-center">
                <p className="truncate font-mono text-xs font-semibold">{agent.name.replace(/^Agente (de |)/, "")}</p>
                <p className="truncate text-[10px] text-white/50">{a?.threadTitle ?? agent.role}</p>
              </div>
            </button>
          );
        })}
      </main>
    </div>
  );
}

export const OFFICE_CSS = `
.office-floor {
  background-color: #140a24;
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
    radial-gradient(circle at 20% 0%, rgba(124,0,174,.35), transparent 45%),
    radial-gradient(circle at 90% 10%, rgba(255,115,0,.18), transparent 40%);
  background-size: 32px 32px, 32px 32px, auto, auto;
}
@keyframes office-scroll { from { transform: translateY(0) } to { transform: translateY(-24px) } }
.office-code { animation: office-scroll 1.6s linear infinite; }
@keyframes office-blink { 0%,100% { opacity: .2 } 50% { opacity: 1 } }
.office-dot { animation: office-blink 1s ease-in-out infinite; }
@keyframes office-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1px) } }
.office-bob { animation: office-bob .5s steps(2) infinite; }
@keyframes office-breathe { 0%,100% { transform: translateY(0) } 50% { transform: translateY(1px) } }
.office-breathe { animation: office-breathe 3s steps(2) infinite; }
@keyframes office-type { 0%,100% { transform: translateY(0) } 50% { transform: translateY(1.5px) } }
.office-type { animation: office-type .25s steps(2) infinite; }
.office-type-b { animation-delay: .12s; }
@keyframes office-wave { 0%,100% { transform: rotate(-10deg) } 50% { transform: rotate(10deg) } }
.office-wave { transform-box: fill-box; transform-origin: bottom center; animation: office-wave .6s ease-in-out infinite; }
@keyframes office-z { 0% { opacity: 0; transform: translate(0,4px) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(6px,-8px) } }
.office-z { animation: office-z 2.4s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .office-code, .office-dot, .office-bob, .office-breathe, .office-type, .office-wave, .office-z { animation: none; }
}
`;
