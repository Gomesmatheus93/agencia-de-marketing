import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { z } from "zod";
import { users } from "../drizzle/schema";
import { encryptField } from "./_core/crypto";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";

// Perfil do usuário logado (ctx.actualUser): nome de exibição e foto.

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Valida e normaliza a foto: só JPEG/PNG/WebP, recortada em 512×512, sem metadados (EXIF/GPS). */
async function normalizePhoto(dataUrl: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma foto em JPG, PNG ou WebP." });
  const input = Buffer.from(match[2], "base64");
  if (input.length > MAX_PHOTO_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "A foto pode ter no máximo 5 MB." });
  try {
    return await sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize(512, 512, { fit: "cover", position: "attention" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Não consegui ler essa imagem. Tente outra foto." });
  }
}

export const profileRouter = router({
  update: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(2, "O nome precisa ter pelo menos 2 letras.").max(100),
      // data URL da nova foto; null remove a foto; ausente mantém a atual.
      photo: z.string().max(7_000_000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await db.getDb();
      if (!conn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const me = ctx.actualUser!;
      const set: { name: string; avatarUrl?: string | null } = { name: encryptField(input.name)! };
      if (input.photo === null) set.avatarUrl = null;
      else if (input.photo) {
        const jpg = await normalizePhoto(input.photo);
        set.avatarUrl = (await storagePut(`avatars/${me.id}-${nanoid(10)}.jpg`, jpg, "image/jpeg")).url;
      }
      await conn.update(users).set(set).where(eq(users.id, me.id));
      return { ok: true, avatarUrl: set.avatarUrl !== undefined ? set.avatarUrl : me.avatarUrl ?? null };
    }),
});
