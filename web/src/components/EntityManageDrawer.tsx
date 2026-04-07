import { useEffect, useState } from "react";

import {
  ACCOUNT_TYPE_OPTIONS,
  ASSET_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  DEPOSIT_PAYOUT_OPTIONS
} from "../lib/catalog";
import {
  useAccountDeleteMutation,
  useAccounts,
  useAccountUpdateMutation,
  useAssetDeleteMutation,
  useAssetUpdateMutation,
  useDepositDeleteMutation,
  useDepositUpdateMutation,
  useGoalDeleteMutation,
  useGoalUpdateMutation
} from "../lib/query";
import type { AccountSummary, AccountType, AssetPosition, AssetType, DepositSummary, GoalForecast } from "../lib/types";
import { ChoiceCards, SelectMenu, Surface } from "./ui";

type DrawerTab = "edit" | "delete";

type EntityManageDrawerProps =
  | {
      open: boolean;
      record: { kind: "account"; item: AccountSummary } | null;
      defaultTab?: DrawerTab;
      onClose: () => void;
    }
  | {
      open: boolean;
      record: { kind: "asset"; item: AssetPosition } | null;
      defaultTab?: DrawerTab;
      onClose: () => void;
    }
  | {
      open: boolean;
      record: { kind: "deposit"; item: DepositSummary } | null;
      defaultTab?: DrawerTab;
      onClose: () => void;
    }
  | {
      open: boolean;
      record: { kind: "goal"; item: GoalForecast } | null;
      defaultTab?: DrawerTab;
      onClose: () => void;
    };

const trackedAssetTypes = new Set(["crypto", "stock", "etf", "cash", "metal"]);
const goalStatusOptions = [
  { value: "active", label: "В работе", hint: "Цель участвует в прогнозах" },
  { value: "paused", label: "На паузе", hint: "Можно вернуться позже" },
  { value: "completed", label: "Достигнута", hint: "Оставить как завершённую" },
  { value: "archived", label: "В архиве", hint: "Скрыть из текущего списка" }
];

export function EntityManageDrawer({ open, record, defaultTab = "edit", onClose }: EntityManageDrawerProps) {
  const accounts = useAccounts();
  const updateAccount = useAccountUpdateMutation();
  const deleteAccount = useAccountDeleteMutation();
  const updateAsset = useAssetUpdateMutation();
  const deleteAsset = useAssetDeleteMutation();
  const updateDeposit = useDepositUpdateMutation();
  const deleteDeposit = useDepositDeleteMutation();
  const updateGoal = useGoalUpdateMutation();
  const deleteGoal = useGoalDeleteMutation();

  const [tab, setTab] = useState<DrawerTab>("edit");
  const [accountDraft, setAccountDraft] = useState<{
    name: string;
    type: AccountType;
    currency: string;
    institution_name: string;
    include_in_net_worth: boolean;
    include_in_liquid_balance: boolean;
    credit_limit: string;
    interest_rate: string;
    billing_day: string;
    grace_period_days: string;
  }>({
    name: "",
    type: "debit_card",
    currency: "RUB",
    institution_name: "",
    include_in_net_worth: true,
    include_in_liquid_balance: true,
    credit_limit: "",
    interest_rate: "",
    billing_day: "",
    grace_period_days: ""
  });
  const [assetDraft, setAssetDraft] = useState<{
    name: string;
    symbol: string;
    type: AssetType;
    currency: string;
    quantity: string;
    average_buy_price: string;
    current_price: string;
    current_price_in_base: string;
    tracking_enabled: boolean;
    tracking_provider: string;
    tracking_external_id: string;
    tracking_symbol: string;
    rental_enabled: boolean;
    rental_income_monthly: string;
    rental_payment_frequency: string;
    rental_payment_day: string;
    notes: string;
  }>({
    name: "",
    symbol: "",
    type: "stock",
    currency: "RUB",
    quantity: "0",
    average_buy_price: "0",
    current_price: "0",
    current_price_in_base: "0",
    tracking_enabled: true,
    tracking_provider: "",
    tracking_external_id: "",
    tracking_symbol: "",
    rental_enabled: false,
    rental_income_monthly: "0",
    rental_payment_frequency: "monthly",
    rental_payment_day: "10",
    notes: ""
  });
  const [depositDraft, setDepositDraft] = useState({
    name: "",
    institution_name: "",
    currency: "RUB",
    principal_amount: "0",
    current_balance: "0",
    annual_interest_rate: "0",
    payout_frequency: "monthly",
    capitalization_enabled: true,
    opened_on: "",
    maturity_date: "",
    next_payout_date: "",
    early_withdrawal_terms: "",
    funding_account_id: "",
    status: "open"
  });
  const [goalDraft, setGoalDraft] = useState<{
    title: string;
    target_amount: string;
    currency: string;
    deadline: string;
    linked_account_id: string;
    monthly_contribution_target: string;
    priority: string;
    status: GoalForecast["status"];
  }>({
    title: "",
    target_amount: "0",
    currency: "RUB",
    deadline: "",
    linked_account_id: "",
    monthly_contribution_target: "",
    priority: "1",
    status: "active"
  });

  useEffect(() => {
    if (!open || !record) return;
    setTab(defaultTab);
    if (record.kind === "account") {
      setAccountDraft({
        name: record.item.name,
        type: record.item.type,
        currency: record.item.currency,
        institution_name: record.item.institution_name ?? "",
        include_in_net_worth: record.item.include_in_net_worth,
        include_in_liquid_balance: record.item.include_in_liquid_balance,
        credit_limit: "",
        interest_rate: "",
        billing_day: "",
        grace_period_days: ""
      });
      return;
    }
    if (record.kind === "asset") {
      setAssetDraft({
        name: record.item.name,
        symbol: record.item.symbol ?? "",
        type: record.item.type,
        currency: record.item.currency,
        quantity: String(record.item.quantity),
        average_buy_price: "0",
        current_price: String(record.item.current_price ?? 0),
        current_price_in_base: String(record.item.current_price_in_base ?? 0),
        tracking_enabled: record.item.tracking_enabled,
        tracking_provider: record.item.tracking_provider ?? "",
        tracking_external_id: record.item.tracking_external_id ?? "",
        tracking_symbol: record.item.tracking_symbol ?? record.item.symbol ?? "",
        rental_enabled: record.item.rental_enabled,
        rental_income_monthly: String(record.item.rental_income_monthly ?? 0),
        rental_payment_frequency: record.item.rental_payment_frequency ?? "monthly",
        rental_payment_day: String(record.item.rental_payment_day ?? 10),
        notes: ""
      });
      return;
    }
    if (record.kind === "deposit") {
      setDepositDraft({
        name: record.item.name,
        institution_name: record.item.institution_name ?? "",
        currency: record.item.currency,
        principal_amount: String(record.item.principal_amount),
        current_balance: String(record.item.current_balance),
        annual_interest_rate: String(record.item.annual_interest_rate),
        payout_frequency: record.item.payout_frequency,
        capitalization_enabled: record.item.capitalization_enabled,
        opened_on: record.item.opened_on,
        maturity_date: record.item.maturity_date ?? "",
        next_payout_date: record.item.next_payout_date ?? "",
        early_withdrawal_terms: record.item.early_withdrawal_terms ?? "",
        funding_account_id: record.item.funding_account_id ?? "",
        status: record.item.status
      });
      return;
    }
    setGoalDraft({
      title: record.item.title,
      target_amount: String(record.item.target_amount),
      currency: record.item.currency,
      deadline: record.item.deadline ?? "",
      linked_account_id: record.item.linked_account_id ?? "",
      monthly_contribution_target: String(record.item.monthly_contribution_target ?? ""),
      priority: String(record.item.priority ?? 1),
      status: record.item.status
    });
  }, [defaultTab, open, record]);

  if (!open || !record) return null;

  const accountOptions = (accounts.data ?? []).map((account) => ({
    value: account.id,
    label: account.name,
    hint: account.currency
  }));
  const titleMap = {
    account: "Счёт",
    asset: "Актив",
    deposit: "Вклад",
    goal: "Цель"
  } as const;
  const title = titleMap[record.kind];
  const trackedAsset = trackedAssetTypes.has(assetDraft.type);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="create-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="kicker">{title}</span>
            <h3>{tab === "edit" ? `Изменить ${title.toLowerCase()}` : `Убрать ${title.toLowerCase()} из списка`}</h3>
            <p>
              {tab === "edit"
                ? "Измените условия, название и связанные параметры."
                : "Запись не пропадёт без следа, а будет убрана из активного списка."}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="drawer-tabs">
          <button type="button" className={`quick-pill ${tab === "edit" ? "active-tab" : ""}`} onClick={() => setTab("edit")}>
            Изменить
          </button>
          <button type="button" className={`quick-pill ${tab === "delete" ? "active-tab" : ""}`} onClick={() => setTab("delete")}>
            Убрать
          </button>
        </div>

        <div className="drawer-body">
          <Surface>
            {tab === "edit" ? (
              <>
                {record.kind === "account" ? (
                  <form
                    className="form-grid"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await updateAccount.mutateAsync({
                        accountId: record.item.id,
                        payload: {
                          name: accountDraft.name,
                          type: accountDraft.type,
                          currency: accountDraft.currency,
                          institution_name: accountDraft.institution_name || undefined,
                          include_in_net_worth: accountDraft.include_in_net_worth,
                          include_in_liquid_balance: accountDraft.include_in_liquid_balance,
                          credit_limit: accountDraft.credit_limit ? Number(accountDraft.credit_limit) : undefined,
                          interest_rate: accountDraft.interest_rate ? Number(accountDraft.interest_rate) : undefined,
                          billing_day: accountDraft.billing_day ? Number(accountDraft.billing_day) : undefined,
                          grace_period_days: accountDraft.grace_period_days ? Number(accountDraft.grace_period_days) : undefined
                        }
                      });
                      onClose();
                    }}
                  >
                    <label>
                      <span>Название</span>
                      <input value={accountDraft.name} onChange={(event) => setAccountDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <div>
                      <span className="form-label">Тип</span>
                      <ChoiceCards value={accountDraft.type} onChange={(type) => setAccountDraft((current) => ({ ...current, type: type as AccountType }))} options={ACCOUNT_TYPE_OPTIONS} compact />
                    </div>
                    <div className="two-column-grid">
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
                    </div>
                    <div className="two-column-grid">
                      <label className="checkbox-row">
                        <span>Учитывать в капитале</span>
                        <input
                          type="checkbox"
                          checked={accountDraft.include_in_net_worth}
                          onChange={(event) => setAccountDraft((current) => ({ ...current, include_in_net_worth: event.target.checked }))}
                        />
                      </label>
                      <label className="checkbox-row">
                        <span>Учитывать в ликвидности</span>
                        <input
                          type="checkbox"
                          checked={accountDraft.include_in_liquid_balance}
                          onChange={(event) => setAccountDraft((current) => ({ ...current, include_in_liquid_balance: event.target.checked }))}
                        />
                      </label>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Кредитный лимит</span>
                        <input type="number" step="0.01" value={accountDraft.credit_limit} onChange={(event) => setAccountDraft((current) => ({ ...current, credit_limit: event.target.value }))} />
                      </label>
                      <label>
                        <span>Процентная ставка</span>
                        <input type="number" step="0.01" value={accountDraft.interest_rate} onChange={(event) => setAccountDraft((current) => ({ ...current, interest_rate: event.target.value }))} />
                      </label>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>День выписки</span>
                        <input type="number" min="1" max="31" value={accountDraft.billing_day} onChange={(event) => setAccountDraft((current) => ({ ...current, billing_day: event.target.value }))} />
                      </label>
                      <label>
                        <span>Льготный период, дней</span>
                        <input type="number" min="0" max="120" value={accountDraft.grace_period_days} onChange={(event) => setAccountDraft((current) => ({ ...current, grace_period_days: event.target.value }))} />
                      </label>
                    </div>
                    <button className="primary-button" type="submit" disabled={updateAccount.isPending}>Сохранить счёт</button>
                  </form>
                ) : null}

                {record.kind === "asset" ? (
                  <form
                    className="form-grid"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const quantity = Number(assetDraft.quantity || 0);
                      const averageBuyPrice = Number(assetDraft.average_buy_price || 0);
                      await updateAsset.mutateAsync({
                        assetId: record.item.id,
                        payload: {
                          name: assetDraft.name,
                          type: assetDraft.type,
                          currency: assetDraft.currency,
                          symbol: assetDraft.symbol || undefined,
                          quantity,
                          average_buy_price: averageBuyPrice,
                          average_buy_price_in_base: averageBuyPrice,
                          current_price: trackedAsset ? 0 : Number(assetDraft.current_price || 0),
                          current_price_in_base: trackedAsset ? 0 : Number(assetDraft.current_price_in_base || 0),
                          invested_amount_in_base: quantity * averageBuyPrice,
                          tracking_enabled: assetDraft.tracking_enabled,
                          tracking_provider: assetDraft.tracking_enabled ? assetDraft.tracking_provider || undefined : undefined,
                          tracking_external_id: assetDraft.tracking_enabled ? assetDraft.tracking_external_id || undefined : undefined,
                          tracking_symbol: assetDraft.tracking_enabled ? assetDraft.tracking_symbol || assetDraft.symbol || undefined : undefined,
                          rental_enabled: assetDraft.type === "real_estate" ? assetDraft.rental_enabled : false,
                          rental_income_monthly: assetDraft.type === "real_estate" ? Number(assetDraft.rental_income_monthly || 0) : 0,
                          rental_payment_frequency: assetDraft.type === "real_estate" && assetDraft.rental_enabled ? assetDraft.rental_payment_frequency : undefined,
                          rental_payment_day: assetDraft.type === "real_estate" && assetDraft.rental_enabled ? Number(assetDraft.rental_payment_day || 0) : undefined,
                          notes: assetDraft.notes || undefined
                        }
                      });
                      onClose();
                    }}
                  >
                    <div>
                      <span className="form-label">Тип актива</span>
                      <ChoiceCards value={assetDraft.type} onChange={(type) => setAssetDraft((current) => ({ ...current, type: type as AssetType }))} options={ASSET_TYPE_OPTIONS} compact />
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Название</span>
                        <input value={assetDraft.name} onChange={(event) => setAssetDraft((current) => ({ ...current, name: event.target.value }))} />
                      </label>
                      <label>
                        <span>Символ / тикер</span>
                        <input value={assetDraft.symbol} onChange={(event) => setAssetDraft((current) => ({ ...current, symbol: event.target.value, tracking_symbol: event.target.value }))} />
                      </label>
                    </div>
                    <div className="two-column-grid">
                      <div>
                        <span className="form-label">Валюта</span>
                        <SelectMenu
                          value={assetDraft.currency}
                          onChange={(currency) => setAssetDraft((current) => ({ ...current, currency }))}
                          options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}`, hint: item.symbol }))}
                          searchable
                        />
                      </div>
                      <label className="checkbox-row">
                        <span>Тянуть цену с провайдера</span>
                        <input
                          type="checkbox"
                          checked={assetDraft.tracking_enabled}
                          onChange={(event) => setAssetDraft((current) => ({ ...current, tracking_enabled: event.target.checked }))}
                        />
                      </label>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Количество</span>
                        <input type="number" step="0.000001" value={assetDraft.quantity} onChange={(event) => setAssetDraft((current) => ({ ...current, quantity: event.target.value }))} />
                      </label>
                      <label>
                        <span>Средняя цена покупки</span>
                        <input type="number" step="0.01" value={assetDraft.average_buy_price} onChange={(event) => setAssetDraft((current) => ({ ...current, average_buy_price: event.target.value }))} />
                      </label>
                    </div>
                    {assetDraft.tracking_enabled ? (
                      <div className="two-column-grid">
                        <label>
                          <span>Провайдер</span>
                          <input value={assetDraft.tracking_provider} onChange={(event) => setAssetDraft((current) => ({ ...current, tracking_provider: event.target.value }))} />
                        </label>
                        <label>
                          <span>ID / внешний код</span>
                          <input value={assetDraft.tracking_external_id} onChange={(event) => setAssetDraft((current) => ({ ...current, tracking_external_id: event.target.value }))} />
                        </label>
                      </div>
                    ) : (
                      <div className="two-column-grid">
                        <label>
                          <span>Текущая цена</span>
                          <input type="number" step="0.01" value={assetDraft.current_price} onChange={(event) => setAssetDraft((current) => ({ ...current, current_price: event.target.value }))} />
                        </label>
                        <label>
                          <span>Текущая цена в базе</span>
                          <input type="number" step="0.01" value={assetDraft.current_price_in_base} onChange={(event) => setAssetDraft((current) => ({ ...current, current_price_in_base: event.target.value }))} />
                        </label>
                      </div>
                    )}
                    {assetDraft.type === "real_estate" ? (
                      <>
                        <label className="checkbox-row">
                          <span>Сдаётся в аренду</span>
                          <input
                            type="checkbox"
                            checked={assetDraft.rental_enabled}
                            onChange={(event) => setAssetDraft((current) => ({ ...current, rental_enabled: event.target.checked }))}
                          />
                        </label>
                        {assetDraft.rental_enabled ? (
                          <div className="two-column-grid">
                            <label>
                              <span>Аренда в месяц</span>
                              <input type="number" step="0.01" value={assetDraft.rental_income_monthly} onChange={(event) => setAssetDraft((current) => ({ ...current, rental_income_monthly: event.target.value }))} />
                            </label>
                            <label>
                              <span>День оплаты</span>
                              <input type="number" min="1" max="31" value={assetDraft.rental_payment_day} onChange={(event) => setAssetDraft((current) => ({ ...current, rental_payment_day: event.target.value }))} />
                            </label>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <label>
                      <span>Комментарий</span>
                      <input value={assetDraft.notes} onChange={(event) => setAssetDraft((current) => ({ ...current, notes: event.target.value }))} />
                    </label>
                    <button className="primary-button" type="submit" disabled={updateAsset.isPending}>Сохранить актив</button>
                  </form>
                ) : null}

                {record.kind === "deposit" ? (
                  <form
                    className="form-grid"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await updateDeposit.mutateAsync({
                        depositId: record.item.id,
                        payload: {
                          name: depositDraft.name,
                          institution_name: depositDraft.institution_name || undefined,
                          currency: depositDraft.currency,
                          principal_amount: Number(depositDraft.principal_amount || 0),
                          current_balance: Number(depositDraft.current_balance || 0),
                          annual_interest_rate: Number(depositDraft.annual_interest_rate || 0),
                          payout_frequency: depositDraft.payout_frequency,
                          capitalization_enabled: depositDraft.capitalization_enabled,
                          opened_on: depositDraft.opened_on,
                          maturity_date: depositDraft.maturity_date || undefined,
                          next_payout_date: depositDraft.next_payout_date || undefined,
                          early_withdrawal_terms: depositDraft.early_withdrawal_terms || undefined,
                          funding_account_id: depositDraft.funding_account_id || undefined,
                          status: depositDraft.status
                        }
                      });
                      onClose();
                    }}
                  >
                    <div className="two-column-grid">
                      <label>
                        <span>Название</span>
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
                        />
                      </div>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Стартовая сумма</span>
                        <input type="number" step="0.01" value={depositDraft.principal_amount} onChange={(event) => setDepositDraft((current) => ({ ...current, principal_amount: event.target.value }))} />
                      </label>
                      <label>
                        <span>Текущий баланс</span>
                        <input type="number" step="0.01" value={depositDraft.current_balance} onChange={(event) => setDepositDraft((current) => ({ ...current, current_balance: event.target.value }))} />
                      </label>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Ставка, % годовых</span>
                        <input type="number" step="0.01" value={depositDraft.annual_interest_rate} onChange={(event) => setDepositDraft((current) => ({ ...current, annual_interest_rate: event.target.value }))} />
                      </label>
                      <div>
                        <span className="form-label">Выплата процентов</span>
                        <SelectMenu
                          value={depositDraft.payout_frequency}
                          onChange={(payout_frequency) => setDepositDraft((current) => ({ ...current, payout_frequency }))}
                          options={[...DEPOSIT_PAYOUT_OPTIONS]}
                        />
                      </div>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Дата открытия</span>
                        <input type="date" value={depositDraft.opened_on} onChange={(event) => setDepositDraft((current) => ({ ...current, opened_on: event.target.value }))} />
                      </label>
                      <label>
                        <span>Дата закрытия</span>
                        <input type="date" value={depositDraft.maturity_date} onChange={(event) => setDepositDraft((current) => ({ ...current, maturity_date: event.target.value }))} />
                      </label>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Следующая выплата</span>
                        <input type="date" value={depositDraft.next_payout_date} onChange={(event) => setDepositDraft((current) => ({ ...current, next_payout_date: event.target.value }))} />
                      </label>
                      <label>
                        <span>Статус</span>
                        <input value={depositDraft.status} onChange={(event) => setDepositDraft((current) => ({ ...current, status: event.target.value }))} />
                      </label>
                    </div>
                    <label className="checkbox-row">
                      <span>Капитализация процентов</span>
                      <input
                        type="checkbox"
                        checked={depositDraft.capitalization_enabled}
                        onChange={(event) => setDepositDraft((current) => ({ ...current, capitalization_enabled: event.target.checked }))}
                      />
                    </label>
                    <label>
                      <span>Условия досрочного снятия</span>
                      <input value={depositDraft.early_withdrawal_terms} onChange={(event) => setDepositDraft((current) => ({ ...current, early_withdrawal_terms: event.target.value }))} />
                    </label>
                    <button className="primary-button" type="submit" disabled={updateDeposit.isPending}>Сохранить вклад</button>
                  </form>
                ) : null}

                {record.kind === "goal" ? (
                  <form
                    className="form-grid"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const targetAmount = Number(goalDraft.target_amount || 0);
                      await updateGoal.mutateAsync({
                        goalId: record.item.id,
                        payload: {
                          title: goalDraft.title,
                          target_amount: targetAmount,
                          currency: goalDraft.currency,
                          target_amount_in_base_currency: targetAmount,
                          deadline: goalDraft.deadline || undefined,
                          linked_account_id: goalDraft.linked_account_id || undefined,
                          linked_asset_id: record.item.linked_asset_id ?? undefined,
                          monthly_contribution_target: goalDraft.monthly_contribution_target ? Number(goalDraft.monthly_contribution_target) : undefined,
                          priority: Number(goalDraft.priority || 1),
                          auto_funding_enabled: record.item.auto_funding_enabled ?? false,
                          status: goalDraft.status
                        }
                      });
                      onClose();
                    }}
                  >
                    <label>
                      <span>Название цели</span>
                      <input value={goalDraft.title} onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    <div className="two-column-grid">
                      <label>
                        <span>Сумма цели</span>
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
                        <span>Дедлайн</span>
                        <input type="date" value={goalDraft.deadline} onChange={(event) => setGoalDraft((current) => ({ ...current, deadline: event.target.value }))} />
                      </label>
                      <div>
                        <span className="form-label">Счёт для пополнения</span>
                        <SelectMenu
                          value={goalDraft.linked_account_id}
                          onChange={(linked_account_id) => setGoalDraft((current) => ({ ...current, linked_account_id }))}
                          options={[{ value: "", label: "Без привязки", hint: "Можно выбрать позже" }, ...accountOptions]}
                        />
                      </div>
                    </div>
                    <div className="two-column-grid">
                      <label>
                        <span>Плановый взнос в месяц</span>
                        <input type="number" step="0.01" value={goalDraft.monthly_contribution_target} onChange={(event) => setGoalDraft((current) => ({ ...current, monthly_contribution_target: event.target.value }))} />
                      </label>
                      <label>
                        <span>Приоритет</span>
                        <input type="number" min="1" max="10" value={goalDraft.priority} onChange={(event) => setGoalDraft((current) => ({ ...current, priority: event.target.value }))} />
                      </label>
                    </div>
                    <div>
                      <span className="form-label">Статус</span>
                      <SelectMenu value={goalDraft.status} onChange={(status) => setGoalDraft((current) => ({ ...current, status: status as GoalForecast["status"] }))} options={goalStatusOptions} />
                    </div>
                    <button className="primary-button" type="submit" disabled={updateGoal.isPending}>Сохранить цель</button>
                  </form>
                ) : null}
              </>
            ) : (
              <div className="stack-list">
                <div className="section-metric">
                  <span>Что произойдёт</span>
                  <strong>Запись уйдёт из активного списка, но история останется для аналитики и аудита.</strong>
                </div>
                <button
                  type="button"
                  className="ghost-button danger-button"
                  onClick={async () => {
                    if (record.kind === "account") await deleteAccount.mutateAsync(record.item.id);
                    if (record.kind === "asset") await deleteAsset.mutateAsync(record.item.id);
                    if (record.kind === "deposit") await deleteDeposit.mutateAsync(record.item.id);
                    if (record.kind === "goal") await deleteGoal.mutateAsync(record.item.id);
                    onClose();
                  }}
                  disabled={deleteAccount.isPending || deleteAsset.isPending || deleteDeposit.isPending || deleteGoal.isPending}
                >
                  Убрать из списка
                </button>
              </div>
            )}
          </Surface>
        </div>
      </aside>
    </div>
  );
}
