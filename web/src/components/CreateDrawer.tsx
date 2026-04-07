import { useEffect, useState } from "react";

import {
  ACCOUNT_PRESETS,
  ACCOUNT_TYPE_OPTIONS,
  ASSET_PRESETS,
  ASSET_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  DEPOSIT_PAYOUT_OPTIONS,
  GOAL_PRESETS,
  OPERATION_PRESETS,
  POPULAR_MERCHANTS,
  RECURRING_PRESETS,
  TRANSACTION_TYPE_OPTIONS
} from "../lib/catalog";
import {
  useAccountCreateMutation,
  useAccounts,
  useAssetCreateMutation,
  useAssetSearch,
  useDepositCreateMutation,
  useBudgetCreateMutation,
  useCategories,
  useGoalCreateMutation,
  useRecurringCreateMutation,
  useTransactionCreateMutation
} from "../lib/query";
import { money } from "../lib/format";
import type { AccountType, AssetInstrumentOption, AssetType, TransactionType } from "../lib/types";
import { ChoiceCards, QuickPills, SelectMenu, Surface } from "./ui";

type CreateSection = "operation" | "account" | "budget" | "goal" | "recurring" | "asset" | "deposit";
type DrawerMode = "form" | "templates";

type CreateDrawerProps = {
  open: boolean;
  section: CreateSection | null;
  onClose: () => void;
};

const today = new Date().toISOString().slice(0, 10);

const SECTION_META: Record<CreateSection, { title: string; subtitle: string }> = {
  operation: { title: "Операция", subtitle: "Доходы, расходы и движения денег" },
  account: { title: "Счёт", subtitle: "Карты, наличные и накопительные счета" },
  budget: { title: "Бюджет", subtitle: "Лимиты по расходам на период" },
  goal: { title: "Цель", subtitle: "Накопления и крупные планы" },
  recurring: { title: "Регулярный платёж", subtitle: "Подписки и повторяющиеся списания" },
  asset: { title: "Актив", subtitle: "Отслеживаемая позиция с рыночной ценой или ручной оценкой" },
  deposit: { title: "Вклад", subtitle: "Ставка, срок, условия и связанный счёт" }
};

const TRACKED_ASSET_TYPES: AssetType[] = ["crypto", "stock", "etf", "cash", "metal"];

const assetQuantityLabels: Record<AssetType, string> = {
  crypto: "Количество монет",
  stock: "Количество акций",
  etf: "Количество паёв",
  bond: "Количество бумаг",
  cash: "Сколько единиц валюты",
  deposit: "Сумма позиции",
  metal: "Количество унций",
  real_estate: "Количество объектов",
  custom: "Количество"
};

const assetAverageLabels: Record<AssetType, string> = {
  crypto: "Средняя цена покупки за 1 монету",
  stock: "Средняя цена покупки за 1 акцию",
  etf: "Средняя цена покупки за 1 пай",
  bond: "Средняя цена покупки за бумагу",
  cash: "Средний курс покупки",
  deposit: "Средняя цена покупки",
  metal: "Средняя цена покупки за 1 унцию",
  real_estate: "Цена покупки объекта",
  custom: "Средняя цена покупки"
};

export function CreateDrawer({ open, section, onClose }: CreateDrawerProps) {
  const accounts = useAccounts();
  const categories = useCategories();
  const createAccount = useAccountCreateMutation();
  const createTransaction = useTransactionCreateMutation();
  const createBudget = useBudgetCreateMutation();
  const createGoal = useGoalCreateMutation();
  const createRecurring = useRecurringCreateMutation();
  const createAsset = useAssetCreateMutation();
  const createDeposit = useDepositCreateMutation();

  const [mode, setMode] = useState<DrawerMode>("form");
  const [assetSearchQuery, setAssetSearchQuery] = useState("bitcoin");

  const [accountDraft, setAccountDraft] = useState({
    name: "Т-Банк Black",
    type: "debit_card" as AccountType,
    currency: "RUB",
    institution_name: "Т-Банк",
    opening_balance: "0"
  });
  const [operationDraft, setOperationDraft] = useState({
    account_id: "",
    type: "expense" as TransactionType,
    amount: "0",
    currency: "RUB",
    category_id: "",
    merchant_name: "",
    description: "",
    transaction_date: today,
    posting_date: today
  });
  const [budgetDraft, setBudgetDraft] = useState({
    name: "Продукты",
    amount: "40000",
    currency: "RUB",
    amount_in_base_currency: "40000",
    start_date: today,
    end_date: today
  });
  const [goalDraft, setGoalDraft] = useState({
    title: "Подушка безопасности",
    target_amount: "600000",
    currency: "RUB",
    target_amount_in_base_currency: "600000",
    deadline: today,
    monthly_contribution_target: "30000"
  });
  const [recurringDraft, setRecurringDraft] = useState({
    name: "Telegram Premium",
    account_id: "",
    amount: "299",
    currency: "RUB",
    amount_in_base_currency: "299",
    frequency: "monthly" as "weekly" | "monthly" | "yearly",
    next_due_date: today
  });
  const [assetDraft, setAssetDraft] = useState({
    name: "Bitcoin",
    type: "crypto" as AssetType,
    currency: "USD",
    symbol: "BTC",
    quantity: "0.15",
    average_buy_price: "62000",
    average_buy_price_in_base: "62000",
    current_price: "68000",
    current_price_in_base: "68000",
    invested_amount_in_base: "9300",
    tracking_enabled: true,
    tracking_provider: "coingecko",
    tracking_external_id: "bitcoin",
    tracking_symbol: "BTC",
    rental_enabled: false,
    rental_income_monthly: "0",
    rental_payment_frequency: "monthly",
    rental_payment_day: "5",
    notes: ""
  });
  const assetSearch = useAssetSearch(assetDraft.type, assetSearchQuery);
  const [depositDraft, setDepositDraft] = useState({
    name: "Вклад в Т-Банке",
    institution_name: "Т-Банк",
    currency: "RUB",
    principal_amount: "300000",
    current_balance: "300000",
    annual_interest_rate: "16",
    payout_frequency: "monthly",
    capitalization_enabled: true,
    opened_on: today,
    maturity_date: today,
    next_payout_date: today,
    early_withdrawal_terms: "Проценты пересчитываются по ставке до востребования",
    funding_account_id: ""
  });

  useEffect(() => {
    if (accounts.data?.[0]?.id) {
      setOperationDraft((current) => ({ ...current, account_id: current.account_id || accounts.data[0].id }));
      setRecurringDraft((current) => ({ ...current, account_id: current.account_id || accounts.data[0].id }));
    }
  }, [accounts.data]);

  useEffect(() => {
    if (open) {
      setMode("form");
    }
  }, [open, section]);

  useEffect(() => {
    if (section !== "asset") return;
    if (!TRACKED_ASSET_TYPES.includes(assetDraft.type)) {
      setAssetSearchQuery("");
      return;
    }
    setAssetSearchQuery(assetDraft.name || assetDraft.symbol || "");
  }, [assetDraft.type, assetDraft.name, assetDraft.symbol, section]);

  if (!open || !section) return null;

  const meta = SECTION_META[section];
  const accountOptions = (accounts.data ?? []).map((account) => ({
    value: account.id,
    label: account.name,
    hint: account.currency
  }));
  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: String(category.id),
    label: String(category.name),
    hint: category.direction ? String(category.direction) : "Категория"
  }));
  const trackedAsset = TRACKED_ASSET_TYPES.includes(assetDraft.type);

  const applyAssetInstrumentSelection = (option: AssetInstrumentOption) => {
    const inferredCurrency =
      option.asset_type === "cash"
        ? option.symbol.split("/")[0] || option.currency || "USD"
        : option.currency || "USD";
    setAssetDraft((current) => ({
      ...current,
      type: option.asset_type,
      name: option.name,
      symbol: option.symbol,
      currency: inferredCurrency.toUpperCase(),
      tracking_enabled: true,
      tracking_provider: option.provider,
      tracking_external_id: option.external_id,
      tracking_symbol: option.symbol
    }));
    setAssetSearchQuery(option.name);
    setMode("form");
  };

  const renderTemplates = () => {
    if (section === "operation") {
      return (
        <div className="preset-stack">
          {OPERATION_PRESETS.map((preset) => (
            <button
              key={`${preset.merchant_name}-${preset.type}`}
              type="button"
              className="preset-card"
              onClick={() => {
                setOperationDraft((current) => ({
                  ...current,
                  merchant_name: preset.merchant_name,
                  description: preset.description,
                  type: preset.type,
                  amount: String(preset.amount),
                  currency: preset.currency
                }));
                setMode("form");
              }}
            >
              <strong>{preset.merchant_name}</strong>
              <span>{preset.description} · {money(preset.amount, preset.currency)}</span>
            </button>
          ))}
        </div>
      );
    }

    if (section === "account") {
      return (
        <div className="preset-stack">
          {ACCOUNT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="preset-card"
              onClick={() => {
                setAccountDraft({
                  name: preset.name,
                  institution_name: preset.institution_name,
                  type: preset.type,
                  currency: preset.currency,
                  opening_balance: "0"
                });
                setMode("form");
              }}
            >
              <strong>{preset.name}</strong>
              <span>{preset.institution_name} · {preset.currency}</span>
            </button>
          ))}
        </div>
      );
    }

    if (section === "budget") {
      return (
        <div className="preset-stack">
          {[
            { name: "Продукты", amount: "40000", currency: "RUB", hint: "Супермаркеты и доставка" },
            { name: "Кафе и рестораны", amount: "18000", currency: "RUB", hint: "Кофе, ланчи и ужины" },
            { name: "Такси", amount: "12000", currency: "RUB", hint: "Поездки по городу" }
          ].map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="preset-card"
              onClick={() => {
                setBudgetDraft((current) => ({
                  ...current,
                  name: preset.name,
                  amount: preset.amount,
                  amount_in_base_currency: preset.amount,
                  currency: preset.currency
                }));
                setMode("form");
              }}
            >
              <strong>{preset.name}</strong>
              <span>{money(Number(preset.amount), preset.currency)} · {preset.hint}</span>
            </button>
          ))}
        </div>
      );
    }

    if (section === "goal") {
      return (
        <div className="preset-stack">
          {GOAL_PRESETS.map((preset) => (
            <button
              key={preset.title}
              type="button"
              className="preset-card"
              onClick={() => {
                setGoalDraft((current) => ({
                  ...current,
                  title: preset.title,
                  target_amount: String(preset.target_amount),
                  target_amount_in_base_currency: String(preset.target_amount),
                  currency: preset.currency,
                  monthly_contribution_target: String(preset.monthly_contribution_target)
                }));
                setMode("form");
              }}
            >
              <strong>{preset.title}</strong>
              <span>{money(preset.target_amount, preset.currency)}</span>
            </button>
          ))}
        </div>
      );
    }

    if (section === "recurring") {
      return (
        <div className="preset-stack">
          {RECURRING_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="preset-card"
              onClick={() => {
                setRecurringDraft((current) => ({
                  ...current,
                  name: preset.name,
                  amount: String(preset.amount),
                  amount_in_base_currency: String(preset.amount),
                  currency: preset.currency,
                  frequency: preset.frequency
                }));
                setMode("form");
              }}
            >
              <strong>{preset.name}</strong>
              <span>{money(preset.amount, preset.currency)}</span>
            </button>
          ))}
        </div>
      );
    }

    if (section === "deposit") {
      return (
        <div className="preset-stack">
          {[
            { name: "Короткий вклад", rate: "16", term: "3 месяца", hint: "Для части резерва" },
            { name: "Годовой вклад", rate: "14.5", term: "12 месяцев", hint: "Под фиксированную ставку" },
            { name: "Валютный вклад", rate: "4.2", term: "6 месяцев", hint: "Для USD или EUR" }
          ].map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="preset-card"
              onClick={() => {
                setDepositDraft((current) => ({
                  ...current,
                  name: preset.name,
                  annual_interest_rate: preset.rate
                }));
                setMode("form");
              }}
            >
              <strong>{preset.name}</strong>
              <span>{preset.rate}% · {preset.term} · {preset.hint}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="preset-stack">
        {ASSET_PRESETS.map((preset) => (
          <button
            key={preset.symbol}
            type="button"
            className="preset-card"
            onClick={() => {
              setAssetDraft((current) => ({
                ...current,
                name: preset.name,
                symbol: preset.symbol,
                type: preset.type,
                currency: preset.currency,
                tracking_provider: preset.tracking_provider ?? current.tracking_provider,
                tracking_external_id: preset.tracking_external_id ?? "",
                tracking_symbol: preset.symbol
              }));
              setAssetSearchQuery(preset.name);
              setMode("form");
            }}
          >
            <strong>{preset.name}</strong>
            <span>{preset.symbol} · {preset.currency}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderForm = () => {
    if (section === "operation") {
      return (
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            await createTransaction.mutateAsync({
              account_id: operationDraft.account_id,
              type: operationDraft.type,
              amount: Number(operationDraft.amount),
              currency: operationDraft.currency,
              amount_in_base_currency: Number(operationDraft.amount),
              fx_rate: 1,
              category_id: operationDraft.category_id || undefined,
              merchant_name: operationDraft.merchant_name || undefined,
              description: operationDraft.description || undefined,
              transaction_date: operationDraft.transaction_date,
              posting_date: operationDraft.posting_date,
              splits: [],
              tag_ids: [],
              source_type: "manual"
            });
            onClose();
          }}
        >
          <div>
            <span className="form-label">Тип операции</span>
            <ChoiceCards
              value={operationDraft.type}
              onChange={(type) => setOperationDraft((current) => ({ ...current, type }))}
              options={TRANSACTION_TYPE_OPTIONS}
              compact
            />
          </div>
          <div className="two-column-grid">
            <div>
              <span className="form-label">Счёт</span>
              <SelectMenu
                value={operationDraft.account_id}
                onChange={(account_id) => setOperationDraft((current) => ({ ...current, account_id }))}
                options={accountOptions}
                placeholder="Выберите счёт"
              />
            </div>
            <div>
              <span className="form-label">Категория</span>
              <SelectMenu
                value={operationDraft.category_id}
                onChange={(category_id) => setOperationDraft((current) => ({ ...current, category_id }))}
                options={[{ value: "", label: "Без категории", hint: "Определите позже" }, ...categoryOptions]}
              />
            </div>
          </div>
          <label>
            <span>Кто или что</span>
            <input
              value={operationDraft.merchant_name}
              onChange={(event) => setOperationDraft((current) => ({ ...current, merchant_name: event.target.value }))}
              placeholder="ВкусВилл, Яндекс Go, работодатель"
            />
          </label>
          <QuickPills
            items={POPULAR_MERCHANTS.map((item) => ({ value: item }))}
            onPick={(merchant_name) => setOperationDraft((current) => ({ ...current, merchant_name }))}
          />
          <div className="two-column-grid">
            <label>
              <span>Сумма</span>
              <input
                type="number"
                step="0.01"
                value={operationDraft.amount}
                onChange={(event) => setOperationDraft((current) => ({ ...current, amount: event.target.value }))}
              />
            </label>
            <div>
              <span className="form-label">Валюта</span>
              <SelectMenu
                value={operationDraft.currency}
                onChange={(currency) => setOperationDraft((current) => ({ ...current, currency }))}
                options={CURRENCY_OPTIONS.map((item) => ({
                  value: item.code,
                  label: `${item.code} · ${item.label}`,
                  hint: item.symbol
                }))}
                searchable
              />
            </div>
          </div>
          <label>
            <span>Комментарий</span>
            <input
              value={operationDraft.description}
              onChange={(event) => setOperationDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Например: продукты или зарплата"
            />
          </label>
          <div className="two-column-grid">
            <label>
              <span>Дата операции</span>
              <input
                type="date"
                value={operationDraft.transaction_date}
                onChange={(event) => setOperationDraft((current) => ({ ...current, transaction_date: event.target.value }))}
              />
            </label>
            <label>
              <span>Дата проводки</span>
              <input
                type="date"
                value={operationDraft.posting_date}
                onChange={(event) => setOperationDraft((current) => ({ ...current, posting_date: event.target.value }))}
              />
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={createTransaction.isPending}>
            Сохранить операцию
          </button>
        </form>
      );
    }

    if (section === "account") {
      return (
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            await createAccount.mutateAsync({
              ...accountDraft,
              opening_balance: Number(accountDraft.opening_balance),
              include_in_net_worth: true,
              include_in_liquid_balance: accountDraft.type !== "loan"
            });
            onClose();
          }}
        >
          <label>
            <span>Название счёта</span>
            <input value={accountDraft.name} onChange={(event) => setAccountDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div>
            <span className="form-label">Тип счёта</span>
            <ChoiceCards value={accountDraft.type} onChange={(type) => setAccountDraft((current) => ({ ...current, type }))} options={ACCOUNT_TYPE_OPTIONS} />
          </div>
          <label>
            <span>Организация</span>
            <input value={accountDraft.institution_name} onChange={(event) => setAccountDraft((current) => ({ ...current, institution_name: event.target.value }))} />
          </label>
          <div>
            <span className="form-label">Валюта</span>
            <SelectMenu
              value={accountDraft.currency}
              onChange={(currency) => setAccountDraft((current) => ({ ...current, currency }))}
              options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}`, hint: item.symbol }))}
              searchable
            />
          </div>
          <label>
            <span>Стартовый остаток</span>
            <input type="number" step="0.01" value={accountDraft.opening_balance} onChange={(event) => setAccountDraft((current) => ({ ...current, opening_balance: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={createAccount.isPending}>Сохранить счёт</button>
        </form>
      );
    }

    if (section === "budget") {
      return (
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            await createBudget.mutateAsync({
              name: budgetDraft.name,
              amount: Number(budgetDraft.amount),
              currency: budgetDraft.currency,
              amount_in_base_currency: Number(budgetDraft.amount_in_base_currency),
              start_date: budgetDraft.start_date,
              end_date: budgetDraft.end_date,
              period_type: "monthly",
              fixed_only: false
            });
            onClose();
          }}
        >
          <label>
            <span>На что лимит</span>
            <input value={budgetDraft.name} onChange={(event) => setBudgetDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div className="two-column-grid">
            <label>
              <span>Сумма</span>
              <input type="number" step="0.01" value={budgetDraft.amount} onChange={(event) => setBudgetDraft((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <div>
              <span className="form-label">Валюта</span>
              <SelectMenu
                value={budgetDraft.currency}
                onChange={(currency) => setBudgetDraft((current) => ({ ...current, currency }))}
                options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}`, hint: item.symbol }))}
                searchable
              />
            </div>
          </div>
          <label>
            <span>Сумма в основной валюте</span>
            <input type="number" step="0.01" value={budgetDraft.amount_in_base_currency} onChange={(event) => setBudgetDraft((current) => ({ ...current, amount_in_base_currency: event.target.value }))} />
          </label>
          <div className="two-column-grid">
            <label>
              <span>Начало</span>
              <input type="date" value={budgetDraft.start_date} onChange={(event) => setBudgetDraft((current) => ({ ...current, start_date: event.target.value }))} />
            </label>
            <label>
              <span>Конец</span>
              <input type="date" value={budgetDraft.end_date} onChange={(event) => setBudgetDraft((current) => ({ ...current, end_date: event.target.value }))} />
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={createBudget.isPending}>Сохранить бюджет</button>
        </form>
      );
    }

    if (section === "goal") {
      return (
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            await createGoal.mutateAsync({
              title: goalDraft.title,
              target_amount: Number(goalDraft.target_amount),
              currency: goalDraft.currency,
              target_amount_in_base_currency: Number(goalDraft.target_amount_in_base_currency),
              deadline: goalDraft.deadline,
              monthly_contribution_target: Number(goalDraft.monthly_contribution_target),
              priority: 1,
              auto_funding_enabled: false
            });
            onClose();
          }}
        >
          <label>
            <span>Название</span>
            <input value={goalDraft.title} onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <div className="two-column-grid">
            <label>
              <span>Целевая сумма</span>
              <input type="number" step="0.01" value={goalDraft.target_amount} onChange={(event) => setGoalDraft((current) => ({ ...current, target_amount: event.target.value }))} />
            </label>
            <div>
              <span className="form-label">Валюта</span>
              <SelectMenu
                value={goalDraft.currency}
                onChange={(currency) => setGoalDraft((current) => ({ ...current, currency }))}
                options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}`, hint: item.symbol }))}
                searchable
              />
            </div>
          </div>
          <div className="two-column-grid">
            <label>
              <span>Сумма в основной валюте</span>
              <input type="number" step="0.01" value={goalDraft.target_amount_in_base_currency} onChange={(event) => setGoalDraft((current) => ({ ...current, target_amount_in_base_currency: event.target.value }))} />
            </label>
            <label>
              <span>Ежемесячный взнос</span>
              <input type="number" step="0.01" value={goalDraft.monthly_contribution_target} onChange={(event) => setGoalDraft((current) => ({ ...current, monthly_contribution_target: event.target.value }))} />
            </label>
          </div>
          <label>
            <span>Дедлайн</span>
            <input type="date" value={goalDraft.deadline} onChange={(event) => setGoalDraft((current) => ({ ...current, deadline: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={createGoal.isPending}>Сохранить цель</button>
        </form>
      );
    }

    if (section === "recurring") {
      return (
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            await createRecurring.mutateAsync({
              ...recurringDraft,
              amount: Number(recurringDraft.amount),
              amount_in_base_currency: Number(recurringDraft.amount_in_base_currency),
              interval_count: 1,
              reminder_days_before: 3,
              fixed_or_variable: "fixed"
            });
            onClose();
          }}
        >
          <label>
            <span>Название</span>
            <input value={recurringDraft.name} onChange={(event) => setRecurringDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div>
            <span className="form-label">Счёт</span>
            <SelectMenu
              value={recurringDraft.account_id}
              onChange={(account_id) => setRecurringDraft((current) => ({ ...current, account_id }))}
              options={accountOptions}
              placeholder="Выберите счёт"
            />
          </div>
          <div className="two-column-grid">
            <label>
              <span>Сумма</span>
              <input type="number" step="0.01" value={recurringDraft.amount} onChange={(event) => setRecurringDraft((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <div>
              <span className="form-label">Валюта</span>
              <SelectMenu
                value={recurringDraft.currency}
                onChange={(currency) => setRecurringDraft((current) => ({ ...current, currency }))}
                options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}`, hint: item.symbol }))}
                searchable
              />
            </div>
          </div>
          <div>
            <span className="form-label">Периодичность</span>
            <ChoiceCards
              value={recurringDraft.frequency}
              onChange={(frequency) => setRecurringDraft((current) => ({ ...current, frequency }))}
              options={[
                { value: "weekly", label: "Еженедельно", hint: "Раз в неделю" },
                { value: "monthly", label: "Ежемесячно", hint: "Раз в месяц" },
                { value: "yearly", label: "Ежегодно", hint: "Раз в год" }
              ]}
              compact
            />
          </div>
          <label>
            <span>Следующее списание</span>
            <input type="date" value={recurringDraft.next_due_date} onChange={(event) => setRecurringDraft((current) => ({ ...current, next_due_date: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={createRecurring.isPending}>Сохранить платёж</button>
        </form>
      );
    }

    if (section === "deposit") {
      return (
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            await createDeposit.mutateAsync({
              ...depositDraft,
              principal_amount: Number(depositDraft.principal_amount),
              current_balance: Number(depositDraft.current_balance),
              annual_interest_rate: Number(depositDraft.annual_interest_rate),
              funding_account_id: depositDraft.funding_account_id || undefined,
              early_withdrawal_terms: depositDraft.early_withdrawal_terms || undefined,
              maturity_date: depositDraft.maturity_date || undefined,
              next_payout_date: depositDraft.next_payout_date || undefined
            });
            onClose();
          }}
        >
          <div className="two-column-grid">
            <label>
              <span>Название вклада</span>
              <input value={depositDraft.name} onChange={(event) => setDepositDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Банк</span>
              <input value={depositDraft.institution_name} onChange={(event) => setDepositDraft((current) => ({ ...current, institution_name: event.target.value }))} />
            </label>
          </div>
          <div className="two-column-grid">
            <div>
              <span className="form-label">Валюта</span>
              <SelectMenu
                value={depositDraft.currency}
                onChange={(currency) => setDepositDraft((current) => ({ ...current, currency }))}
                options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}`, hint: item.symbol }))}
                searchable
              />
            </div>
            <div>
              <span className="form-label">Счёт пополнения</span>
              <SelectMenu
                value={depositDraft.funding_account_id}
                onChange={(funding_account_id) => setDepositDraft((current) => ({ ...current, funding_account_id }))}
                options={[{ value: "", label: "Без привязки", hint: "Можно выбрать позже" }, ...accountOptions]}
                placeholder="Выберите счёт"
              />
            </div>
          </div>
          <div className="two-column-grid">
            <label>
              <span>Сумма открытия</span>
              <input type="number" step="0.01" value={depositDraft.principal_amount} onChange={(event) => setDepositDraft((current) => ({ ...current, principal_amount: event.target.value }))} />
            </label>
            <label>
              <span>Текущий баланс</span>
              <input type="number" step="0.01" value={depositDraft.current_balance} onChange={(event) => setDepositDraft((current) => ({ ...current, current_balance: event.target.value }))} />
            </label>
          </div>
          <div className="two-column-grid">
            <label>
              <span>Годовая ставка, %</span>
              <input type="number" step="0.01" value={depositDraft.annual_interest_rate} onChange={(event) => setDepositDraft((current) => ({ ...current, annual_interest_rate: event.target.value }))} />
            </label>
            <div>
              <span className="form-label">Когда платят проценты</span>
              <SelectMenu
                value={depositDraft.payout_frequency}
                onChange={(payout_frequency) => setDepositDraft((current) => ({ ...current, payout_frequency }))}
                options={DEPOSIT_PAYOUT_OPTIONS.map((item) => ({ value: item.value, label: item.label, hint: item.hint }))}
              />
            </div>
          </div>
          <div className="two-column-grid">
            <label>
              <span>Дата открытия</span>
              <input type="date" value={depositDraft.opened_on} onChange={(event) => setDepositDraft((current) => ({ ...current, opened_on: event.target.value }))} />
            </label>
            <label>
              <span>Дата окончания</span>
              <input type="date" value={depositDraft.maturity_date} onChange={(event) => setDepositDraft((current) => ({ ...current, maturity_date: event.target.value }))} />
            </label>
          </div>
          <div className="two-column-grid">
            <label>
              <span>Следующая выплата процентов</span>
              <input type="date" value={depositDraft.next_payout_date} onChange={(event) => setDepositDraft((current) => ({ ...current, next_payout_date: event.target.value }))} />
            </label>
            <label className="toggle-field">
              <span>Капитализация процентов</span>
              <input type="checkbox" checked={depositDraft.capitalization_enabled} onChange={(event) => setDepositDraft((current) => ({ ...current, capitalization_enabled: event.target.checked }))} />
            </label>
          </div>
          <label>
            <span>Условия досрочного закрытия</span>
            <input value={depositDraft.early_withdrawal_terms} onChange={(event) => setDepositDraft((current) => ({ ...current, early_withdrawal_terms: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={createDeposit.isPending}>Сохранить вклад</button>
        </form>
      );
    }

    return (
      <form
        className="form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          await createAsset.mutateAsync({
            ...assetDraft,
            quantity: Number(assetDraft.quantity),
            average_buy_price: Number(assetDraft.average_buy_price),
            average_buy_price_in_base: Number(assetDraft.average_buy_price || 0),
            current_price: trackedAsset ? 0 : Number(assetDraft.current_price),
            current_price_in_base: trackedAsset ? 0 : Number(assetDraft.current_price_in_base),
            invested_amount_in_base: Number(assetDraft.quantity || 0) * Number(assetDraft.average_buy_price || 0),
            tracking_enabled: assetDraft.tracking_enabled,
            tracking_provider: assetDraft.tracking_enabled ? assetDraft.tracking_provider : undefined,
            tracking_external_id: assetDraft.tracking_enabled ? assetDraft.tracking_external_id || undefined : undefined,
            tracking_symbol: assetDraft.tracking_enabled ? assetDraft.tracking_symbol || undefined : undefined,
            rental_enabled: assetDraft.type === "real_estate" ? assetDraft.rental_enabled : false,
            rental_income_monthly: assetDraft.type === "real_estate" ? Number(assetDraft.rental_income_monthly) : 0,
            rental_payment_frequency: assetDraft.type === "real_estate" && assetDraft.rental_enabled ? assetDraft.rental_payment_frequency : undefined,
            rental_payment_day: assetDraft.type === "real_estate" && assetDraft.rental_enabled ? Number(assetDraft.rental_payment_day) : undefined,
            notes: assetDraft.notes || undefined
          });
          onClose();
        }}
      >
        <div>
          <span className="form-label">Класс актива</span>
          <ChoiceCards
            value={assetDraft.type}
            onChange={(type) =>
              setAssetDraft((current) => ({
                ...current,
                type,
                tracking_enabled: TRACKED_ASSET_TYPES.includes(type),
                tracking_provider: type === "crypto" ? "coingecko" : TRACKED_ASSET_TYPES.includes(type) ? "twelvedata" : "",
                tracking_external_id: "",
                tracking_symbol: "",
                symbol: "",
                name: ""
              }))
            }
            options={ASSET_TYPE_OPTIONS}
            compact
          />
        </div>
        {trackedAsset ? (
          <>
            <label>
              <span>Найти инструмент</span>
              <input
                value={assetSearchQuery}
                onChange={(event) => setAssetSearchQuery(event.target.value)}
                placeholder={
                  assetDraft.type === "crypto"
                    ? "Например: bit, eth, sol"
                    : assetDraft.type === "stock"
                      ? "Например: aapl, apple"
                      : assetDraft.type === "etf"
                        ? "Например: voo, spy"
                        : assetDraft.type === "cash"
                          ? "Например: usd, eur"
                          : "Например: xau, gold"
                }
              />
            </label>
            <div className="preset-stack">
              {assetSearch.data?.length ? (
                assetSearch.data.map((option) => (
                  <button
                    key={`${option.provider}-${option.external_id}`}
                    type="button"
                    className="preset-card"
                    onClick={() => applyAssetInstrumentSelection(option)}
                  >
                    <strong>{option.name}</strong>
                    <span>{option.symbol} · {option.market ?? option.currency ?? option.provider}</span>
                  </button>
                ))
              ) : (
                <div className="preset-card static-card">
                  <strong>{assetSearch.isLoading ? "Ищем по провайдеру..." : "Начните вводить запрос"}</strong>
                  <span>
                    {assetSearch.isLoading
                      ? "Подтягиваем варианты из CoinGecko или Twelve Data."
                      : "Введите минимум 2 символа, чтобы увидеть доступные инструменты."}
                  </span>
                </div>
              )}
            </div>
            <div className="two-column-grid">
              <label>
                <span>Название</span>
                <input value={assetDraft.name} onChange={(event) => setAssetDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                <span>Инструмент</span>
                <input value={assetDraft.symbol} onChange={(event) => setAssetDraft((current) => ({ ...current, symbol: event.target.value, tracking_symbol: event.target.value }))} />
              </label>
            </div>
          </>
        ) : (
          <div className="two-column-grid">
            <label>
              <span>Название</span>
              <input value={assetDraft.name} onChange={(event) => setAssetDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>{assetDraft.type === "real_estate" ? "Короткое имя" : "Символ"}</span>
              <input value={assetDraft.symbol} onChange={(event) => setAssetDraft((current) => ({ ...current, symbol: event.target.value }))} />
            </label>
          </div>
        )}
        <div className="two-column-grid">
          {trackedAsset ? (
            <label>
              <span>Валюта позиции</span>
              <input value={assetDraft.currency} readOnly />
            </label>
          ) : (
            <div>
              <span className="form-label">Валюта</span>
              <SelectMenu
                value={assetDraft.currency}
                onChange={(currency) => setAssetDraft((current) => ({ ...current, currency }))}
                options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}`, hint: item.symbol }))}
                searchable
              />
            </div>
          )}
          <label>
            <span>{assetQuantityLabels[assetDraft.type]}</span>
            <input type="number" step="0.000001" value={assetDraft.quantity} onChange={(event) => setAssetDraft((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
        </div>
        <div className="two-column-grid">
          <label>
            <span>{assetAverageLabels[assetDraft.type]}</span>
            <input type="number" step="0.01" value={assetDraft.average_buy_price} onChange={(event) => setAssetDraft((current) => ({ ...current, average_buy_price: event.target.value }))} />
          </label>
          {trackedAsset ? (
            <div className="toggle-field">
              <span>
                Текущая цена подтянется с рынка автоматически через{" "}
                {assetDraft.tracking_provider === "coingecko" ? "CoinGecko" : "Twelve Data"}.
              </span>
            </div>
          ) : (
            <label>
              <span>Текущая оценка объекта</span>
              <input type="number" step="0.01" value={assetDraft.current_price} onChange={(event) => setAssetDraft((current) => ({ ...current, current_price: event.target.value }))} />
            </label>
          )}
        </div>
        {!trackedAsset ? (
          <label>
            <span>Оценка в базовой валюте</span>
            <input type="number" step="0.01" value={assetDraft.current_price_in_base} onChange={(event) => setAssetDraft((current) => ({ ...current, current_price_in_base: event.target.value }))} />
          </label>
        ) : null}
        {assetDraft.type === "real_estate" ? (
          <>
            <label className="toggle-field">
              <span>Объект сдаётся в аренду</span>
              <input type="checkbox" checked={assetDraft.rental_enabled} onChange={(event) => setAssetDraft((current) => ({ ...current, rental_enabled: event.target.checked }))} />
            </label>
            {assetDraft.rental_enabled ? (
              <div className="two-column-grid">
                <label>
                  <span>Доход в месяц</span>
                  <input type="number" step="0.01" value={assetDraft.rental_income_monthly} onChange={(event) => setAssetDraft((current) => ({ ...current, rental_income_monthly: event.target.value }))} />
                </label>
                <label>
                  <span>День оплаты аренды</span>
                  <input type="number" min="1" max="31" value={assetDraft.rental_payment_day} onChange={(event) => setAssetDraft((current) => ({ ...current, rental_payment_day: event.target.value }))} />
                </label>
              </div>
            ) : null}
          </>
        ) : null}
        <label>
          <span>Заметка</span>
          <input value={assetDraft.notes} onChange={(event) => setAssetDraft((current) => ({ ...current, notes: event.target.value }))} />
        </label>
        <button className="primary-button" type="submit" disabled={createAsset.isPending}>Сохранить актив</button>
      </form>
    );
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="create-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="kicker">{meta.title}</span>
            <h3>{mode === "form" ? `Добавить: ${meta.title}` : `Шаблоны: ${meta.title}`}</h3>
            <p>{meta.subtitle}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="drawer-tabs">
          <button type="button" className={`quick-pill ${mode === "form" ? "active-tab" : ""}`} onClick={() => setMode("form")}>
            Добавить
          </button>
          <button type="button" className={`quick-pill ${mode === "templates" ? "active-tab" : ""}`} onClick={() => setMode("templates")}>
            Шаблоны
          </button>
        </div>

        <div className="drawer-body">
          <Surface>{mode === "form" ? renderForm() : renderTemplates()}</Surface>
        </div>
      </aside>
    </div>
  );
}
