import { trpc } from "@/lib/trpc";

export function useCompanyAccess() {
  const { data, isLoading } = trpc.artStudio.myAccess.useQuery();

  return {
    company: data ?? null,
    hasCompanyAccess: !!data,
    isLoading,
  };
}
