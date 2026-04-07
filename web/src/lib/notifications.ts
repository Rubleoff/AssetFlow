import type { NotificationRead } from "./types";

const notificationTypeLabels: Record<NotificationRead["type"], string> = {
  budget_threshold: "Бюджет",
  recurring_upcoming: "Скоро списание",
  insufficient_funds: "Не хватает денег",
  anomaly: "Аномалия",
  goal_lagging: "Цель отстаёт",
  import_pending: "Импорт",
  asset_update: "Активы",
  digest: "Сводка"
};

function localizeTitle(notification: NotificationRead): string {
  const { title, type } = notification;
  if (type === "budget_threshold") {
    const match = title.match(/^(.*) budget is (\d+)% used$/i);
    if (match) {
      return `${match[1]}: использовано ${match[2]}% лимита`;
    }
  }
  if (title === "Recurring burden is elevated") return "Регулярные платежи занимают заметную долю дохода";
  if (title === "Emergency coverage is thin") return "Подушка безопасности пока слишком маленькая";
  if (title === "Current month is cash-flow negative") return "В этом месяце расходы уже выше дохода";
  if (title.includes("Merchant spike detected for ")) {
    return `Расход у мерчанта выше обычного: ${title.replace("Merchant spike detected for ", "")}`;
  }
  if (title.endsWith(" spend is above baseline")) {
    return `Категория трат выше обычного: ${title.replace(" spend is above baseline", "")}`;
  }
  if (title.includes(" is the largest expense bucket")) {
    return `${title.replace(" is the largest expense bucket", "")}: самая затратная категория`;
  }
  return title;
}

function localizeBody(notification: NotificationRead): string {
  const { body, type } = notification;
  if (type === "budget_threshold" && body === "You are approaching your groceries budget for this month.") {
    return "Траты по этой зоне уже близко подошли к лимиту на текущий месяц.";
  }
  const merchantMatch = body.match(
    /^Spend of ([\d.]+) is above the 90-day merchant baseline of ([\d.]+) across (\d+) prior transactions\.$/
  );
  if (merchantMatch) {
    return `Сумма ${merchantMatch[1]} выше обычного уровня по этому мерчанту за 90 дней. Основание: ${merchantMatch[3]} прошлых операций со средним ${merchantMatch[2]}.`;
  }
  const categoryMatch = body.match(
    /^This entry landed at ([\d.]+) versus a 90-day category average of ([\d.]+) over (\d+) prior entries\.$/
  );
  if (categoryMatch) {
    return `Эта операция заметно выше обычного уровня по категории: ${categoryMatch[1]} против среднего ${categoryMatch[2]} за ${categoryMatch[3]} прошлых записей.`;
  }
  const recurringMatch = body.match(/^Recurring obligations consume ([\d.]+)% of current monthly income\.$/);
  if (recurringMatch) {
    return `Регулярные платежи занимают ${recurringMatch[1]}% текущего месячного дохода.`;
  }
  const emergencyMatch = body.match(/^Liquid reserves cover about ([\d.]+) months of essential spending\.$/);
  if (emergencyMatch) {
    return `Ликвидного резерва хватает примерно на ${emergencyMatch[1]} месяца обязательных расходов.`;
  }
  if (body === "Expenses are above income for the current month. Review discretionary categories.") {
    return "Расходы уже выше доходов за текущий месяц. Стоит пересмотреть гибкие категории.";
  }
  const topCategoryMatch = body.match(/^Spend is ([\d.]+) in base currency this month with ([\d.-]+)% change\.$/);
  if (topCategoryMatch) {
    return `В этом месяце в категории уже потрачено ${topCategoryMatch[1]} в базовой валюте. Изменение к прошлому периоду: ${topCategoryMatch[2]}%.`;
  }
  return body;
}

export function presentNotification(notification: NotificationRead) {
  return {
    badge: notificationTypeLabels[notification.type] ?? notification.type,
    title: localizeTitle(notification),
    body: localizeBody(notification)
  };
}
