export const money = (value: number, currency = "RUB") =>
  (() => {
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "BTC" || currency === "ETH" ? 6 : 2
      }).format(value ?? 0);
    } catch {
      return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: currency === "BTC" || currency === "ETH" ? 6 : 2
      }).format(value ?? 0) + ` ${currency}`;
    }
  })();

export const compactNumber = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value ?? 0);

export const percent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
