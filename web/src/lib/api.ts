import type { components, paths } from "./generated/api-types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const authRoutePrefixes = ["/auth/login", "/auth/register", "/auth/logout", "/auth/refresh"];

type HttpMethod = "get" | "post" | "patch" | "delete";
type JsonBody<T> = T extends { "application/json": infer Body } ? Body : never;
type Operation<Path extends keyof paths, Method extends HttpMethod> = NonNullable<paths[Path][Method]>;
type ResponseFor<Path extends keyof paths, Method extends HttpMethod> = JsonBody<
  Operation<Path, Method>["responses"][200]["content"]
>;
type RequestFor<Path extends keyof paths, Method extends HttpMethod> =
  Operation<Path, Method> extends { requestBody: { content: infer Content } }
    ? JsonBody<Content>
    : never;

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<void> | null = null;

async function fetchJson(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });
}

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetchJson("/auth/refresh", {
        method: "POST"
      });
      if (!response.ok) {
        const message = await response.text();
        throw new ApiError(response.status, message || response.statusText);
      }
      await response.json();
    })().finally(() => {
      refreshPromise = null;
    });
  }

  await refreshPromise;
}

async function request<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const response = await fetchJson(path, init);

  if (response.status === 401 && allowRefresh && !authRoutePrefixes.some((prefix) => path.startsWith(prefix))) {
    await refreshSession();
    return request<T>(path, init, false);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, message || response.statusText);
  }

  return response.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit, allowRefresh = true): Promise<string> {
  const response = await fetchJson(path, init);

  if (response.status === 401 && allowRefresh && !authRoutePrefixes.some((prefix) => path.startsWith(prefix))) {
    await refreshSession();
    return requestText(path, init, false);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, message || response.statusText);
  }

  return response.text();
}

export const api = {
  me: () => request<ResponseFor<"/api/users/me", "get">>("/users/me"),
  updateMe: (payload: RequestFor<"/api/users/me", "patch">) =>
    request<ResponseFor<"/api/users/me", "patch">>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  getMerchantRules: () => request<ResponseFor<"/api/users/me/merchant-rules", "get">>("/users/me/merchant-rules"),
  createMerchantRule: (payload: RequestFor<"/api/users/me/merchant-rules", "post">) =>
    request<ResponseFor<"/api/users/me/merchant-rules", "post">>("/users/me/merchant-rules", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateMerchantRule: (
    ruleId: string,
    payload: RequestFor<"/api/users/me/merchant-rules/{rule_id}", "patch">
  ) =>
    request<ResponseFor<"/api/users/me/merchant-rules/{rule_id}", "patch">>(`/users/me/merchant-rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteMerchantRule: (ruleId: string) =>
    request<ResponseFor<"/api/users/me/merchant-rules/{rule_id}", "delete">>(`/users/me/merchant-rules/${ruleId}`, {
      method: "DELETE"
    }),
  getAuditEntries: (params?: { entity_type?: string; entity_id?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.entity_type) search.set("entity_type", params.entity_type);
    if (params?.entity_id) search.set("entity_id", params.entity_id);
    if (params?.limit) search.set("limit", String(params.limit));
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<ResponseFor<"/api/users/me/audit", "get">>(`/users/me/audit${suffix}`);
  },
  login: (payload: RequestFor<"/api/auth/login", "post">) =>
    request<ResponseFor<"/api/auth/login", "post">>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  register: (payload: RequestFor<"/api/auth/register", "post">) =>
    request<ResponseFor<"/api/auth/register", "post">>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  refresh: () =>
    request<ResponseFor<"/api/auth/refresh", "post">>("/auth/refresh", {
      method: "POST"
    }),
  logout: () =>
    request<ResponseFor<"/api/auth/logout", "post">>("/auth/logout", {
      method: "POST"
    }),
  getAccounts: () => request<ResponseFor<"/api/accounts", "get">>("/accounts"),
  createAccount: (payload: RequestFor<"/api/accounts", "post">) =>
    request<ResponseFor<"/api/accounts", "post">>("/accounts", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateAccount: (accountId: string, payload: components["schemas"]["AccountUpdate"]) =>
    request<components["schemas"]["AccountSummary"]>(`/accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteAccount: (accountId: string) =>
    request<components["schemas"]["MessageResponse"]>(`/accounts/${accountId}`, {
      method: "DELETE"
    }),
  getCategories: () => request<ResponseFor<"/api/categories", "get">>("/categories"),
  getTransactions: () => request<ResponseFor<"/api/transactions", "get">>("/transactions"),
  createTransaction: (payload: RequestFor<"/api/transactions", "post">) =>
    request<ResponseFor<"/api/transactions", "post">>("/transactions", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateTransaction: (transactionId: string, payload: RequestFor<"/api/transactions/{transaction_id}", "patch">) =>
    request<ResponseFor<"/api/transactions/{transaction_id}", "patch">>(`/transactions/${transactionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteTransaction: (transactionId: string) =>
    request<ResponseFor<"/api/transactions/{transaction_id}", "delete">>(`/transactions/${transactionId}`, {
      method: "DELETE"
    }),
  getBudgets: () => request<ResponseFor<"/api/budgets", "get">>("/budgets"),
  createBudget: (payload: RequestFor<"/api/budgets", "post">) =>
    request<ResponseFor<"/api/budgets", "post">>("/budgets", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getGoals: () => request<ResponseFor<"/api/goals", "get">>("/goals"),
  createGoal: (payload: RequestFor<"/api/goals", "post">) =>
    request<ResponseFor<"/api/goals", "post">>("/goals", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateGoal: (goalId: string, payload: components["schemas"]["GoalUpdate"]) =>
    request<components["schemas"]["GoalForecast"]>(`/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteGoal: (goalId: string) =>
    request<components["schemas"]["MessageResponse"]>(`/goals/${goalId}`, {
      method: "DELETE"
    }),
  contributeGoal: (goalId: string, payload: components["schemas"]["GoalContributionCreate"]) =>
    request<components["schemas"]["GoalForecast"]>(`/goals/${goalId}/contributions`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getRecurring: () => request<ResponseFor<"/api/recurring", "get">>("/recurring"),
  createRecurring: (payload: RequestFor<"/api/recurring", "post">) =>
    request<ResponseFor<"/api/recurring", "post">>("/recurring", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateRecurring: (recurringId: string, payload: RequestFor<"/api/recurring/{recurring_id}", "patch">) =>
    request<ResponseFor<"/api/recurring/{recurring_id}", "patch">>(`/recurring/${recurringId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteRecurring: (recurringId: string) =>
    request<ResponseFor<"/api/recurring/{recurring_id}", "delete">>(`/recurring/${recurringId}`, {
      method: "DELETE"
    }),
  getAssets: () => request<ResponseFor<"/api/assets", "get">>("/assets"),
  searchAssetInstruments: (assetType: components["schemas"]["AssetType"], query: string) =>
    request<ResponseFor<"/api/assets/providers/search", "get">>(
      `/assets/providers/search?asset_type=${encodeURIComponent(assetType)}&q=${encodeURIComponent(query)}`
    ),
  createAsset: (payload: RequestFor<"/api/assets", "post">) =>
    request<ResponseFor<"/api/assets", "post">>("/assets", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateAsset: (assetId: string, payload: components["schemas"]["AssetUpdate"]) =>
    request<components["schemas"]["AssetPosition"]>(`/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteAsset: (assetId: string) =>
    request<components["schemas"]["MessageResponse"]>(`/assets/${assetId}`, {
      method: "DELETE"
    }),
  syncAssetPrice: (assetId: string) =>
    request<ResponseFor<"/api/assets/{asset_id}/price/sync", "post">>(`/assets/${assetId}/price/sync`, {
      method: "POST"
    }),
  getAssetChart: (assetId: string, rangeDays: number) =>
    request<ResponseFor<"/api/assets/{asset_id}/chart", "get">>(`/assets/${assetId}/chart?range_days=${rangeDays}`),
  getDeposits: () => request<ResponseFor<"/api/deposits", "get">>("/deposits"),
  createDeposit: (payload: RequestFor<"/api/deposits", "post">) =>
    request<ResponseFor<"/api/deposits", "post">>("/deposits", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateDeposit: (depositId: string, payload: components["schemas"]["DepositUpdate"]) =>
    request<components["schemas"]["DepositSummary"]>(`/deposits/${depositId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteDeposit: (depositId: string) =>
    request<components["schemas"]["MessageResponse"]>(`/deposits/${depositId}`, {
      method: "DELETE"
    }),
  getOverview: () => request<ResponseFor<"/api/reports/overview", "get">>("/reports/overview"),
  getCashFlow: () => request<ResponseFor<"/api/reports/cash-flow", "get">>("/reports/cash-flow"),
  getCategoryDynamics: () => request<ResponseFor<"/api/reports/categories", "get">>("/reports/categories"),
  getMerchantReport: () => request<ResponseFor<"/api/reports/merchants", "get">>("/reports/merchants"),
  getNetWorthTimeline: () => request<ResponseFor<"/api/reports/net-worth", "get">>("/reports/net-worth"),
  getAllocationReport: () => request<ResponseFor<"/api/reports/allocation", "get">>("/reports/allocation"),
  exportTransactionsCsv: () => requestText("/reports/export/transactions.csv"),
  projectScenario: (payload: RequestFor<"/api/scenarios/project", "post">) =>
    request<ResponseFor<"/api/scenarios/project", "post">>("/scenarios/project", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getNotifications: () => request<ResponseFor<"/api/notifications", "get">>("/notifications"),
  readNotification: (notificationId: string) =>
    request<ResponseFor<"/api/notifications/{notification_id}/read", "post">>(`/notifications/${notificationId}/read`, {
      method: "POST"
    }),
  getAdminOutbox: () => request<ResponseFor<"/api/admin/outbox", "get">>("/admin/outbox"),
  getAdminJobs: () => request<ResponseFor<"/api/admin/jobs", "get">>("/admin/jobs"),
  processAdminOutbox: () =>
    request<ResponseFor<"/api/admin/outbox/process", "post">>("/admin/outbox/process", {
      method: "POST"
    }),
  retryFailedAdminOutbox: () =>
    request<ResponseFor<"/api/admin/outbox/retry-failed", "post">>("/admin/outbox/retry-failed", {
      method: "POST"
    }),
  getImports: () => request<ResponseFor<"/api/imports", "get">>("/imports"),
  getImportDetail: (jobId: string) => request<ResponseFor<"/api/imports/{job_id}", "get">>(`/imports/${jobId}`),
  previewImport: (payload: RequestFor<"/api/imports/preview", "post">) =>
    request<ResponseFor<"/api/imports/preview", "post">>("/imports/preview", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  applyImport: (jobId: string, payload: RequestFor<"/api/imports/{job_id}/apply", "post">) =>
    request<ResponseFor<"/api/imports/{job_id}/apply", "post">>(`/imports/${jobId}/apply`, {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

export { ApiError };
