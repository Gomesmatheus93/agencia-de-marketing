import { trpc } from "@/lib/trpc";

export type Plan = "free" | "pro" | "agency";

const TRIAL_LOCKED_FEATURES = new Set([
  "chat",
  "videos",
  "reels",
  "analytics",
  "calendar",
  "brand",
  "commentAutomations",
  "styleAnalyzer",
  "radar",
  "editorialPlan",
  "stories",
]);

export function usePlan() {
  const { data, isLoading } = trpc.auth.trialStatus.useQuery();

  const plan: Plan = (data?.plan as Plan) ?? "free";
  const isPaid = data?.isPaid ?? false;
  const isTrialActive = data?.isActive ?? false;
  const isExpired = data?.isExpired ?? false;
  const isLegacy = data?.isLegacy ?? false;
  const daysLeft = data?.daysLeft ?? 0;

  function canAccess(featureId: string): boolean {
    if (isPaid || isLegacy) return true;
    if (isExpired) return false;
    if (isTrialActive && !TRIAL_LOCKED_FEATURES.has(featureId)) return true;
    return false;
  }

  function isLocked(featureId: string): boolean {
    return !canAccess(featureId);
  }

  return {
    plan,
    isPaid,
    isTrialActive,
    isExpired,
    isLegacy,
    daysLeft,
    limits: data?.limits,
    usage: data?.usage,
    isLoading,
    canAccess,
    isLocked,
  };
}
