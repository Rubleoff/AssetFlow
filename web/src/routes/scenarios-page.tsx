import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartToneLegend, EmptyState, PageHeader, Pill, Surface } from "../components/ui";
import { buildTrendGradientStopsByKey, getChartSeriesLabel, getSeriesTrendToneByKey, getTrendFillColor, getTrendStrokeColor } from "../lib/chart-chroma";
import { compactNumber } from "../lib/format";
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
  const scenarioMonths = result?.months ?? [];
  const balanceTrendStops = buildTrendGradientStopsByKey(scenarioMonths, "balance");
  const netWorthTrendStops = buildTrendGradientStopsByKey(scenarioMonths, "net_worth");
  const balanceTone = getSeriesTrendToneByKey(scenarioMonths, "balance");
  const netWorthTone = getSeriesTrendToneByKey(scenarioMonths, "net_worth");
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
                <AreaChart data={scenarioMonths}>
                  <defs>
                    <linearGradient id="scenario-balance-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                      {balanceTrendStops.map((stop, index) => (
                        <stop key={`scenario-balance-stop-${index}`} offset={`${(stop.offset * 100).toFixed(3)}%`} stopColor={stop.color} />
                      ))}
                    </linearGradient>
                    <linearGradient id="scenario-networth-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                      {netWorthTrendStops.map((stop, index) => (
                        <stop key={`scenario-networth-stop-${index}`} offset={`${(stop.offset * 100).toFixed(3)}%`} stopColor={stop.color} />
                      ))}
                    </linearGradient>
                    <linearGradient id="scenario-balance-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getTrendFillColor(balanceTone)} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={getTrendFillColor(balanceTone)} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="scenario-networth-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getTrendFillColor(netWorthTone)} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={getTrendFillColor(netWorthTone)} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <XAxis dataKey="month_index" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [compactNumber(Number(value)), getChartSeriesLabel(String(name))]} />
                  <Area type="monotone" dataKey="balance" name={getChartSeriesLabel("balance")} stroke={getTrendStrokeColor(balanceTone)} strokeWidth={2.5} fill="url(#scenario-balance-fill)" />
                  <Area type="monotone" dataKey="net_worth" name={getChartSeriesLabel("net_worth")} stroke={getTrendStrokeColor(netWorthTone)} strokeWidth={2.5} fill="url(#scenario-networth-fill)" />
                  <Line type="monotone" dataKey="balance" name={getChartSeriesLabel("balance")} stroke={getTrendStrokeColor(balanceTone)} strokeWidth={4} dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="balance" stroke="url(#scenario-balance-stroke)" strokeWidth={3} dot={false} tooltipType="none" />
                  <Line type="monotone" dataKey="net_worth" name={getChartSeriesLabel("net_worth")} stroke={getTrendStrokeColor(netWorthTone)} strokeWidth={4} dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="net_worth" stroke="url(#scenario-networth-stroke)" strokeWidth={3} dot={false} tooltipType="none" />
                </AreaChart>
              </ResponsiveContainer>
              <ChartToneLegend />
            </>
          ) : (
            <EmptyState title="Прогноз ещё не построен" body="Запустите сценарий, чтобы сравнить баланс и net worth по месяцам." />
          )}
        </Surface>
      </div>
    </div>
  );
}
