import { Card, CardContent } from "@/components/ui/card";
import { TOOL_LABELS } from "@/lib/agentLabels";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { OFFICE_CSS, Workstation } from "@/pages/AgentOffice";
import { AlertTriangle, History } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Dispara e acompanha a tarefa de um agente a partir de uma tela. Mostra a
 * rodada mais recente por padrão e deixa escolher as anteriores.
 */
export function useAgentTask<R>(agentSlug: string) {
  const utils = trpc.useUtils();
  const tasks = trpc.agents.tasks.useQuery({ agentSlug });
  const [threadId, setThreadId] = useState<number | null>(null);
  useEffect(() => {
    if (threadId === null && tasks.data?.length) setThreadId(tasks.data[0].id);
  }, [tasks.data, threadId]);

  const task = trpc.agents.task.useQuery(
    { threadId: threadId ?? 0 },
    { enabled: threadId !== null, refetchInterval: (q) => (q.state.data?.thread.status === "running" ? 2000 : false) }
  );
  const running = task.data?.thread.status === "running";
  useEffect(() => { if (!running) utils.agents.tasks.invalidate({ agentSlug }); }, [running, agentSlug, utils]);

  const start = trpc.agents.startTask.useMutation({
    onSuccess: ({ threadId: id }) => { setThreadId(id); utils.agents.tasks.invalidate({ agentSlug }); },
    onError: (e) => toast.error(e.message),
  });

  return {
    tasks: tasks.data ?? [],
    threadId,
    setThreadId,
    thread: task.data?.thread,
    activity: task.data?.activity,
    result: (task.data?.thread.result ?? null) as R | null,
    running,
    start: (input: Record<string, unknown>) => start.mutate({ agentSlug, input }),
    starting: start.isPending,
    refetch: () => task.refetch(),
  };
}

type Activity = NonNullable<ReturnType<typeof useAgentTask>["activity"]>;

export function TaskProgress({ agentName, activity, startedAt }: { agentName: string; activity?: Activity; startedAt?: Date | string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const state = activity?.state === "tool" || activity?.state === "thinking" ? activity.state : "thinking";
  const label = activity?.state === "tool" && activity.tool
    ? `${TOOL_LABELS[activity.tool.name] ?? activity.tool.name}${activity.tool.detail ? ` · ${activity.tool.detail}` : ""}…`
    : "Pensando…";
  const elapsed = startedAt ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
  return (
    <Card className="overflow-hidden border-primary/20">
      <style>{OFFICE_CSS}</style>
      <CardContent className="flex flex-col items-center gap-4 bg-[#140a24] p-6 text-white sm:flex-row">
        <div className="w-40 shrink-0"><Workstation state={state} color="#ff7300" /></div>
        <div className="min-w-0 text-center sm:text-left">
          <p className="font-mono text-sm text-white/60">{agentName} trabalhando · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</p>
          <p className="mt-1 font-mono text-base">{label}</p>
          <p className="mt-2 text-xs text-white/50">Pode sair desta tela: o trabalho continua e o resultado fica salvo aqui.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskError({ message }: { message?: string | null }) {
  return (
    <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <div><p className="font-medium">O agente parou com um erro.</p><p className="text-muted-foreground">{message}</p></div>
    </div>
  );
}

export function TaskHistory({ tasks, threadId, onSelect }: {
  tasks: Array<{ id: number; title: string; status: string; hasResult: boolean; createdAt: Date | string }>;
  threadId: number | null;
  onSelect: (id: number) => void;
}) {
  if (tasks.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <History className="h-4 w-4" />
      <select
        value={threadId ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        className={cn("rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground")}
      >
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {new Date(t.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {t.title}
            {t.status === "failed" ? " (erro)" : t.status === "running" ? " (rodando)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
