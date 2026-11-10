import { cn } from "@/lib/utils";
import { Users, X } from "lucide-react";
import { useState } from "react";

const MAX = 3;
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const normalize = (v: string) => v.trim().replace(/^@+/, "").toLowerCase();

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
        {value.map((u) => (
          <span key={u} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            @{u}
            <button type="button" aria-label={`Remover @${u}`} onClick={() => onChange(value.filter((x) => x !== u))} className="rounded-full hover:bg-primary/20"><X className="h-3 w-3" /></button>
          </span>
        ))}
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
        : value.length > 0 && <p className="text-[11px] text-muted-foreground">O perfil convidado precisa aceitar o convite no Instagram para o post aparecer lá também.</p>}
    </div>
  );
}
