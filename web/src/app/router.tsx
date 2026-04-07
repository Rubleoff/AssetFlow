import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "./AppShell";
import { api } from "../lib/api";
import { queryKeys } from "../lib/query";
import {
  AccountsPage,
  AdminPage,
  AssetsPage,
  DepositsPage,
  GoalsPage,
  LoginPage,
  NotificationsPage,
  OperationsPage,
  RecurringPage,
  SettingsPage
} from "../routes/pages";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.me,
        queryFn: api.me
      });
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: lazyRouteComponent(() => import("../routes/dashboard-page"), "DashboardPage")
});

const accountsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/accounts",
  component: AccountsPage
});

const operationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/operations",
  component: OperationsPage
});

const budgetsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/budgets",
  component: lazyRouteComponent(() => import("../routes/budgets-page"), "BudgetsPage")
});

const assetsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/assets",
  component: AssetsPage
});

const depositsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/deposits",
  component: DepositsPage
});

const goalsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/goals",
  component: GoalsPage
});

const recurringRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/recurring",
  component: RecurringPage
});

const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/reports",
  component: lazyRouteComponent(() => import("../routes/reports-page"), "ReportsPage")
});

const scenariosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/scenarios",
  component: lazyRouteComponent(() => import("../routes/scenarios-page"), "ScenariosPage")
});

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notifications",
  component: NotificationsPage
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage
});

const adminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/admin",
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.me,
      queryFn: api.me
    });
    if (me.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    accountsRoute,
    operationsRoute,
    budgetsRoute,
    assetsRoute,
    depositsRoute,
    goalsRoute,
    recurringRoute,
    reportsRoute,
    scenariosRoute,
    notificationsRoute,
    settingsRoute,
    adminRoute
  ])
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    queryClient: undefined!
  }
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
