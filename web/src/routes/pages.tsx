import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  ACCOUNT_PRESETS,
  ACCOUNT_TYPE_OPTIONS,
  ASSET_CHART_RANGES,
  ASSET_PRESETS,
  ASSET_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  DEPOSIT_PAYOUT_OPTIONS,
  GOAL_PRESETS,
  INSTITUTION_OPTIONS,
  OPERATION_PRESETS,
  POPULAR_MERCHANTS,
  RECURRING_PRESETS,
  TIMEZONE_OPTIONS,
  TRANSACTION_TYPE_OPTIONS
} from "../lib/catalog";
import {
  useAccountCreateMutation,
  useAccounts,
  useAdminJobs,
  useAdminOutbox,
  useAssetCreateMutation,
  useAssetChart,
  useAssetPriceSyncMutation,
  useAssets,
  useAuditEntries,
  useCategories,
  useCreateMerchantRuleMutation,
  useCurrentUser,
  useDeleteMerchantRuleMutation,
  useDeposits,
  useGoalCreateMutation,
  useGoals,
  useLoginMutation,
  useMerchantRules,
  useNotifications,
  useProcessAdminOutboxMutation,
  useReadNotificationMutation,
  useRecurring,
  useRecurringCreateMutation,
  useRegisterMutation,
  useRetryFailedAdminOutboxMutation,
  useTransactionCreateMutation,
  useTransactions,
  useUpdateMeMutation,
  useUpdateMerchantRuleMutation
} from "../lib/query";
import type { AccountSummary, AccountType, AssetChartResponse, AssetPosition, AssetType, DepositSummary, GoalForecast, RecurringSchedule, TransactionRead, TransactionType } from "../lib/types";
import { dateLabel, compactNumber, money } from "../lib/format";
import { ChoiceCards, DataTable, EmptyState, Mono, PageHeader, Pill, QuickPills, SelectMenu, StatCard, Surface } from "../components/ui";
import { ManageDrawer } from "../components/ManageDrawer";
import { GoalContributionDrawer } from "../components/GoalContributionDrawer";
import { GoalCelebrationOverlay } from "../components/GoalCelebrationOverlay";
import { EntityManageDrawer } from "../components/EntityManageDrawer";
import { presentNotification } from "../lib/notifications";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const registerSchema = loginSchema.extend({
  full_name: z.string().min(2),
  base_currency: z.string().min(3).max(6),
  timezone: z.string().min(2)
});

const accountSchema = z.object({
  name: z.string().min(2),
  type: z.custom<AccountType>(),
  currency: z.string().min(3).max(6),
  institution_name: z.string().optional(),
  opening_balance: z.coerce.number()
});

const transactionSchema = z.object({
  account_id: z.string().min(1),
  type: z.custom<TransactionType>(),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(6),
  category_id: z.string().optional(),
  merchant_name: z.string().optional(),
  description: z.string().optional(),
  transaction_date: z.string(),
  posting_date: z.string(),
  notes: z.string().optional()
});

const assetSchema = z.object({
  name: z.string().min(2),
  type: z.custom<AssetType>(),
  currency: z.string().min(3).max(6),
  symbol: z.string().optional(),
  quantity: z.coerce.number().nonnegative(),
  average_buy_price: z.coerce.number().nonnegative(),
  average_buy_price_in_base: z.coerce.number().nonnegative(),
  current_price: z.coerce.number().nonnegative(),
  current_price_in_base: z.coerce.number().nonnegative(),
  invested_amount_in_base: z.coerce.number().nonnegative()
});

const goalSchema = z.object({
  title: z.string().min(2),
  target_amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(6),
  target_amount_in_base_currency: z.coerce.number().positive(),
  deadline: z.string(),
  monthly_contribution_target: z.coerce.number().positive()
});

const recurringSchema = z.object({
  name: z.string().min(2),
  account_id: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(6),
  amount_in_base_currency: z.coerce.number().positive(),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  next_due_date: z.string()
});

const settingsSchema = z.object({
  full_name: z.string().min(2),
  base_currency: z.string().min(3).max(6),
  timezone: z.string().min(2),
  daily_digest: z.boolean().default(true),
  anomaly_alerts: z.boolean().default(true),
  csv_delimiter: z.string().min(1).max(1),
  default_import_type: z.enum(["expense", "income"])
});

const merchantRuleSchema = z.object({
  pattern: z.string().min(2),
  category_id: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(1000),
  is_active: z.boolean().default(true)
});

const today = new Date().toISOString().slice(0, 10);

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLoginMutation();
  const register = useRegisterMutation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(mode === "login" ? loginSchema : registerSchema),
    defaultValues: {
      email: "demo@example.com",
      password: "strong-pass-123",
      full_name: "Игорь",
      base_currency: "RUB",
      timezone: "Europe/Moscow"
    }
  });

  const submit = form.handleSubmit(async (values) => {
    if (mode === "login") {
      await login.mutateAsync({ email: values.email, password: values.password });
    } else {
      await register.mutateAsync({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        base_currency: values.base_currency,
        timezone: values.timezone
      });
    }
    await navigate({ to: "/" });
  });

  return (
    <div className="auth-page">
      <Surface className="auth-panel auth-panel-wide">
        <div className="auth-hero">
          <div>
            <span className="page-eyebrow">AssetFlow</span>
            <h1>Личная финансовая система без ощущения банковской формы.</h1>
            <p>Счета, активы, цели, поведение расходов и прогноз в одном рабочем интерфейсе.</p>
          </div>
          <div className="auth-badges">
            <Pill tone="blue">RUB / USD / EUR / USDT</Pill>
            <Pill tone="neutral">Cookie auth</Pill>
            <Pill tone="neutral">FastAPI + React</Pill>
          </div>
        </div>

        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Вход
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Регистрация
          </button>
        </div>

        <form className="form-grid auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <label>
              <span>Как к вам обращаться</span>
              <input {...form.register("full_name")} placeholder="Например, Игорь" />
            </label>
          ) : null}
          <label>
            <span>Email</span>
            <input {...form.register("email")} />
          </label>
          <label>
            <span>Пароль</span>
            <input type="password" {...form.register("password")} />
          </label>

          {mode === "register" ? (
            <>
              <div>
                <span className="form-label">Базовая валюта</span>
                <SelectMenu
                  value={form.watch("base_currency")}
                  onChange={(value) => form.setValue("base_currency", value)}
                  options={CURRENCY_OPTIONS.map((item) => ({
                    value: item.code,
                    label: `${item.code} · ${item.label}`,
                    hint: item.symbol
                  }))}
                  searchable
                />
              </div>
              <div>
                <span className="form-label">Часовой пояс</span>
                <SelectMenu
                  value={form.watch("timezone")}
                  onChange={(value) => form.setValue("timezone", value)}
                  options={TIMEZONE_OPTIONS.map((item) => ({
                    value: item,
                    label: item,
                    hint: item.includes("Moscow") ? "МСК" : "Timezone"
                  }))}
                  searchable
                />
              </div>
              <QuickPills
                items={CURRENCY_OPTIONS.slice(0, 5).map((item) => ({ value: item.code, label: `${item.code} · ${item.label}` }))}
                onPick={(value) => form.setValue("base_currency", value)}
              />
            </>
          ) : null}

          <button type="submit" className="primary-button" disabled={login.isPending || register.isPending}>
            {mode === "login" ? "Открыть рабочее пространство" : "Создать пространство"}
          </button>
        </form>

      </Surface>
    </div>
  );
}

export function AccountsPage() {
  const accounts = useAccounts();
  const [activeAccount, setActiveAccount] = useState<AccountSummary | null>(null);
  const [accountDrawerTab, setAccountDrawerTab] = useState<"edit" | "delete">("edit");

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Счета"
        title="Счета"
        description="Карты, наличные, накопления, кредиты и валютные остатки."
      />

      <div className="content-grid">
        <Surface className="span-3">
          <div className="panel-header">
            <div>
              <span className="kicker">Список счетов</span>
              <h3>Текущие контейнеры капитала и обязательств</h3>
            </div>
          </div>
          <DataTable
            columns={["Счёт", "Тип", "Организация", "Остаток", "Статус", "Действия"]}
            rows={(accounts.data ?? []).map((account) => [
              <div key={`${account.id}-name`}><strong>{account.name}</strong><div className="subtle">{account.currency}</div></div>,
              ACCOUNT_TYPE_OPTIONS.find((item) => item.value === account.type)?.label ?? account.type,
              account.institution_name ?? "Личный",
              <Mono key={`${account.id}-balance`}>{money(account.current_balance, account.currency)}</Mono>,
              <div key={`${account.id}-flags`} className="inline-pills">
                {account.include_in_liquid_balance ? <Pill tone="blue">Ликвидный</Pill> : null}
                {account.include_in_net_worth ? <Pill tone="neutral">В капитале</Pill> : null}
              </div>,
              <div key={`${account.id}-actions`} className="table-actions">
                <button
                  type="button"
                  className="ghost-button table-action-button"
                  onClick={() => {
                    setAccountDrawerTab("edit");
                    setActiveAccount(account);
                  }}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="ghost-button table-action-button danger-button"
                  onClick={() => {
                    setAccountDrawerTab("delete");
                    setActiveAccount(account);
                  }}
                >
                  Убрать
                </button>
              </div>
            ])}
          />
        </Surface>

      </div>

      <EntityManageDrawer
        open={Boolean(activeAccount)}
        record={activeAccount ? { kind: "account", item: activeAccount } : null}
        defaultTab={accountDrawerTab}
        onClose={() => setActiveAccount(null)}
      />

      <datalist id="institution-options">
        {INSTITUTION_OPTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
}

export function OperationsPage() {
  const transactions = useTransactions();
  const user = useCurrentUser();
  const [search, setSearch] = useState("");
  const [activeTransaction, setActiveTransaction] = useState<TransactionRead | null>(null);
  const [transactionDrawerTab, setTransactionDrawerTab] = useState<"edit" | "delete">("edit");
  const currency = user.data?.base_currency ?? "RUB";
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (transactions.data ?? []).filter((transaction) => {
      if (!query) return true;
      return `${transaction.merchant_name ?? ""} ${transaction.description ?? ""} ${transaction.type}`.toLowerCase().includes(query);
    });
  }, [search, transactions.data]);
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, transaction) => {
        acc.records += 1;
        if (transaction.type === "income") acc.income += Number(transaction.amount_in_base_currency);
        if (["expense", "fee", "tax", "debt_payment", "asset_buy"].includes(transaction.type)) {
          acc.expense += Number(transaction.amount_in_base_currency);
        }
        return acc;
      },
      { records: 0, income: 0, expense: 0 }
    );
  }, [filtered]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Операции"
        title="Операции"
        description="Доходы, расходы, комиссии и покупки активов в одном месте."
      />

      <div className="content-grid">
        <Surface className="span-3">
          <div className="panel-header">
            <div>
              <span className="kicker">История</span>
              <h3>Последние операции по всем счетам</h3>
            </div>
            <input className="toolbar-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по мерчанту, типу или описанию" />
          </div>
          <div className="section-metrics">
            <div className="section-metric">
              <span>Записей</span>
              <strong>{compactNumber(totals.records)}</strong>
            </div>
            <div className="section-metric">
              <span>Доходы</span>
              <strong>{money(totals.income, currency)}</strong>
            </div>
            <div className="section-metric">
              <span>Расходы</span>
              <strong>{money(totals.expense, currency)}</strong>
            </div>
          </div>
          <DataTable
            columns={["Дата", "Мерчант", "Тип", "Сумма", "Описание", "Действия"]}
            rows={filtered.map((transaction) => [
              dateLabel(transaction.transaction_date),
              <div key={`${transaction.id}-merchant`} className="table-primary-cell">
                <strong>{transaction.merchant_name ?? "Ручная запись"}</strong>
                <span>{transaction.category_id ? "С категорией" : "Без категории"}</span>
              </div>,
              TRANSACTION_TYPE_OPTIONS.find((item) => item.value === transaction.type)?.label ?? transaction.type,
              <Mono key={`${transaction.id}-amount`}>{money(transaction.amount_in_base_currency, transaction.currency)}</Mono>,
              transaction.description ?? "Без описания",
              <div key={`${transaction.id}-actions`} className="table-actions">
                {transaction.type === "transfer_in" || transaction.type === "transfer_out" ? (
                  <span className="table-action-muted">Для перевода откройте связанное движение</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ghost-button table-action-button"
                      onClick={() => {
                        setTransactionDrawerTab("edit");
                        setActiveTransaction(transaction);
                      }}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="ghost-button table-action-button danger-button"
                      onClick={() => {
                        setTransactionDrawerTab("delete");
                        setActiveTransaction(transaction);
                      }}
                    >
                      Удалить
                    </button>
                  </>
                )}
              </div>
            ])}
          />
        </Surface>

      </div>

      <ManageDrawer
        open={Boolean(activeTransaction)}
        record={activeTransaction ? { kind: "transaction", item: activeTransaction } : null}
        defaultTab={transactionDrawerTab}
        onClose={() => setActiveTransaction(null)}
      />

      <datalist id="merchant-options">
        {POPULAR_MERCHANTS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
}

export function AssetsPage() {
  const user = useCurrentUser();
  const assets = useAssets();
  const syncAssetPrice = useAssetPriceSyncMutation();
  const currency = user.data?.base_currency ?? "RUB";
  const [activeAsset, setActiveAsset] = useState<AssetPosition | null>(null);
  const [managedAsset, setManagedAsset] = useState<AssetPosition | null>(null);
  const [assetDrawerTab, setAssetDrawerTab] = useState<"edit" | "delete">("edit");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const chart = useAssetChart(activeAsset?.id ?? null, rangeDays);
  const totalValue = useMemo(
    () => (assets.data ?? []).reduce((sum, asset) => sum + Number(asset.current_value_in_base), 0),
    [assets.data]
  );
  const trackedCount = useMemo(
    () => (assets.data ?? []).filter((asset) => asset.tracking_enabled).length,
    [assets.data]
  );
  const rentalIncome = useMemo(
    () => (assets.data ?? []).reduce((sum, asset) => sum + Number(asset.rental_income_monthly ?? 0), 0),
    [assets.data]
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Активы"
        description="Рыночные позиции, валюта, металлы и недвижимость с арендой."
      />

      <div className="content-grid">
        <Surface className="span-3">
          <div className="panel-header">
            <div>
              <span className="kicker">Портфель</span>
              <h3>Текущие активы и их рыночная оценка</h3>
            </div>
          </div>
          <div className="section-metrics">
            <div className="section-metric">
              <span>Всего в активах</span>
              <strong>{money(totalValue, currency)}</strong>
            </div>
            <div className="section-metric">
              <span>Отслеживаются автоматически</span>
              <strong>{trackedCount}</strong>
            </div>
            <div className="section-metric">
              <span>Аренда в месяц</span>
              <strong>{money(rentalIncome, currency)}</strong>
            </div>
          </div>
          <DataTable
            columns={["Актив", "Класс", "Цена", "Стоимость", "Особенности", "Действия"]}
            rows={(assets.data ?? []).map((asset) => [
              <div key={`${asset.id}-asset`} className="table-primary-cell">
                <strong>{asset.name}</strong>
                <span>{asset.symbol ?? "Без тикера"} · {asset.linked_account_name ?? "Связанный счёт создаётся автоматически"}</span>
              </div>,
              ASSET_TYPE_OPTIONS.find((item) => item.value === asset.type)?.label ?? asset.type,
              <div key={`${asset.id}-price`} className="table-primary-cell">
                <Mono>{money(asset.current_price_in_base, currency)}</Mono>
                <span>{asset.tracking_enabled ? (asset.tracking_provider === "coingecko" ? "CoinGecko" : "Twelve Data") : "Ручная цена"}</span>
              </div>,
              <div key={`${asset.id}-value`} className="table-primary-cell">
                <Mono>{money(asset.current_value_in_base, currency)}</Mono>
                <span className={asset.unrealized_pnl >= 0 ? "text-blue" : "text-dark"}>
                  {asset.unrealized_pnl >= 0 ? "+" : ""}{money(asset.unrealized_pnl, currency)} · {asset.allocation_pct}%
                </span>
              </div>,
              <div key={`${asset.id}-meta`} className="table-primary-cell">
                <span>
                  {asset.rental_enabled
                    ? `Сдаётся за ${money(asset.rental_income_monthly, currency)} в месяц`
                    : asset.tracking_enabled
                      ? "Цена обновляется по рынку"
                      : "Оценка вводится вручную"}
                </span>
                <span>
                  {asset.rental_enabled && asset.rental_payment_day
                    ? `Оплата ${asset.rental_payment_day}-го числа`
                    : `Количество: ${asset.quantity}`}
                </span>
              </div>,
              <div key={`${asset.id}-actions`} className="table-actions">
                <button
                  type="button"
                  className="ghost-button table-action-button"
                  onClick={() => {
                    setAssetDrawerTab("edit");
                    setManagedAsset(asset);
                  }}
                >
                  Изменить
                </button>
                <button type="button" className="ghost-button table-action-button" onClick={() => setActiveAsset(asset)}>
                  График
                </button>
                {asset.tracking_enabled ? (
                  <button
                    type="button"
                    className="ghost-button table-action-button"
                    onClick={() => syncAssetPrice.mutate(asset.id)}
                    disabled={syncAssetPrice.isPending}
                  >
                    Обновить цену
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-button table-action-button danger-button"
                  onClick={() => {
                    setAssetDrawerTab("delete");
                    setManagedAsset(asset);
                  }}
                >
                  Убрать
                </button>
              </div>
            ])}
          />
        </Surface>

      </div>

      <EntityManageDrawer
        open={Boolean(managedAsset)}
        record={managedAsset ? { kind: "asset", item: managedAsset } : null}
        defaultTab={assetDrawerTab}
        onClose={() => setManagedAsset(null)}
      />

      <datalist id="asset-symbols">
        {ASSET_PRESETS.map((item) => (
          <option key={item.symbol} value={item.symbol} />
        ))}
      </datalist>

      {activeAsset ? (
        <div className="drawer-backdrop" onClick={() => setActiveAsset(null)}>
          <aside className="create-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span className="kicker">График цены</span>
                <h3>{activeAsset.name}</h3>
                <p>
                  {activeAsset.tracking_enabled
                    ? "Рыночная цена и динамика по выбранному сроку."
                    : "Для этого актива доступна только ручная история цен."}
                </p>
              </div>
              <button type="button" className="icon-button" onClick={() => setActiveAsset(null)} aria-label="Закрыть">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" fill="currentColor" />
                </svg>
              </button>
            </div>
            <div className="drawer-body">
              <Surface>
                <div className="drawer-tabs">
                  {ASSET_CHART_RANGES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`quick-pill ${rangeDays === item.value ? "active-tab" : ""}`}
                      onClick={() => setRangeDays(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="section-metrics">
                  <div className="section-metric">
                    <span>Текущая цена</span>
                    <strong>{money(activeAsset.current_price_in_base, currency)}</strong>
                  </div>
                  <div className="section-metric">
                    <span>Стоимость позиции</span>
                    <strong>{money(activeAsset.current_value_in_base, currency)}</strong>
                  </div>
                  <div className="section-metric">
                    <span>Источник</span>
                    <strong>
                      {activeAsset.tracking_enabled
                        ? activeAsset.tracking_provider === "coingecko"
                          ? "CoinGecko"
                          : "Twelve Data"
                        : "ручной"}
                    </strong>
                  </div>
                </div>
                {chart.data?.points?.length ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chart.data.points}>
                      <CartesianGrid stroke="#d7deeb" strokeDasharray="4 4" />
                      <XAxis dataKey="date" tickFormatter={dateLabel} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="price_in_base" stroke="#0052ff" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title={chart.isLoading ? "Загружаем график" : "График пока пустой"}
                    body={chart.isLoading ? "Подтягиваем историю цены по выбранному сроку." : "Добавьте цену вручную или настройте провайдер."}
                  />
                )}
              </Surface>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export function DepositsPage() {
  const deposits = useDeposits();
  const user = useCurrentUser();
  const [activeDeposit, setActiveDeposit] = useState<DepositSummary | null>(null);
  const [depositDrawerTab, setDepositDrawerTab] = useState<"edit" | "delete">("edit");
  const maxRate = useMemo(
    () => Math.max(0, ...(deposits.data ?? []).map((item) => Number(item.annual_interest_rate))),
    [deposits.data]
  );
  const nearestPayout = useMemo(() => {
    const rows = (deposits.data ?? []).filter((item) => item.next_payout_date);
    return rows.sort((left, right) => String(left.next_payout_date).localeCompare(String(right.next_payout_date)))[0]?.next_payout_date ?? null;
  }, [deposits.data]);
  const currency = user.data?.base_currency ?? "RUB";

  return (
    <div className="page-stack">
      <PageHeader title="Вклады" description="Открытые вклады, ставка, срок, проценты и связанный счёт." />
      <div className="content-grid">
        <Surface className="span-3">
          <div className="panel-header">
            <div>
              <span className="kicker">Депозитный контур</span>
              <h3>Все активные вклады и их условия</h3>
            </div>
          </div>
          <div className="section-metrics">
            <div className="section-metric">
              <span>Открыто вкладов</span>
              <strong>{deposits.data?.length ?? 0}</strong>
            </div>
            <div className="section-metric">
              <span>Лучшая ставка</span>
              <strong>{maxRate.toFixed(2)}%</strong>
            </div>
            <div className="section-metric">
              <span>Ближайшая выплата</span>
              <strong>{nearestPayout ? dateLabel(nearestPayout) : "Нет даты"}</strong>
            </div>
          </div>
          <DataTable
            columns={["Вклад", "Ставка", "Баланс", "Проценты", "Срок", "Счета", "Действия"]}
            rows={(deposits.data ?? []).map((deposit) => [
              <div key={`${deposit.id}-name`} className="table-primary-cell">
                <strong>{deposit.name}</strong>
                <span>{deposit.institution_name ?? "Банк"} · {deposit.status === "open" ? "Открыт" : deposit.status}</span>
              </div>,
              <div key={`${deposit.id}-rate`} className="table-primary-cell">
                <strong>{deposit.annual_interest_rate}%</strong>
                <span>{deposit.capitalization_enabled ? "С капитализацией" : "Без капитализации"}</span>
              </div>,
              <div key={`${deposit.id}-balance`} className="table-primary-cell">
                <Mono>{money(deposit.current_balance, deposit.currency)}</Mono>
                <span>Старт: {money(deposit.principal_amount, deposit.currency)}</span>
              </div>,
              <div key={`${deposit.id}-payout`} className="table-primary-cell">
                <span>
                  {deposit.payout_frequency === "monthly"
                    ? "Каждый месяц"
                    : deposit.payout_frequency === "quarterly"
                      ? "Раз в квартал"
                      : "В конце срока"}
                </span>
                <span>{deposit.next_payout_date ? `Следующая дата: ${dateLabel(deposit.next_payout_date)}` : "Даты пока нет"}</span>
              </div>,
              <div key={`${deposit.id}-term`} className="table-primary-cell">
                <span>Открыт: {dateLabel(deposit.opened_on)}</span>
                <span>{deposit.maturity_date ? `Закрытие: ${dateLabel(deposit.maturity_date)}` : "Без даты закрытия"}</span>
              </div>,
              <div key={`${deposit.id}-accounts`} className="table-primary-cell">
                <span>Счёт вклада: {deposit.account_name}</span>
                <span>{deposit.funding_account_name ? `Пополнение: ${deposit.funding_account_name}` : "Без привязки к исходному счёту"}</span>
              </div>,
              <div key={`${deposit.id}-actions`} className="table-actions">
                <button
                  type="button"
                  className="ghost-button table-action-button"
                  onClick={() => {
                    setDepositDrawerTab("edit");
                    setActiveDeposit(deposit);
                  }}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="ghost-button table-action-button danger-button"
                  onClick={() => {
                    setDepositDrawerTab("delete");
                    setActiveDeposit(deposit);
                  }}
                >
                  Убрать
                </button>
              </div>
            ])}
          />
        </Surface>
      </div>

      <EntityManageDrawer
        open={Boolean(activeDeposit)}
        record={activeDeposit ? { kind: "deposit", item: activeDeposit } : null}
        defaultTab={depositDrawerTab}
        onClose={() => setActiveDeposit(null)}
      />
    </div>
  );
}

export function GoalsPage() {
  const user = useCurrentUser();
  const goals = useGoals();
  const currency = user.data?.base_currency ?? "RUB";
  const [activeGoal, setActiveGoal] = useState<GoalForecast | null>(null);
  const [managedGoal, setManagedGoal] = useState<GoalForecast | null>(null);
  const [goalDrawerDirection, setGoalDrawerDirection] = useState<"fund" | "withdraw">("fund");
  const [goalManageTab, setGoalManageTab] = useState<"edit" | "delete">("edit");
  const [celebrationGoal, setCelebrationGoal] = useState<GoalForecast | null>(null);
  const statusLabel: Record<string, string> = {
    active: "В работе",
    completed: "Готово",
    paused: "На паузе",
    archived: "В архиве"
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Цели"
        description="Подушка, крупные покупки и накопления с понятным прогрессом."
      />
      <div className="content-grid">
        <Surface className="span-3">
          <div className="stack-list">
            {(goals.data ?? []).map((goal) => (
              <article key={goal.id} className="goal-card">
                <div className="goal-head">
                  <div>
                    <strong>{goal.title}</strong>
                    <p>{money(goal.saved_amount, currency)} из {money(goal.target_amount, currency)}</p>
                  </div>
                  <Pill tone={goal.progress_pct >= 100 ? "success" : "blue"}>{statusLabel[goal.status] ?? goal.status}</Pill>
                </div>
                <div className="progress-bar"><span style={{ width: `${Math.min(goal.progress_pct, 100)}%` }} /></div>
                <div className="goal-progress-line">
                  <strong>{goal.progress_pct}%</strong>
                  <span>профинансировано</span>
                </div>
                <div className="goal-metrics-grid">
                  <div className="goal-metric-tile">
                    <span>Осталось</span>
                    <strong>{money(goal.remaining_amount, currency)}</strong>
                  </div>
                  <div className="goal-metric-tile">
                    <span>Комфортный взнос</span>
                    <strong>{money(goal.required_monthly_contribution, currency)}/мес</strong>
                  </div>
                  <div className="goal-metric-tile">
                    <span>Оценка срока</span>
                    <strong>{goal.projected_completion_months ?? "н/д"} мес</strong>
                  </div>
                </div>
                <div className="goal-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setGoalDrawerDirection("fund");
                      setActiveGoal(goal);
                    }}
                  >
                    Пополнить цель
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setGoalDrawerDirection("withdraw");
                      setActiveGoal(goal);
                    }}
                  >
                    Забрать из цели
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setGoalManageTab("edit");
                      setManagedGoal(goal);
                    }}
                  >
                    Изменить
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Surface>
      </div>

      <GoalContributionDrawer
        open={Boolean(activeGoal)}
        goal={activeGoal}
        currency={currency}
        defaultDirection={goalDrawerDirection}
        onSuccess={(updatedGoal, direction) => {
          const wasCompleted =
            Number(activeGoal?.saved_amount ?? 0) >= Number(activeGoal?.target_amount ?? 0) &&
            Number(activeGoal?.target_amount ?? 0) > 0;
          const isCompleted =
            Number(updatedGoal.saved_amount ?? 0) >= Number(updatedGoal.target_amount ?? 0) &&
            Number(updatedGoal.target_amount ?? 0) > 0;
          if (direction === "fund" && !wasCompleted && isCompleted) {
            setCelebrationGoal(updatedGoal);
          }
        }}
        onClose={() => setActiveGoal(null)}
      />
      <GoalCelebrationOverlay
        open={Boolean(celebrationGoal)}
        goal={celebrationGoal}
        currency={currency}
        onClose={() => setCelebrationGoal(null)}
      />
      <EntityManageDrawer
        open={Boolean(managedGoal)}
        record={managedGoal ? { kind: "goal", item: managedGoal } : null}
        defaultTab={goalManageTab}
        onClose={() => setManagedGoal(null)}
      />
    </div>
  );
}

export function RecurringPage() {
  const recurring = useRecurring();
  const user = useCurrentUser();
  const [activeRecurring, setActiveRecurring] = useState<RecurringSchedule | null>(null);
  const [recurringDrawerTab, setRecurringDrawerTab] = useState<"edit" | "delete">("edit");
  const currency = user.data?.base_currency ?? "RUB";
  const monthlyBurden = useMemo(() => {
    return (recurring.data ?? []).reduce((sum, item) => {
      if (item.frequency === "weekly") return sum + Number(item.amount_in_base_currency) * 4.33;
      if (item.frequency === "yearly") return sum + Number(item.amount_in_base_currency) / 12;
      return sum + Number(item.amount_in_base_currency);
    }, 0);
  }, [recurring.data]);
  const nearestDue = useMemo(() => {
    const sorted = [...(recurring.data ?? [])].sort((left, right) => left.next_due_date.localeCompare(right.next_due_date));
    return sorted[0]?.next_due_date ?? null;
  }, [recurring.data]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Регулярные платежи"
        title="Регулярные платежи"
        description="Подписки, аренда, связь и другие повторяющиеся списания."
      />
      <div className="content-grid">
        <Surface className="span-3">
          <div className="panel-header">
            <div>
              <span className="kicker">Расписание</span>
              <h3>Все повторяющиеся списания в одном списке</h3>
            </div>
          </div>
          <div className="section-metrics">
            <div className="section-metric">
              <span>Активных</span>
              <strong>{compactNumber((recurring.data ?? []).length)}</strong>
            </div>
            <div className="section-metric">
              <span>Нагрузка в месяц</span>
              <strong>{money(monthlyBurden, currency)}</strong>
            </div>
            <div className="section-metric">
              <span>Ближайшее списание</span>
              <strong>{nearestDue ? dateLabel(nearestDue) : "Нет дат"}</strong>
            </div>
          </div>
          <DataTable
            columns={["Название", "Сумма", "Период", "Следующее списание", "Напоминание", "Действия"]}
            rows={(recurring.data ?? []).map((item) => [
              <div key={`${item.id}-name`} className="table-primary-cell">
                <strong>{item.name}</strong>
                <span>{item.merchant_name ?? "Без мерчанта"}</span>
              </div>,
              <Mono key={`${item.id}-amount`}>{money(item.amount, item.currency)}</Mono>,
              item.frequency === "monthly" ? "Ежемесячно" : item.frequency === "weekly" ? "Еженедельно" : "Ежегодно",
              dateLabel(item.next_due_date),
              `${item.reminder_days_before} дн.`,
              <div key={`${item.id}-actions`} className="table-actions">
                <button
                  type="button"
                  className="ghost-button table-action-button"
                  onClick={() => {
                    setRecurringDrawerTab("edit");
                    setActiveRecurring(item);
                  }}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="ghost-button table-action-button danger-button"
                  onClick={() => {
                    setRecurringDrawerTab("delete");
                    setActiveRecurring(item);
                  }}
                >
                  Удалить
                </button>
              </div>
            ])}
          />
        </Surface>
      </div>

      <ManageDrawer
        open={Boolean(activeRecurring)}
        record={activeRecurring ? { kind: "recurring", item: activeRecurring } : null}
        defaultTab={recurringDrawerTab}
        onClose={() => setActiveRecurring(null)}
      />
    </div>
  );
}

export function NotificationsPage() {
  const notifications = useNotifications();
  const readMutation = useReadNotificationMutation();
  return (
    <div className="page-stack">
      <PageHeader title="Уведомления" description="Напоминания, сигналы и короткие подсказки по вашим данным." />
      <div className="stack-list">
        {(notifications.data ?? []).map((notification) => {
          const view = presentNotification(notification);
          return (
          <Surface key={notification.id} className="notification-card">
            <div className="panel-header">
              <div>
                <Pill tone={notification.is_read ? "neutral" : "blue"}>{view.badge}</Pill>
                <h3>{view.title}</h3>
              </div>
              {!notification.is_read ? (
                <button className="ghost-button" onClick={() => readMutation.mutate(notification.id)}>
                  Прочитано
                </button>
              ) : null}
            </div>
            <p>{view.body}</p>
          </Surface>
        )})}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const user = useCurrentUser();
  const categories = useCategories();
  const merchantRules = useMerchantRules();
  const auditEntries = useAuditEntries();
  const updateMe = useUpdateMeMutation();
  const createMerchantRule = useCreateMerchantRuleMutation();
  const updateMerchantRule = useUpdateMerchantRuleMutation();
  const deleteMerchantRule = useDeleteMerchantRuleMutation();
  const categoryOptions = (categories.data ?? []) as Array<{ id: string; name: string }>;
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const settingsForm = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      full_name: "",
      base_currency: "RUB",
      timezone: "Europe/Moscow",
      daily_digest: true,
      anomaly_alerts: true,
      csv_delimiter: ",",
      default_import_type: "expense"
    }
  });

  const merchantRuleForm = useForm<z.infer<typeof merchantRuleSchema>>({
    resolver: zodResolver(merchantRuleSchema),
    defaultValues: {
      pattern: "",
      category_id: "",
      priority: 100,
      is_active: true
    }
  });

  useEffect(() => {
    if (!user.data) return;
    settingsForm.reset({
      full_name: user.data.full_name,
      base_currency: user.data.base_currency,
      timezone: user.data.timezone,
      daily_digest: Boolean(user.data.notification_preferences?.daily_digest ?? true),
      anomaly_alerts: Boolean(user.data.notification_preferences?.anomaly_alerts ?? true),
      csv_delimiter: String(user.data.import_preferences?.csv_delimiter ?? ","),
      default_import_type: user.data.import_preferences?.default_import_type === "income" ? "income" : "expense"
    });
  }, [settingsForm, user.data]);

  useEffect(() => {
    if (!editingRuleId) {
      merchantRuleForm.reset({
        pattern: "",
        category_id: "",
        priority: 100,
        is_active: true
      });
      return;
    }
    const rule = merchantRules.data?.find((item) => item.id === editingRuleId);
    if (!rule) return;
    merchantRuleForm.reset({
      pattern: rule.pattern,
      category_id: rule.category_id ?? "",
      priority: rule.priority,
      is_active: rule.is_active
    });
  }, [editingRuleId, merchantRuleForm, merchantRules.data]);

  if (!user.data) {
    return <EmptyState title="Нет активной сессии" body="Авторизуйтесь, чтобы открыть настройки." />;
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Настройки" title="Настройки" description="Локаль, уведомления и правила для автокатегоризации." />
      <div className="content-grid">
        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Профиль</span><h3>Личные настройки</h3></div></div>
          <form
            className="form-grid"
            onSubmit={settingsForm.handleSubmit(async (values) =>
              updateMe.mutateAsync({
                full_name: values.full_name,
                base_currency: values.base_currency,
                timezone: values.timezone,
                notification_preferences: {
                  daily_digest: values.daily_digest,
                  anomaly_alerts: values.anomaly_alerts
                },
                import_preferences: {
                  csv_delimiter: values.csv_delimiter,
                  default_import_type: values.default_import_type
                }
              })
            )}
          >
            <div className="two-column-grid">
              <label><span>Имя</span><input {...settingsForm.register("full_name")} /></label>
              <label><span>Email</span><input value={user.data.email} readOnly /></label>
            </div>
            <div className="two-column-grid">
              <div>
                <span className="form-label">Базовая валюта</span>
                <SelectMenu
                  value={settingsForm.watch("base_currency")}
                  onChange={(value) => settingsForm.setValue("base_currency", value)}
                  options={CURRENCY_OPTIONS.map((item) => ({
                    value: item.code,
                    label: `${item.code} · ${item.label}`,
                    hint: item.symbol
                  }))}
                  searchable
                />
              </div>
              <div>
                <span className="form-label">Часовой пояс</span>
                <SelectMenu
                  value={settingsForm.watch("timezone")}
                  onChange={(value) => settingsForm.setValue("timezone", value)}
                  options={TIMEZONE_OPTIONS.map((item) => ({
                    value: item,
                    label: item,
                    hint: item.includes("Moscow") ? "МСК" : "Timezone"
                  }))}
                  searchable
                />
              </div>
            </div>
            <QuickPills items={CURRENCY_OPTIONS.slice(0, 6).map((item) => ({ value: item.code }))} onPick={(value) => settingsForm.setValue("base_currency", value)} />
            <div className="two-column-grid">
              <label className="checkbox-row"><span>Ежедневный дайджест</span><input type="checkbox" {...settingsForm.register("daily_digest")} /></label>
              <label className="checkbox-row"><span>Сигналы аномалий</span><input type="checkbox" {...settingsForm.register("anomaly_alerts")} /></label>
            </div>
            <div className="two-column-grid">
              <label><span>CSV-разделитель</span><input {...settingsForm.register("csv_delimiter")} /></label>
              <div>
                <span className="form-label">Тип импорта по умолчанию</span>
                <SelectMenu
                  value={settingsForm.watch("default_import_type")}
                  onChange={(value) => settingsForm.setValue("default_import_type", value as "expense" | "income")}
                  options={[
                    { value: "expense", label: "Расход", hint: "Для банковских списаний" },
                    { value: "income", label: "Доход", hint: "Для поступлений и выплат" }
                  ]}
                />
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={updateMe.isPending}>Сохранить настройки</button>
          </form>
        </Surface>

        <Surface>
          <span className="kicker">Профиль</span>
          <h3>{user.data.full_name}</h3>
          <p>{user.data.email}</p>
          <div className="stack-list profile-boxes">
            <div><span className="kicker">Основная валюта</span><h3>{user.data.base_currency}</h3></div>
            <div><span className="kicker">Часовой пояс</span><h3>{user.data.timezone}</h3></div>
          </div>
        </Surface>

        <Surface>
          <div className="panel-header"><div><span className="kicker">Правило мерчанта</span><h3>{editingRuleId ? "Редактирование" : "Новая автокатегоризация"}</h3></div></div>
          <form
            className="form-grid"
            onSubmit={merchantRuleForm.handleSubmit(async (values) => {
              const payload = {
                pattern: values.pattern,
                category_id: values.category_id || null,
                tag_names: [],
                priority: values.priority,
                is_active: values.is_active
              };
              if (editingRuleId) {
                await updateMerchantRule.mutateAsync({ ruleId: editingRuleId, payload });
              } else {
                await createMerchantRule.mutateAsync(payload);
              }
              setEditingRuleId(null);
            })}
          >
            <label><span>Паттерн мерчанта</span><input placeholder="vkusvill / yandex go / spotify" {...merchantRuleForm.register("pattern")} /></label>
            <div>
              <span className="form-label">Категория</span>
              <SelectMenu
                value={merchantRuleForm.watch("category_id") ?? ""}
                onChange={(value) => merchantRuleForm.setValue("category_id", value)}
                options={[
                  { value: "", label: "Не назначать", hint: "Оставить без категории" },
                  ...categoryOptions.map((category) => ({
                    value: category.id,
                    label: category.name,
                    hint: "Категория"
                  }))
                ]}
              />
            </div>
            <label><span>Приоритет</span><input type="number" {...merchantRuleForm.register("priority")} /></label>
            <label className="checkbox-row"><span>Правило активно</span><input type="checkbox" {...merchantRuleForm.register("is_active")} /></label>
            <div className="inline-pills">
              <button className="primary-button" type="submit" disabled={createMerchantRule.isPending || updateMerchantRule.isPending}>
                {editingRuleId ? "Обновить правило" : "Создать правило"}
              </button>
              {editingRuleId ? (
                <button className="ghost-button" type="button" onClick={() => setEditingRuleId(null)}>Сбросить</button>
              ) : null}
            </div>
          </form>
        </Surface>

        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Память мерчантов</span><h3>Сохранённые правила автоматической категории</h3></div></div>
          <DataTable
            columns={["Паттерн", "Категория", "Приоритет", "Активно", "Действия"]}
            rows={(merchantRules.data ?? []).map((rule) => [
              rule.pattern,
              categoryOptions.find((category) => category.id === rule.category_id)?.name ?? "Не назначена",
              String(rule.priority),
              rule.is_active ? "Да" : "Нет",
              <div key={rule.id} className="inline-pills">
                <button className="ghost-button" type="button" onClick={() => setEditingRuleId(rule.id)}>Изменить</button>
                <button className="ghost-button" type="button" onClick={() => deleteMerchantRule.mutate(rule.id)}>Удалить</button>
              </div>
            ])}
          />
        </Surface>

        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Аудит</span><h3>Последние пользовательские изменения</h3></div></div>
          <DataTable
            columns={["Когда", "Сущность", "Действие", "До", "После"]}
            rows={(auditEntries.data ?? []).map((entry) => [
              dateLabel(entry.occurred_at),
              `${entry.entity_type}:${entry.entity_id.slice(0, 8)}`,
              entry.action,
              <Mono key={`${entry.id}-before`}>{entry.before_json ? JSON.stringify(entry.before_json) : "—"}</Mono>,
              <Mono key={`${entry.id}-after`}>{entry.after_json ? JSON.stringify(entry.after_json) : "—"}</Mono>
            ])}
          />
        </Surface>
      </div>
    </div>
  );
}

export function AdminPage() {
  const outbox = useAdminOutbox();
  const jobs = useAdminJobs();
  const processOutbox = useProcessAdminOutboxMutation();
  const retryFailed = useRetryFailedAdminOutboxMutation();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Админ"
        title="Очередь событий и фоновые задачи"
        description="Эта вкладка скрыта для обычного пользователя и нужна только для служебного контроля."
        action={
          <div className="inline-pills">
            <button className="ghost-button" type="button" onClick={() => processOutbox.mutate()} disabled={processOutbox.isPending}>
              Обработать очередь
            </button>
            <button className="primary-button" type="button" onClick={() => retryFailed.mutate()} disabled={retryFailed.isPending}>
              Повторить failed
            </button>
          </div>
        }
      />
      <div className="stats-grid">
        <StatCard label="Обработано" value={compactNumber(jobs.data?.processed_outbox ?? 0)} />
        <StatCard label="В ожидании" value={compactNumber(jobs.data?.pending_outbox ?? 0)} />
        <StatCard label="С ошибкой" value={compactNumber(jobs.data?.failed_outbox ?? 0)} />
        <StatCard label="Уведомлений" value={compactNumber(jobs.data?.notifications_queued ?? 0)} />
      </div>
      <Surface>
        <DataTable
          columns={["Событие", "Сущность", "ID", "Попытки", "Последняя попытка", "Статус", "Ошибка"]}
          rows={(outbox.data ?? []).map((item) => [
            item.event_type,
            item.entity_type,
            <Mono key={`${item.id}-entity`}>{item.entity_id}</Mono>,
            String(item.attempts),
            item.last_attempt_at ? dateLabel(item.last_attempt_at) : "—",
            item.processed_at ? "Обработано" : "В очереди",
            item.last_error ?? "—"
          ])}
        />
      </Surface>
    </div>
  );
}
