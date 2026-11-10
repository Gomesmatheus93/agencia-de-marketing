import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function initialsOf(name?: string | null) {
  return (name ?? "").split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
}

/** Reduz a foto no navegador (lado maior 1024 px, JPEG) antes de enviar: upload rápido e leve. */
function shrinkPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não consegui abrir essa imagem.")); };
    img.src = url;
  });
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState("");
  // undefined = manter a foto atual; null = remover; string = nova foto (data URL)
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user?.name) setName(user.name); }, [user?.name]);

  const save = trpc.profile.update.useMutation({
    onSuccess: async () => { await refresh(); setPhoto(undefined); toast.success("Perfil atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  const currentPhoto = photo === undefined ? (user as { avatarUrl?: string | null } | null)?.avatarUrl ?? null : photo;
  const dirty = photo !== undefined || name.trim() !== (user?.name ?? "");

  const pick = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Use uma foto em JPG, PNG ou WebP.");
    if (file.size > 15 * 1024 * 1024) return toast.error("Essa foto é grande demais (máx. 15 MB).");
    try { setPhoto(await shrinkPhoto(file)); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <AppLayout activeModule="profile">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
            <p className="mt-1 text-sm text-muted-foreground">Seu nome e sua foto aparecem no dashboard e no menu lateral.</p>
          </div>

          <Card className="border-border/60">
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative">
                  <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                    {currentPhoto && <AvatarImage src={currentPhoto} alt="Foto de perfil" className="object-cover" />}
                    <AvatarFallback className="gradient-primary text-2xl font-semibold text-white">{initialsOf(name || user?.name)}</AvatarFallback>
                  </Avatar>
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="Trocar foto"
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow hover:bg-primary/90">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2 sm:items-start">
                  <p className="text-sm font-medium">Foto de perfil</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG ou WebP. A foto fica quadrada, recortada no centro.</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>{currentPhoto ? "Trocar foto" : "Enviar foto"}</Button>
                    {currentPhoto && <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPhoto(null)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remover</Button>}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-name">Nome</Label>
                <Input id="profile-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Como você quer ser chamado(a)" />
                <p className="text-xs text-muted-foreground">O primeiro nome aparece na saudação do dashboard: "Bom dia, {name.trim().split(" ")[0] || "…"}".</p>
              </div>

              <div className="space-y-1">
                <Label>E-mail</Label>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="ghost" disabled={!dirty || save.isPending} onClick={() => { setName(user?.name ?? ""); setPhoto(undefined); }}>Descartar</Button>
                <Button type="button" disabled={!dirty || name.trim().length < 2 || save.isPending} onClick={() => save.mutate({ name: name.trim(), ...(photo !== undefined ? { photo } : {}) })}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
  );
}
