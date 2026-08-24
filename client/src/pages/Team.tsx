import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Plus, Trash2, Loader2, Lock } from "lucide-react";

type TeamMember = {
  id: number;
  name: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string | Date;
};

function AddMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.team.create.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Funcionário adicionado.");
      setName(""); setEmail(""); setPassword("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar funcionário</DialogTitle>
          <DialogDescription>
            Ele vai logar com esse email/senha e usar o mesmo conteúdo e marca da sua conta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Senha (mín. 6 caracteres)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button
            className="w-full"
            disabled={createMutation.isPending || !name || !email || password.length < 6}
            onClick={() => createMutation.mutate({ name, email, password })}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member }: { member: TeamMember }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const utils = trpc.useUtils();

  const setActiveMutation = trpc.team.setActive.useMutation({
    onSuccess: () => utils.team.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.team.remove.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      setConfirmDelete(false);
      toast.success("Funcionário removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50">
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
        {(member.name || member.email || "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{member.name || "Sem nome"}</div>
        <div className="text-xs text-muted-foreground truncate">{member.email}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">{member.isActive ? "Ativo" : "Inativo"}</span>
        <Switch
          checked={member.isActive}
          disabled={setActiveMutation.isPending}
          onCheckedChange={(checked) => setActiveMutation.mutate({ memberId: member.id, isActive: checked })}
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {member.name || "este funcionário"}?</AlertDialogTitle>
            <AlertDialogDescription>
              O login dele para de funcionar imediatamente. O conteúdo que ele criou continua na sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate({ memberId: member.id })}
            >
              {removeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Team() {
  const [showAdd, setShowAdd] = useState(false);
  const listQuery = trpc.team.list.useQuery();
  const members = (listQuery.data ?? []) as TeamMember[];
  const isForbidden = (listQuery.error as { data?: { code?: string } } | undefined)?.data?.code === "FORBIDDEN";

  return (
    <AppLayout activeModule="team">
      <div className="p-4 lg:p-6 max-w-[720px] mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-md shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Equipe</h1>
              <p className="text-xs text-muted-foreground">
                {members.length} funcionário{members.length !== 1 ? "s" : ""} com acesso à sua conta
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-2 font-medium self-start sm:self-auto" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" />
            Adicionar funcionário
          </Button>
        </div>

        {isForbidden ? (
          <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Lock className="w-8 h-8 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Gerenciamento de equipe está disponível só para a conta principal.
            </p>
          </div>
        ) : listQuery.isLoading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando equipe…</span>
          </div>
        ) : members.length === 0 ? (
          <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-500 opacity-60" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Nenhum funcionário ainda</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Adicione funcionários pra eles logarem com a própria conta e trabalharem no mesmo conteúdo e marca.
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar primeiro funcionário
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => <MemberRow key={m.id} member={m} />)}
          </div>
        )}
      </div>

      <AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </AppLayout>
  );
}
