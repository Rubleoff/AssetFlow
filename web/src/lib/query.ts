import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export const queryKeys = {
  me: ["me"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  transactions: ["transactions"] as const,
  budgets: ["budgets"] as const,
  goals: ["goals"] as const,
  recurring: ["recurring"] as const,
  assets: ["assets"] as const,
  assetSearch: (assetType: string, query: string) => ["assetSearch", assetType, query] as const,
  assetChart: (assetId: string, rangeDays: number) => ["assetChart", assetId, rangeDays] as const,
  deposits: ["deposits"] as const,
  overview: ["overview"] as const,
  cashFlow: ["cashFlow"] as const,
  categoryDynamics: ["categoryDynamics"] as const,
  merchantReport: ["merchantReport"] as const,
  netWorthTimeline: ["netWorthTimeline"] as const,
  allocationReport: ["allocationReport"] as const,
  notifications: ["notifications"] as const,
  merchantRules: ["merchantRules"] as const,
  auditEntries: ["auditEntries"] as const,
  adminOutbox: ["adminOutbox"] as const,
  adminJobs: ["adminJobs"] as const,
  imports: ["imports"] as const,
  importDetail: (jobId: string) => ["importDetail", jobId] as const
};

export const useCurrentUser = () =>
  useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me
  });

export const useOverview = () =>
  useQuery({
    queryKey: queryKeys.overview,
    queryFn: api.getOverview
  });

export const useCashFlow = () =>
  useQuery({
    queryKey: queryKeys.cashFlow,
    queryFn: api.getCashFlow
  });

export const useCategoryDynamics = () =>
  useQuery({
    queryKey: queryKeys.categoryDynamics,
    queryFn: api.getCategoryDynamics
  });

export const useMerchantReport = () =>
  useQuery({
    queryKey: queryKeys.merchantReport,
    queryFn: api.getMerchantReport
  });

export const useNetWorthTimeline = () =>
  useQuery({
    queryKey: queryKeys.netWorthTimeline,
    queryFn: api.getNetWorthTimeline
  });

export const useAllocationReport = () =>
  useQuery({
    queryKey: queryKeys.allocationReport,
    queryFn: api.getAllocationReport
  });

export const useAccounts = () =>
  useQuery({
    queryKey: queryKeys.accounts,
    queryFn: api.getAccounts
  });

export const useCategories = () =>
  useQuery({
    queryKey: queryKeys.categories,
    queryFn: api.getCategories
  });

export const useTransactions = () =>
  useQuery({
    queryKey: queryKeys.transactions,
    queryFn: api.getTransactions
  });

export const useBudgets = () =>
  useQuery({
    queryKey: queryKeys.budgets,
    queryFn: api.getBudgets
  });

export const useGoals = () =>
  useQuery({
    queryKey: queryKeys.goals,
    queryFn: api.getGoals
  });

export const useRecurring = () =>
  useQuery({
    queryKey: queryKeys.recurring,
    queryFn: api.getRecurring
  });

export const useAssets = () =>
  useQuery({
    queryKey: queryKeys.assets,
    queryFn: api.getAssets
  });

export const useAssetSearch = (assetType: Parameters<typeof api.searchAssetInstruments>[0], query: string) =>
  useQuery({
    queryKey: queryKeys.assetSearch(assetType, query),
    queryFn: () => api.searchAssetInstruments(assetType, query),
    enabled: query.trim().length >= 2
  });

export const useAssetChart = (assetId: string | null, rangeDays: number) =>
  useQuery({
    queryKey: queryKeys.assetChart(assetId ?? "none", rangeDays),
    queryFn: () => api.getAssetChart(assetId!, rangeDays),
    enabled: Boolean(assetId)
  });

export const useDeposits = () =>
  useQuery({
    queryKey: queryKeys.deposits,
    queryFn: api.getDeposits
  });

export const useNotifications = () =>
  useQuery({
    queryKey: queryKeys.notifications,
    queryFn: api.getNotifications
  });

export const useMerchantRules = () =>
  useQuery({
    queryKey: queryKeys.merchantRules,
    queryFn: api.getMerchantRules
  });

export const useAuditEntries = () =>
  useQuery({
    queryKey: queryKeys.auditEntries,
    queryFn: () => api.getAuditEntries({ limit: 25 })
  });

export const useAdminOutbox = () =>
  useQuery({
    queryKey: queryKeys.adminOutbox,
    queryFn: api.getAdminOutbox
  });

export const useAdminJobs = () =>
  useQuery({
    queryKey: queryKeys.adminJobs,
    queryFn: api.getAdminJobs
  });

export const useImports = () =>
  useQuery({
    queryKey: queryKeys.imports,
    queryFn: api.getImports
  });

export const useImportDetail = (jobId: string | null) =>
  useQuery({
    queryKey: queryKeys.importDetail(jobId ?? "none"),
    queryFn: () => api.getImportDetail(jobId!),
    enabled: Boolean(jobId)
  });

const invalidateAppQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cashFlow }),
    queryClient.invalidateQueries({ queryKey: queryKeys.categoryDynamics }),
    queryClient.invalidateQueries({ queryKey: queryKeys.merchantReport }),
    queryClient.invalidateQueries({ queryKey: queryKeys.netWorthTimeline }),
    queryClient.invalidateQueries({ queryKey: queryKeys.allocationReport }),
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
    queryClient.invalidateQueries({ queryKey: queryKeys.goals }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
    queryClient.invalidateQueries({ queryKey: queryKeys.assets }),
    queryClient.invalidateQueries({ queryKey: queryKeys.deposits }),
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
    queryClient.invalidateQueries({ queryKey: queryKeys.merchantRules }),
    queryClient.invalidateQueries({ queryKey: queryKeys.auditEntries })
  ]);
};

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useRegisterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.register,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useAccountCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAccount,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useAccountUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: Parameters<typeof api.updateAccount>[1] }) =>
      api.updateAccount(accountId, payload),
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useAccountDeleteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useTransactionCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTransaction,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useTransactionUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      payload
    }: {
      transactionId: string;
      payload: Parameters<typeof api.updateTransaction>[1];
    }) => api.updateTransaction(transactionId, payload),
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useTransactionDeleteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useBudgetCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createBudget,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useGoalCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createGoal,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useGoalUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, payload }: { goalId: string; payload: Parameters<typeof api.updateGoal>[1] }) =>
      api.updateGoal(goalId, payload),
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useGoalDeleteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteGoal,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useGoalContributionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      goalId,
      payload
    }: {
      goalId: string;
      payload: Parameters<typeof api.contributeGoal>[1];
    }) => api.contributeGoal(goalId, payload),
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useRecurringCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createRecurring,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useRecurringUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recurringId,
      payload
    }: {
      recurringId: string;
      payload: Parameters<typeof api.updateRecurring>[1];
    }) => api.updateRecurring(recurringId, payload),
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useRecurringDeleteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRecurring,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useAssetCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAsset,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useAssetUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: Parameters<typeof api.updateAsset>[1] }) =>
      api.updateAsset(assetId, payload),
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useAssetDeleteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAsset,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useAssetPriceSyncMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.syncAssetPrice,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useDepositCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createDeposit,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useDepositUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ depositId, payload }: { depositId: string; payload: Parameters<typeof api.updateDeposit>[1] }) =>
      api.updateDeposit(depositId, payload),
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useDepositDeleteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDeposit,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useScenarioMutation = () => useMutation({ mutationFn: api.projectScenario });

export const useReadNotificationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.readNotification,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    }
  });
};

export const useUpdateMeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: async () => {
      await invalidateAppQueries(queryClient);
    }
  });
};

export const useCreateMerchantRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createMerchantRule,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.merchantRules }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditEntries }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions })
      ]);
    }
  });
};

export const useUpdateMerchantRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, payload }: { ruleId: string; payload: Parameters<typeof api.updateMerchantRule>[1] }) =>
      api.updateMerchantRule(ruleId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.merchantRules }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditEntries }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions })
      ]);
    }
  });
};

export const useDeleteMerchantRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteMerchantRule,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.merchantRules }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditEntries }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions })
      ]);
    }
  });
};

export const useProcessAdminOutboxMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.processAdminOutbox,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminOutbox }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminJobs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview })
      ]);
    }
  });
};

export const useRetryFailedAdminOutboxMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.retryFailedAdminOutbox,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminOutbox }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminJobs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview })
      ]);
    }
  });
};

export const usePreviewImportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.previewImport,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.imports });
    }
  });
};

export const useApplyImportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, payload }: { jobId: string; payload: Parameters<typeof api.applyImport>[1] }) =>
      api.applyImport(jobId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.imports }),
        queryClient.invalidateQueries({ queryKey: queryKeys.importDetail(variables.jobId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cashFlow }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      ]);
    }
  });
};

export const useExportTransactionsCsvMutation = () =>
  useMutation({
    mutationFn: api.exportTransactionsCsv
  });
