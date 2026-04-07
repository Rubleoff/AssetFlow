import { useEffect, useState } from "react";

import { useAccounts, useGoalContributionMutation } from "../lib/query";
import type { GoalForecast } from "../lib/types";
import { money } from "../lib/format";
import { ChoiceCards, SelectMenu, Surface } from "./ui";

type GoalContributionDrawerProps = {
  open: boolean;
  goal: GoalForecast | null;
  currency: string;
  defaultDirection?: "fund" | "withdraw";
  onClose: () => void;
  onSuccess?: (goal: GoalForecast, direction: "fund" | "withdraw") => void;
};

const today = new Date().toISOString().slice(0, 10);

export function GoalContributionDrawer({
  open,
  goal,
  currency,
  defaultDirection = "fund",
  onClose,
  onSuccess
}: GoalContributionDrawerProps) {
  const accounts = useAccounts();
  const contributeGoal = useGoalContributionMutation();
  const [direction, setDirection] = useState<"fund" | "withdraw">("fund");
  const [amount, setAmount] = useState("");
  const [contributedOn, setContributedOn] = useState(today);
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (!open || !goal) return;
    const suggested = goal.required_monthly_contribution > 0 ? String(goal.required_monthly_contribution) : "";
    setDirection(defaultDirection);
    setAmount(suggested);
    setContributedOn(today);
    setAccountId(goal.linked_account_id ?? accounts.data?.[0]?.id ?? "");
  }, [accounts.data, defaultDirection, goal, open]);

  if (!open || !goal) return null;

  const accountOptions = (accounts.data ?? []).map((account) => ({
    value: account.id,
    label: account.name,
    hint: account.currency
  }));
  const actionLabel = direction === "fund" ? "Пополнить" : "Забрать";
  const helperCopy =
    direction === "fund"
      ? "Деньги будут списаны с выбранного счёта, прогресс цели вырастет, а в истории появится системная операция."
      : "Деньги вернутся на выбранный счёт, прогресс цели уменьшится, а в истории появится системная операция.";

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="create-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="kicker">Цель</span>
            <h3>{goal.title}</h3>
            <p>{helperCopy}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          <Surface>
            <div className="section-metrics">
              <div className="section-metric">
                <span>Уже накоплено</span>
                <strong>{money(goal.saved_amount, currency)}</strong>
              </div>
              <div className="section-metric">
                <span>Осталось</span>
                <strong>{money(goal.remaining_amount, currency)}</strong>
              </div>
              <div className="section-metric">
                <span>Цель</span>
                <strong>{money(goal.target_amount, currency)}</strong>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                const updatedGoal = await contributeGoal.mutateAsync({
                  goalId: goal.id,
                  payload: {
                    amount: Number(amount),
                    amount_in_base_currency: Number(amount),
                    account_id: accountId,
                    direction,
                    contributed_on: contributedOn
                  }
                });
                onSuccess?.(updatedGoal, direction);
                onClose();
              }}
            >
              <div>
                <span className="form-label">Действие</span>
                <ChoiceCards
                  value={direction}
                  onChange={(value) => setDirection(value)}
                  options={[
                    { value: "fund", label: "Пополнить", hint: "Отправить деньги в цель" },
                    { value: "withdraw", label: "Забрать", hint: "Вернуть деньги обратно на счёт" }
                  ]}
                  compact
                />
              </div>
              <div>
                <span className="form-label">Счёт</span>
                <SelectMenu
                  value={accountId}
                  onChange={setAccountId}
                  options={accountOptions}
                  placeholder="Выберите счёт"
                />
              </div>
              <label>
                <span>{direction === "fund" ? "Сколько отправить в цель" : "Сколько вернуть со цели"}</span>
                <input type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label>
                <span>Дата операции</span>
                <input type="date" value={contributedOn} onChange={(event) => setContributedOn(event.target.value)} />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={contributeGoal.isPending || Number(amount) <= 0 || !accountId}
              >
                {actionLabel}
              </button>
            </form>
          </Surface>
        </div>
      </aside>
    </div>
  );
}
