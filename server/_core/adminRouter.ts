import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ownerProcedure, protectedProcedure, router } from "./trpc";
import * as db from "../db";

export const adminRouter = router({
  // ─── Stats ────────────────────────────────────────────────────────────────
  getStats: ownerProcedure.query(async () => {
    const [users, flags] = await Promise.all([
      db.listAllUsers(),
      db.getFeatureFlags(),
    ]);
    return {
      totalUsers: users.length,
      adminUsers: users.filter((u) => u.role === "admin").length,
      totalFlags: flags.length,
      enabledFlags: flags.filter((f) => f.enabled).length,
    };
  }),

  // ─── Users ────────────────────────────────────────────────────────────────
  listUsers: ownerProcedure.query(async () => {
    return db.listAllUsers();
  }),

  // ─── Feature Flags ────────────────────────────────────────────────────────
  getFeatureFlags: ownerProcedure.query(async () => {
    return db.getFeatureFlags();
  }),

  upsertFeatureFlag: ownerProcedure
    .input(
      z.object({
        key: z
          .string()
          .min(1)
          .max(128)
          .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e underscore"),
        label: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.upsertFeatureFlag(input.key, input.label, input.description, input.enabled);
      return { success: true } as const;
    }),

  toggleFeatureFlag: ownerProcedure
    .input(z.object({ key: z.string().min(1), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const flag = await db.getFeatureFlagByKey(input.key);
      if (!flag) throw new TRPCError({ code: "NOT_FOUND", message: "Feature flag não encontrada" });
      await db.toggleFeatureFlag(input.key, input.enabled);
      return { success: true } as const;
    }),

  deleteFeatureFlag: ownerProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const flag = await db.getFeatureFlagByKey(input.key);
      if (!flag) throw new TRPCError({ code: "NOT_FOUND", message: "Feature flag não encontrada" });
      await db.deleteFeatureFlag(input.key);
      return { success: true } as const;
    }),
});

// ─── Public feature flag check (for regular users) ────────────────────────────
export const featuresRouter = router({
  isEnabled: protectedProcedure
    .input(z.object({ key: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      // Admins always see features as enabled (for testing)
      if (ctx.user.role === "admin") return { enabled: true };
      const flag = await db.getFeatureFlagByKey(input.key);
      return { enabled: flag?.enabled ?? false };
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const flags = await db.getFeatureFlags();
    // Admins see all flags as enabled
    if (ctx.user.role === "admin") return flags.map((f) => ({ ...f, enabled: true }));
    return flags;
  }),
});
