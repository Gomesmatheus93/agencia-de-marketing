import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AlertTriangle, BadgeCheck, Loader2, Users, X } from "lucide-react";
import { useState } from "react";

const MAX = 3;
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const normalize = (v: string) => v.trim().replace(/^@+/, "").toLowerCase();

function fmtFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(n);
}

/** Etiqueta de um colaborador, com a confirmação do perfil pela Meta (foto, nome e seguidores). */
function CollaboratorChip({ username, onRemove }: { username: string; onRemove: () => void }) {
  const lookup = trpc.analytics.lookupCollaborator.useQuery({ username }, { staleTime: 60 * 60_000, retry: false });
  const d = lookup.data;
  const found = d?.status === "found";
  const notFound = d?.status === "not_found";
  const title = found
    ? `${d.name ?? d.username}${d.followers != null ? ` · ${fmtFollowers(d.followers)} seguidores` : ""}`
    : notFound ? "Não encontrado como conta comercial ou de criador. Confira se o @ está certo (contas pessoais não dá para confirmar)."
    : lookup.isLoading ? "Conferindo o perfil…" : "Não deu para conferir agora.";
  return (
    <span title={title} className={cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-medium",
      found ? "bg-primary/10 text-primary" : notFound ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted text-foreground",
    )}>
      {found && d.profilePic ? <img src={d.profilePic} alt="" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded-full object-cover" />
        : lookup.isLoading ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />
        : notFound ? <AlertTriangle className="ml-1 h-3.5 w-3.5" /> : <span className="ml-1" />}
      <span className="truncate">@{username}</span>
      {found && <span className="hidden truncate font-normal opacity-80 sm:inline">· {d.name ?? ""}{d.followers != null ? ` · ${fmtFollowers(d.followers)}` : ""}</span>}
      {found && <BadgeCheck className="h-3.5 w-3.5 shrink-0" />}
      <button type="button" aria-label={`Remover @${username}`} onClick={onRemove} className="rounded-full hover:bg-black/10"><X className="h-3 w-3" /></button>
    </span>
  );
}

/**
 * Colaboradores do post (collab no Instagram): até 3 @. Enter, vírgula ou espaço
 * adiciona; o outro perfil recebe um convite e precisa aceitar no app.
 */
export function CollaboratorsInput({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const add = (raw: string) => {
    const names = raw.split(/[\s,;]+/).map(normalize).filter(Boolean);
    if (!names.length) return;
    const next = [...value];
    for (const n of names) {
      if (!USERNAME_RE.test(n)) { setError(`"@${n}" não é um @ válido.`); continue; }
      if (next.includes(n)) continue;
      if (next.length >= MAX) { setError(`No máximo ${MAX} colaboradores.`); break; }
      next.push(n);
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className={cn("space-y-1", className)}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Users className="h-3.5 w-3.5" />Colaboradores (collab) · opcional</label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring/30">
        {value.map((u) => <CollaboratorChip key={u} username={u} onRemove={() => onChange(value.filter((x) => x !== u))} />)}
        {value.length < MAX && (
          <input
            value={draft}
            onChange={(e) => { setError(""); const v = e.target.value; if (/[\s,;]$/.test(v)) add(v); else setDraft(v); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(draft); }
              if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
            }}
            onBlur={() => add(draft)}
            placeholder={value.length ? "" : "@allpfit"}
            className="h-7 min-w-[90px] flex-1 bg-transparent text-sm outline-none"
          />
        )}
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p>
        : value.length > 0 && <p className="text-[11px] text-muted-foreground">Confira a foto e o nome de cada perfil. Etiqueta amarela: não encontrado como conta comercial (pode ser @ errado ou conta pessoal). O convidado precisa aceitar o convite no Instagram.</p>}
    </div>
  );
}
