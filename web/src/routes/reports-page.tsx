import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DataTable, EmptyState, Mono, PageHeader, Pill, SelectMenu, Surface } from "../components/ui";
import { dateLabel, money, percent } from "../lib/format";
import {
  useAccounts,
  useApplyImportMutation,
  useAllocationReport,
  useCashFlow,
  useCategoryDynamics,
  useCurrentUser,
  useExportTransactionsCsvMutation,
  useImportDetail,
  useImports,
  useMerchantReport,
  useNetWorthTimeline,
  usePreviewImportMutation
} from "../lib/query";
import type { ImportJobDetail, ImportJobSummary } from "../lib/types";

const previewSchema = z.object({
  filename: z.string().min(3),
  rowsText: z.string().min(10)
});

const applySchema = z.object({
  account_id: z.string().min(1),
  force_duplicates: z.boolean().default(false)
});

function parseImportRows(raw: string) {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const body = lines[0]?.toLowerCase().startsWith("date,") ? lines.slice(1) : lines;
  return body.map((line) => {
    const [transaction_date, amount, currency, merchant_name, ...descriptionParts] = line.split(",");
    return {
      transaction_date,
      amount: Number(amount),
      currency: currency || "USD",
      merchant_name: merchant_name || undefined,
      description: descriptionParts.join(",") || undefined
    };
  });
}

export function ReportsPage() {
  const user = useCurrentUser();
  const categoryDynamics = useCategoryDynamics();
  const merchantReport = useMerchantReport();
  const allocationReport = useAllocationReport();
  const netWorthTimeline = useNetWorthTimeline();
  const cashFlow = useCashFlow();
  const imports = useImports();
  const accounts = useAccounts();
  const previewImport = usePreviewImportMutation();
  const applyImport = useApplyImportMutation();
  const exportCsv = useExportTransactionsCsvMutation();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const detail = useImportDetail(selectedJobId);
  const currency = user.data?.base_currency ?? "RUB";
  const jobs = (imports.data ?? []) as ImportJobSummary[];
  const detailData = detail.data as ImportJobDetail | undefined;

  const downloadCsv = async () => {
    const csv = await exportCsv.mutateAsync();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "assetflow-transactions.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!selectedJobId && jobs[0]?.id) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const previewForm = useForm({
    resolver: zodResolver(previewSchema),
    defaultValues: {
      filename: "statement.csv",
      rowsText: "date,amount,currency,merchant,description\n2026-04-04,18.25,USD,Coffee Lab,Latte\n2026-04-06,52.10,USD,Paper & Bean,Office supplies"
    }
  });
  const applyForm = useForm({
    resolver: zodResolver(applySchema),
    defaultValues: {
      account_id: "",
      force_duplicates: false
    }
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Отчёты"
        title="Отчёты"
        description="Категории, мерчанты, капитал и экспорт операций."
        action={<button className="primary-button" type="button" onClick={() => void downloadCsv()} disabled={exportCsv.isPending}>Экспорт CSV</button>}
      />
      <div className="content-grid">
        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Категории</span><h3>Рост и спад категорий месяц к месяцу</h3></div></div>
          <DataTable
            columns={["Категория", "Текущий месяц", "Прошлый месяц", "Изменение"]}
            rows={(categoryDynamics.data ?? []).map((category) => [
              category.category,
              <Mono key={`${category.category}-current`}>{money(category.current_amount, currency)}</Mono>,
              <Mono key={`${category.category}-previous`}>{money(category.previous_amount, currency)}</Mono>,
              <span key={`${category.category}-growth`} className={category.growth_pct >= 0 ? "text-blue" : "text-dark"}>{percent(category.growth_pct)}</span>
            ])}
          />
        </Surface>

        <Surface>
          <div className="panel-header"><div><span className="kicker">Мерчанты</span><h3>Кто съедает бюджет</h3></div></div>
          <DataTable
            columns={["Мерчант", "Текущий месяц", "Прошлый месяц", "Изменение", "Операций"]}
            rows={(merchantReport.data?.merchants ?? []).slice(0, 6).map((merchant) => [
              merchant.merchant_name,
              <Mono key={`${merchant.merchant_name}-current`}>{money(merchant.current_amount, currency)}</Mono>,
              <Mono key={`${merchant.merchant_name}-previous`}>{money(merchant.previous_amount, currency)}</Mono>,
              <span key={`${merchant.merchant_name}-growth`} className={merchant.growth_pct >= 0 ? "text-blue" : "text-dark"}>{percent(merchant.growth_pct)}</span>,
              String(merchant.transaction_count)
            ])}
          />
        </Surface>

        <Surface>
          <div className="panel-header"><div><span className="kicker">Импорт</span><h3>Вставьте CSV-строки для предварительного просмотра</h3></div></div>
          <form
            className="form-grid"
            onSubmit={previewForm.handleSubmit(async (values) => {
              const result = await previewImport.mutateAsync({
                filename: values.filename,
                rows: parseImportRows(values.rowsText)
              });
              setSelectedJobId(result.job_id);
            })}
          >
            <label><span>Имя файла</span><input {...previewForm.register("filename")} /></label>
            <label><span>Строки CSV</span><textarea rows={8} {...previewForm.register("rowsText")} /></label>
            <button className="primary-button" type="submit" disabled={previewImport.isPending}>Предпросмотр импорта</button>
          </form>
        </Surface>

        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Сессии импорта</span><h3>Предпросмотр, проверка и применение строк</h3></div></div>
          <div className="stack-list">
            {jobs.map((item) => {
              const summary = (item.summary ?? {}) as Record<string, unknown>;
              return (
              <button
                key={item.id}
                type="button"
                className={`nav-link ${selectedJobId === item.id ? "active" : ""}`}
                onClick={() => setSelectedJobId(item.id)}
              >
                <span>
                  <strong>{item.filename}</strong>
                  <span className="subtle"> {item.status}</span>
                </span>
                <Pill tone="neutral">{String(summary.duplicates ?? 0)} дублей</Pill>
              </button>
              );
            })}
          </div>
        </Surface>

        <Surface>
          <div className="panel-header"><div><span className="kicker">Применение</span><h3>Записать подготовленные строки в ledger</h3></div></div>
          {detailData ? (
            <form
              className="form-grid"
              onSubmit={applyForm.handleSubmit(async (values) => {
                const duplicateIds = values.force_duplicates
                  ? detailData.rows.filter((row) => row.status === "duplicate").map((row) => row.id)
                  : [];
                await applyImport.mutateAsync({
                  jobId: detailData.job.id,
                  payload: {
                    account_id: values.account_id,
                    type: "expense",
                    source_type: "imported",
                    force_duplicate_row_ids: duplicateIds
                  }
                });
              })}
            >
              <div>
                <span className="form-label">Счёт</span>
                <SelectMenu
                  value={applyForm.watch("account_id")}
                  onChange={(value) => applyForm.setValue("account_id", value)}
                  options={(accounts.data ?? []).map((account) => ({
                    value: account.id,
                    label: account.name,
                    hint: account.currency
                  }))}
                  placeholder="Выберите счёт"
                />
              </div>
              <label className="checkbox-row"><span>Импортировать даже дубли</span><input type="checkbox" {...applyForm.register("force_duplicates")} /></label>
              <button className="primary-button" type="submit" disabled={applyImport.isPending}>Применить строки</button>
            </form>
          ) : (
            <EmptyState title="Импорт не выбран" body="Сначала сделайте предпросмотр или выберите существующую сессию импорта." />
          )}
        </Surface>

        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Детализация</span><h3>Статусы строк и конфликты дедупликации</h3></div></div>
          {detailData ? (
            <DataTable
              columns={["Строка", "Дата", "Мерчант", "Сумма", "Статус", "Конфликт"]}
              rows={detailData.rows.map((row) => [
                String(row.row_number),
                dateLabel(String(row.normalized_payload?.transaction_date ?? row.raw_payload.transaction_date)),
                String(row.normalized_payload?.merchant_name ?? row.raw_payload.merchant_name ?? "Manual"),
                <Mono key={`${row.id}-amount`}>{money(Number(row.normalized_payload?.amount ?? row.raw_payload.amount ?? 0), String(row.normalized_payload?.currency ?? row.raw_payload.currency ?? "USD"))}</Mono>,
                row.status,
                row.duplicate_reason ?? "None"
              ])}
            />
          ) : (
            <EmptyState title="Нет деталей импорта" body="Выберите сессию импорта, чтобы увидеть строки и конфликты." />
          )}
        </Surface>

        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Cash flow</span><h3>Ежедневная серия движения денег</h3></div></div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={cashFlow.data ?? []}>
              <CartesianGrid stroke="#d7deeb" strokeDasharray="4 4" />
              <XAxis dataKey="date" tickFormatter={dateLabel} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="net" stroke="#0052ff" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Surface>

        <Surface>
          <div className="panel-header"><div><span className="kicker">Структура</span><h3>Смесь активов по текущей стоимости</h3></div></div>
          <DataTable
            columns={["Актив", "Стоимость", "Доля"]}
            rows={(allocationReport.data?.allocations ?? []).map((allocation) => [
              allocation.label,
              <Mono key={`${allocation.label}-value`}>{money(allocation.value, currency)}</Mono>,
              `${allocation.allocation_pct.toFixed(1)}%`
            ])}
          />
        </Surface>

        <Surface className="span-2">
          <div className="panel-header"><div><span className="kicker">Net worth</span><h3>История баланса капитала по снапшотам</h3></div></div>
          <DataTable
            columns={["Дата", "Активы", "Обязательства", "Net worth"]}
            rows={(netWorthTimeline.data ?? []).map((point) => [
              dateLabel(point.date),
              <Mono key={`${point.date}-assets`}>{money(point.assets, currency)}</Mono>,
              <Mono key={`${point.date}-liabilities`}>{money(point.liabilities, currency)}</Mono>,
              <Mono key={`${point.date}-net`}>{money(point.net_worth, currency)}</Mono>
            ])}
          />
        </Surface>
      </div>
    </div>
  );
}
