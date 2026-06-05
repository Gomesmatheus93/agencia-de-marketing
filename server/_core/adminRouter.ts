import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ownerProcedure, protectedProcedure, router } from "./trpc";
import * as db from "../db";
import { hashPassword } from "./password";
import { nanoid } from "nanoid";

export const adminRouter = router({
  // ─── Stats ────────────────────────────────────────────────────────────────
  getStats: ownerProcedure.query(async () => {
    const [allUsers, flags] = await Promise.all([
      db.listAllUsers(),
      db.getFeatureFlags(),
    ]);
    const planCounts = { free: 0, pro: 0, agency: 0 };
    for (const u of allUsers) planCounts[u.plan] = (planCounts[u.plan] ?? 0) + 1;
    return {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter((u) => u.isActive).length,
      adminUsers: allUsers.filter((u) => u.role === "admin").length,
      planCounts,
      totalFlags: flags.length,
      enabledFlags: flags.filter((f) => f.enabled).length,
    };
  }),

  // ─── Users ────────────────────────────────────────────────────────────────
  listUsers: ownerProcedure.query(async () => {
    const rows = await db.listAllUsers();
    return rows.map(({ passwordHash: _ph, ...u }) => u);
  }),

  setUserRole: ownerProcedure
    .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode alterar sua própria função." });
      }
      await db.setUserRole(input.id, input.role);
      return { success: true };
    }),

  setUserPlan: ownerProcedure
    .input(z.object({ id: z.number(), plan: z.enum(["free", "pro", "agency"]) }))
    .mutation(async ({ input }) => {
      await db.setUserPlan(input.id, input.plan);
      return { success: true };
    }),

  setUserActive: ownerProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode desativar sua própria conta." });
      }
      await db.setUserActive(input.id, input.isActive);
      return { success: true };
    }),

  deleteUser: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir sua própria conta." });
      }
      await db.deleteUserById(input.id);
      return { success: true };
    }),

  inviteUser: ownerProcedure
    .input(z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["user", "admin"]).default("user"),
      plan: z.enum(["free", "pro", "agency"]).default("free"),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." });
      }
      const passwordHash = await hashPassword(input.password);
      const openId = `local_${nanoid()}`;
      await db.upsertUser({ openId, name: input.name, email: input.email, loginMethod: "email", passwordHash, role: input.role });
      const created = await db.getUserByEmail(input.email);
      if (created && input.plan !== "free") {
        await db.setUserPlan(created.id, input.plan);
      }
      return { success: true };
    }),

  // ─── Feature Flags ────────────────────────────────────────────────────────
  getFeatureFlags: ownerProcedure.query(async () => {
    return db.getFeatureFlags();
  }),

  upsertFeatureFlag: ownerProcedure
    .input(z.object({
      key: z.string().min(1).max(128).regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e underscore"),
      label: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      enabled: z.boolean(),
    }))
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
      if (ctx.user.role === "admin") return { enabled: true };
      const flag = await db.getFeatureFlagByKey(input.key);
      return { enabled: flag?.enabled ?? false };
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const flags = await db.getFeatureFlags();
    if (ctx.user.role === "admin") return flags.map((f) => ({ ...f, enabled: true }));
    return flags;
  }),
});