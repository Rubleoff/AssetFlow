import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EmptyState, PageHeader, Pill, Surface } from "../components/ui";
import { useScenarioMutation } from "../lib/query";

const scenarioSchema = z.object({
  name: z.string().min(2),
  months: z.coerce.number().min(1).max(24),
  monthly_income_delta: z.coerce.number(),
  discretionary_spend_delta: z.coerce.number(),
  recurring_delta: z.coerce.number(),
  monthly_contribution_delta: z.coerce.number(),
  monthly_asset_growth_rate: z.coerce.number()
});

export function ScenariosPage() {
  const scenario = useScenarioMutation();
  const [result, setResult] = useState<null | Awaited<ReturnType<typeof scenario.mutateAsync>>>(null);
  const form = useForm({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      name: "Сократить развлечения на 15%",
      months: 12,
      monthly_income_delta: 0,
      discretionary_spend_delta: -250,
      recurring_delta: 0,
      monthly_contribution_delta: 100,
      monthly_asset_growth_rate: 1
    }
  });

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Сценарии" title="Сценарии" description="Проверьте, как изменится баланс и капитал при другом темпе доходов и расходов." />
      <div className="content-grid">
        <Surface>
          <div className="panel-header"><div><span className="kicker">Конструктор</span><h3>Параметры сценария</h3></div></div>
          <form className="form-grid" onSubmit={form.handleSubmit(async (values) => setResult(await scenario.mutateAsync(values)))}>
            <label><span>Название</span><input {...form.register("name")} /></label>
            <label><span>Горизонт, мес</span><input type="number" {...form.register("months")} /></label>
            <label><span>Изменение дохода</span><input type="number" step="0.01" {...form.register("monthly_income_delta")} /></label>
            <label><span>Изменение гибких расходов</span><input type="number" step="0.01" {...form.register("discretionary_spend_delta")} /></label>
            <label><span>Изменение регулярных платежей</span><input type="number" step="0.01" {...form.register("recurring_delta")} /></label>
            <label><span>Изменение взносов</span><input type="number" step="0.01" {...form.register("monthly_contribution_delta")} /></label>
            <label><span>Рост активов, %</span><input type="number" step="0.01" {...form.register("monthly_asset_growth_rate")} /></label>
            <button className="primary-button" type="submit" disabled={scenario.isPending}>Построить прогноз</button>
          </form>
        </Surface>
        <Surface className="span-2">
          {result ? (
            <>
              <div className="panel-header"><div><span className="kicker">Результат</span><h3>{result.name}</h3></div><Pill tone="blue">{result.deficit_months} мес. дефицита</Pill></div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={result.months}>
                  <CartesianGrid stroke="#d7deeb" strokeDasharray="4 4" />
                  <XAxis dataKey="month_index" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="balance" stroke="#0052ff" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="net_worth" stroke="#0a0b0d" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <EmptyState title="Прогноз ещё не построен" body="Запустите сценарий, чтобы сравнить баланс и net worth по месяцам." />
          )}
        </Surface>
      </div>
    </div>
  );
}
