import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DataTable, Mono, PageHeader, Surface } from "../components/ui";
import { dateLabel, money } from "../lib/format";
import { useBudgets, useCurrentUser } from "../lib/query";

export function BudgetsPage() {
  const budgets = useBudgets();
  const user = useCurrentUser();
  const currency = user.data?.base_currency ?? "RUB";
  const summary = (budgets.data ?? []).reduce(
    (acc, budget) => {
      acc.limit += Number(budget.amount);
      acc.spent += Number(budget.spent);
      acc.forecast += Number(budget.forecast_spent);
      return acc;
    },
    { limit: 0, spent: 0, forecast: 0 }
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Бюджет"
        title="План расходов"
        description="Бюджет помогает заранее увидеть, где траты начинают выходить за комфортный предел."
      />

      <div className="content-grid">
        <Surface className="span-3">
          <div className="panel-header">
            <div>
              <span className="kicker">Картина по лимитам</span>
              <h3>Сколько запланировано, уже потрачено и куда ведёт текущий темп</h3>
            </div>
          </div>
          <div className="section-metrics">
            <div className="section-metric">
              <span>Всего лимитов</span>
              <strong>{money(summary.limit, currency)}</strong>
            </div>
            <div className="section-metric">
              <span>Уже потрачено</span>
              <strong>{money(summary.spent, currency)}</strong>
            </div>
            <div className="section-metric">
              <span>Прогноз</span>
              <strong>{money(summary.forecast, currency)}</strong>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={budgets.data ?? []}>
              <CartesianGrid stroke="#d7deeb" strokeDasharray="4 4" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#d9e6ff" radius={[8, 8, 0, 0]} />
              <Bar dataKey="spent" fill="#0052ff" radius={[8, 8, 0, 0]} />
              <Bar dataKey="forecast_spent" fill="#0a0b0d" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <DataTable
            columns={["Зона", "Лимит", "Потрачено", "Прогноз", "Остаток", "Период"]}
            rows={(budgets.data ?? []).map((budget) => [
              budget.name,
              <Mono key={`${budget.id}-limit`}>{money(budget.amount, currency)}</Mono>,
              <Mono key={`${budget.id}-spent`}>{money(budget.spent, currency)}</Mono>,
              <Mono key={`${budget.id}-forecast`}>{money(budget.forecast_spent, currency)}</Mono>,
              <Mono key={`${budget.id}-remaining`}>{money(Math.max(budget.amount - budget.spent, 0), currency)}</Mono>,
              `${dateLabel(budget.period_start)} - ${dateLabel(budget.period_end)}`
            ])}
          />
        </Surface>
      </div>
    </div>
  );
}
