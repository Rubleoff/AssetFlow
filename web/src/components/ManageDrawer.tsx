import { useEffect, useState } from "react";

import { CURRENCY_OPTIONS, TRANSACTION_TYPE_OPTIONS } from "../lib/catalog";
import {
  useAccounts,
  useCategories,
  useRecurringDeleteMutation,
  useRecurringUpdateMutation,
  useTransactionDeleteMutation,
  useTransactionUpdateMutation
} from "../lib/query";
import type { RecurringSchedule, TransactionRead, TransactionType } from "../lib/types";
import { ChoiceCards, SelectMenu, Surface } from "./ui";

type ManageDrawerProps =
  | {
      open: boolean;
      record: { kind: "transaction"; item: TransactionRead } | null;
      defaultTab?: DrawerTab;
      onClose: () => void;
    }
  | {
      open: boolean;
      record: { kind: "recurring"; item: RecurringSchedule } | null;
      defaultTab?: DrawerTab;
      onClose: () => void;
    };

type DrawerTab = "edit" | "delete";

const frequencyOptions: Array<{ value: "weekly" | "monthly" | "yearly"; label: string; hint: string }> = [
  { value: "weekly", label: "Еженедельно", hint: "Раз в неделю" },
  { value: "monthly", label: "Ежемесячно", hint: "Раз в месяц" },
  { value: "yearly", label: "Ежегодно", hint: "Раз в год" }
];

export function ManageDrawer({ open, record, defaultTab = "edit", onClose }: ManageDrawerProps) {
  const accounts = useAccounts();
  const categories = useCategories();
  const updateTransaction = useTransactionUpdateMutation();
  const deleteTransaction = useTransactionDeleteMutation();
  const updateRecurring = useRecurringUpdateMutation();
  const deleteRecurring = useRecurringDeleteMutation();

  const [tab, setTab] = useState<DrawerTab>("edit");
  const [transactionDraft, setTransactionDraft] = useState({
    account_id: "",
    type: "expense" as TransactionType,
    amount: "0",
    currency: "RUB",
    category_id: "",
    merchant_name: "",
    description: "",
    transaction_date: "",
    posting_date: "",
    notes: ""
  });
  const [recurringDraft, setRecurringDraft] = useState({
    account_id: "",
    name: "",
    amount: "0",
    currency: "RUB",
    amount_in_base_currency: "0",
    frequency: "monthly" as "weekly" | "monthly" | "yearly",
    next_due_date: "",
    reminder_days_before: "3",
    category_id: "",
    fixed_or_variable: "fixed",
    merchant_name: "",
    notes: ""
  });

  useEffect(() => {
    if (!open || !record) return;
    setTab(defaultTab);
    if (record.kind === "transaction") {
      setTransactionDraft({
        account_id: record.item.account_id,
        type: record.item.type,
        amount: String(record.item.amount),
        currency: record.item.currency,
        category_id: record.item.category_id ?? "",
        merchant_name: record.item.merchant_name ?? "",
        description: record.item.description ?? "",
        transaction_date: record.item.transaction_date,
        posting_date: record.item.posting_date,
        notes: record.item.notes ?? ""
      });
      return;
    }

    setRecurringDraft({
      account_id: record.item.account_id,
      name: record.item.name,
      amount: String(record.item.amount),
      currency: record.item.currency,
      amount_in_base_currency: String(record.item.amount_in_base_currency),
      frequency: record.item.frequency,
      next_due_date: record.item.next_due_date,
      reminder_days_before: String(record.item.reminder_days_before),
      category_id: record.item.category_id ?? "",
      fixed_or_variable: record.item.fixed_or_variable,
      merchant_name: record.item.merchant_name ?? "",
      notes: record.item.notes ?? ""
    });
  }, [defaultTab, open, record]);

  if (!open || !record) return null;

  const accountOptions = (accounts.data ?? []).map((account) => ({
    value: account.id,
    label: account.name,
    hint: account.currency
  }));
  const categoryOptions = [
    { value: "", label: "Без категории", hint: "Можно назначить позже" },
    ...(categories.data ?? []).map((category) => ({
      value: String(category.id),
      label: String(category.name),
      hint: category.direction ? String(category.direction) : "Категория"
    }))
  ];

  const title = record.kind === "transaction" ? "Операция" : "Регулярный платёж";
  const subtitle =
    record.kind === "transaction"
      ? "Исправьте сумму, мерчанта, счёт или описание записи."
      : "Настройте сумму, периодичность и следующее списание.";

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="create-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="kicker">{title}</span>
            <h3>{tab === "edit" ? `Редактировать: ${title}` : `Удалить: ${title}`}</h3>
            <p>{subtitle}</p>
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
            Удалить
          </button>
        </div>

        <div className="drawer-body">
          <Surface>
            {tab === "edit" ? (
              record.kind === "transaction" ? (
                <form
                  className="form-grid"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await updateTransaction.mutateAsync({
                      transactionId: record.item.id,
                      payload: {
                        account_id: transactionDraft.account_id,
                        type: transactionDraft.type,
                        amount: Number(transactionDraft.amount),
                        currency: transactionDraft.currency,
                        amount_in_base_currency: Number(transactionDraft.amount),
                        fx_rate: 1,
                        category_id: transactionDraft.category_id || undefined,
                        merchant_name: transactionDraft.merchant_name || undefined,
                        description: transactionDraft.description || undefined,
                        transaction_date: transactionDraft.transaction_date,
                        posting_date: transactionDraft.posting_date,
                        notes: transactionDraft.notes || undefined,
                        splits: [],
                        tag_ids: [],
                        source_type: record.item.source_type,
                        linked_asset_id: undefined
                      }
                    });
                    onClose();
                  }}
                >
                  <div>
                    <span className="form-label">Тип операции</span>
                    <ChoiceCards
                      value={transactionDraft.type}
                      onChange={(type) => setTransactionDraft((current) => ({ ...current, type }))}
                      options={TRANSACTION_TYPE_OPTIONS}
                      compact
                    />
                  </div>
                  <div className="two-column-grid">
                    <div>
                      <span className="form-label">Счёт</span>
                      <SelectMenu
                        value={transactionDraft.account_id}
                        onChange={(account_id) => setTransactionDraft((current) => ({ ...current, account_id }))}
                        options={accountOptions}
                        placeholder="Выберите счёт"
                      />
                    </div>
                    <div>
                      <span className="form-label">Категория</span>
                      <SelectMenu
                        value={transactionDraft.category_id}
                        onChange={(category_id) => setTransactionDraft((current) => ({ ...current, category_id }))}
                        options={categoryOptions}
                      />
                    </div>
                  </div>
                  <label>
                    <span>Мерчант</span>
                    <input
                      value={transactionDraft.merchant_name}
                      onChange={(event) => setTransactionDraft((current) => ({ ...current, merchant_name: event.target.value }))}
                    />
                  </label>
                  <div className="two-column-grid">
                    <label>
                      <span>Сумма</span>
                      <input
                        type="number"
                        step="0.01"
                        value={transactionDraft.amount}
                        onChange={(event) => setTransactionDraft((current) => ({ ...current, amount: event.target.value }))}
                      />
                    </label>
                    <div>
                      <span className="form-label">Валюта</span>
                      <SelectMenu
                        value={transactionDraft.currency}
                        onChange={(currency) => setTransactionDraft((current) => ({ ...current, currency }))}
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
                    <span>Описание</span>
                    <input
                      value={transactionDraft.description}
                      onChange={(event) => setTransactionDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Заметка</span>
                    <textarea
                      value={transactionDraft.notes}
                      onChange={(event) => setTransactionDraft((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                  <div className="two-column-grid">
                    <label>
                      <span>Дата операции</span>
                      <input
                        type="date"
                        value={transactionDraft.transaction_date}
                        onChange={(event) => setTransactionDraft((current) => ({ ...current, transaction_date: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Дата проводки</span>
                      <input
                        type="date"
                        value={transactionDraft.posting_date}
                        onChange={(event) => setTransactionDraft((current) => ({ ...current, posting_date: event.target.value }))}
                      />
                    </label>
                  </div>
                  <button className="primary-button" type="submit" disabled={updateTransaction.isPending}>
                    Сохранить изменения
                  </button>
                </form>
              ) : (
                <form
                  className="form-grid"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await updateRecurring.mutateAsync({
                      recurringId: record.item.id,
                      payload: {
                        account_id: recurringDraft.account_id,
                        name: recurringDraft.name,
                        amount: Number(recurringDraft.amount),
                        currency: recurringDraft.currency,
                        amount_in_base_currency: Number(recurringDraft.amount_in_base_currency),
                        frequency: recurringDraft.frequency,
                        interval_count: 1,
                        next_due_date: recurringDraft.next_due_date,
                        reminder_days_before: Number(recurringDraft.reminder_days_before),
                        category_id: recurringDraft.category_id || undefined,
                        fixed_or_variable: recurringDraft.fixed_or_variable,
                        merchant_name: recurringDraft.merchant_name || undefined,
                        notes: recurringDraft.notes || undefined
                      }
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
                      <input
                        type="number"
                        step="0.01"
                        value={recurringDraft.amount}
                        onChange={(event) => setRecurringDraft((current) => ({ ...current, amount: event.target.value }))}
                      />
                    </label>
                    <div>
                      <span className="form-label">Валюта</span>
                      <SelectMenu
                        value={recurringDraft.currency}
                        onChange={(currency) => setRecurringDraft((current) => ({ ...current, currency }))}
                        options={CURRENCY_OPTIONS.map((item) => ({
                          value: item.code,
                          label: `${item.code} · ${item.label}`,
                          hint: item.symbol
                        }))}
                        searchable
                      />
                    </div>
                  </div>
                  <div>
                    <span className="form-label">Периодичность</span>
                    <ChoiceCards
                      value={recurringDraft.frequency}
                      onChange={(frequency) => setRecurringDraft((current) => ({ ...current, frequency }))}
                      options={frequencyOptions}
                      compact
                    />
                  </div>
                  <div className="two-column-grid">
                    <label>
                      <span>Следующее списание</span>
                      <input
                        type="date"
                        value={recurringDraft.next_due_date}
                        onChange={(event) => setRecurringDraft((current) => ({ ...current, next_due_date: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Напоминание, дней</span>
                      <input
                        type="number"
                        min="0"
                        value={recurringDraft.reminder_days_before}
                        onChange={(event) => setRecurringDraft((current) => ({ ...current, reminder_days_before: event.target.value }))}
                      />
                    </label>
                  </div>
                  <label>
                    <span>Мерчант</span>
                    <input
                      value={recurringDraft.merchant_name}
                      onChange={(event) => setRecurringDraft((current) => ({ ...current, merchant_name: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Заметка</span>
                    <textarea
                      value={recurringDraft.notes}
                      onChange={(event) => setRecurringDraft((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                  <button className="primary-button" type="submit" disabled={updateRecurring.isPending}>
                    Сохранить изменения
                  </button>
                </form>
              )
            ) : (
              <div className="stack-list">
                <div className="list-item">
                  <strong>Удалить запись?</strong>
                  <p>
                    {record.kind === "transaction"
                      ? "Операция будет удалена из истории, а остаток по счёту и аналитика пересчитаются."
                      : "Шаблон регулярного платежа исчезнет из графика будущих списаний."}
                  </p>
                </div>
                <div className="inline-pills">
                  <button
                    type="button"
                    className="ghost-button danger-button"
                    disabled={record.kind === "transaction" ? deleteTransaction.isPending : deleteRecurring.isPending}
                    onClick={async () => {
                      if (record.kind === "transaction") {
                        await deleteTransaction.mutateAsync(record.item.id);
                      } else {
                        await deleteRecurring.mutateAsync(record.item.id);
                      }
                      onClose();
                    }}
                  >
                    Удалить запись
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setTab("edit")}>
                    Вернуться к редактированию
                  </button>
                </div>
              </div>
            )}
          </Surface>
        </div>
      </aside>
    </div>
  );
}
