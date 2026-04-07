import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { EmptyState, Mono, PageHeader, Pill, StatCard, Surface } from "../components/ui";
import { dateLabel, money, percent } from "../lib/format";
import { useCashFlow, useCurrentUser, useOverview } from "../lib/query";

export function DashboardPage() {
  const overview = useOverview();
  const cashFlow = useCashFlow();
  const user = useCurrentUser();
  const currency = user.data?.base_currency ?? "USD";

  if (!overview.data) {
    return <EmptyState title="Ждём данные сводки" body="Авторизуйтесь, чтобы загрузить аналитику дашборда." />;
  }

  const report = overview.data;
  const severityLabel: Record<string, string> = {
    critical: "Критично",
    warning: "Внимание",
    info: "Инсайт"
  };
  const localizedInsights = report.insights.map((insight) => {
    if (insight.title === "Recurring burden is elevated") {
      return {
        ...insight,
        title: "Регулярные платежи занимают заметную долю дохода",
        body: `Постоянные списания съедают ${report.recurring_burden_pct.toFixed(1)}% дохода за месяц.`
      };
    }
    if (insight.title === "Emergency coverage is thin") {
      return {
        ...insight,
        title: "Подушка безопасности пока слабая",
        body: `Текущих ликвидных денег хватает примерно на ${report.emergency_fund_months?.toFixed(1) ?? "0"} мес. обязательных расходов.`
      };
    }
    if (insight.title === "Current month is cash-flow negative") {
      return {
        ...insight,
        title: "В этом месяце расходы выше доходов",
        body: "Если темп сохранится, свободный остаток к концу месяца снизится."
      };
    }
    if (insight.title.includes("is the largest expense bucket")) {
      return {
        ...insight,
        title: `${report.top_categories[0]?.category ?? "Категория"} сейчас тянет больше всего расходов`,
        body: `За месяц здесь уже ${money(report.top_categories[0]?.current_amount ?? 0, currency)}.`
      };
    }
    return insight;
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Сводка"
        title="Сводка"
        description="Баланс, расходы, цели и важные сигналы за текущий период."
      />

      <div className="stats-grid">
        <StatCard label="Доступно сейчас" value={money(report.liquid_balance, currency)} hint="Деньги на счетах, которыми можно пользоваться сразу" />
        <StatCard label="Чистый капитал" value={money(report.net_worth, currency)} hint={`${report.runway_months ?? 0} мес. запаса при текущем темпе`} tone="accent" />
        <StatCard label="Расходы за месяц" value={money(report.monthly_expenses, currency)} hint={`${money(report.burn_rate, currency)}/день`} />
        <StatCard label="Остаётся от дохода" value={`${report.savings_rate}%`} hint={`${report.recurring_burden_pct}% уходит на регулярные платежи`} tone="dark" />
      </div>

      <div className="content-grid">
        <Surface className="chart-panel span-2">
          <div className="panel-header">
            <div>
              <span className="kicker">Движение денег</span>
              <h3>Движение денег за последние 30 дней</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={cashFlow.data ?? []}>
              <defs>
                <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0052ff" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0052ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d7deeb" strokeDasharray="4 4" />
              <XAxis dataKey="date" tickFormatter={dateLabel} />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="income" stroke="#0052ff" fill="url(#income)" />
              <Area type="monotone" dataKey="expenses" stroke="#0a0b0d" fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </Surface>

        <Surface className="insight-panel">
          <div className="panel-header">
            <div>
              <span className="kicker">Подсказки</span>
              <h3>Что стоит заметить</h3>
            </div>
          </div>
          <div className="stack-list">
            {localizedInsights.map((insight) => (
              <article key={insight.title} className="list-item">
                <Pill tone={insight.severity === "critical" ? "warning" : insight.severity === "warning" ? "blue" : "neutral"}>
                  {severityLabel[insight.severity] ?? insight.severity}
                </Pill>
                <strong>{insight.title}</strong>
                <p>{insight.body}</p>
              </article>
            ))}
          </div>
        </Surface>

        <Surface className="span-2">
          <div className="panel-header">
            <div>
              <span className="kicker">Капитал</span>
              <h3>Как менялся чистый капитал</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={report.net_worth_timeline}>
              <CartesianGrid stroke="#d7deeb" strokeDasharray="4 4" />
              <XAxis dataKey="date" tickFormatter={dateLabel} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="net_worth" stroke="#0052ff" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Surface>

        <Surface>
          <div className="panel-header">
            <div>
              <span className="kicker">Категории</span>
              <h3>Главные статьи расходов в этом месяце</h3>
            </div>
          </div>
          <div className="stack-list">
            {report.top_categories.map((category) => (
              <article key={category.category} className="list-item compact">
                <strong>{category.category}</strong>
                <div className="inline-metrics">
                  <Mono>{money(category.current_amount, currency)}</Mono>
                  <span className={category.growth_pct >= 0 ? "text-blue" : "text-dark"}>{percent(category.growth_pct)}</span>
                </div>
              </article>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}
