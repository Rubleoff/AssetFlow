export type TrendTone = "positive" | "neutral" | "negative";

export type TrendStop = {
  offset: number;
  color: string;
};

type TrendOptions = {
  direction?: 1 | -1;
  neutralRatio?: number;
};

type UtilizationThresholds = {
  warningAt?: number;
  criticalAt?: number;
};

const TREND_STROKE_COLORS: Record<TrendTone, string> = {
  positive: "#2fc47f",
  neutral: "#e7ad43",
  negative: "#ff6f7d"
};

const TREND_FILL_COLORS: Record<TrendTone, string> = {
  positive: "#2fc47f",
  neutral: "#e7ad43",
  negative: "#ff6f7d"
};

const CHART_SERIES_LABELS: Record<string, string> = {
  income: "Доходы",
  expense: "Расходы",
  expenses: "Расходы",
  net: "Чистый поток",
  net_worth: "Чистый капитал",
  balance: "Баланс",
  amount: "Лимит",
  spent: "Потрачено",
  forecast_spent: "Прогноз",
  price_in_base: "Цена"
};

const DEFAULT_NEUTRAL_RATIO = 0.018;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const seriesScale = (values: number[]) => {
  if (!values.length) return 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return Math.max(Math.abs(max - min), Math.abs(max), Math.abs(min), 1);
};

const classifyDelta = (delta: number, scale: number, neutralRatio: number): TrendTone => {
  const threshold = Math.max(scale * neutralRatio, 1e-9);
  if (delta > threshold) return "positive";
  if (delta < -threshold) return "negative";
  return "neutral";
};

const seriesEntries = <T>(data: T[], pickValue: (point: T) => unknown) =>
  data
    .map((point, index) => ({ index, value: toFiniteNumber(pickValue(point)) }))
    .filter((entry): entry is { index: number; value: number } => entry.value !== null);

export const getTrendStrokeColor = (tone: TrendTone) => TREND_STROKE_COLORS[tone];

export const getTrendFillColor = (tone: TrendTone) => TREND_FILL_COLORS[tone];

export const getChartSeriesLabel = (key: string) => CHART_SERIES_LABELS[key] ?? key;

export const getSeriesTrendTone = <T>(data: T[], pickValue: (point: T) => unknown, options?: TrendOptions): TrendTone => {
  const entries = seriesEntries(data, pickValue);
  if (entries.length < 2) return "neutral";

  const values = entries.map((entry) => entry.value);
  const direction = options?.direction ?? 1;
  const neutralRatio = options?.neutralRatio ?? DEFAULT_NEUTRAL_RATIO;
  const delta = (entries[entries.length - 1].value - entries[0].value) * direction;

  return classifyDelta(delta, seriesScale(values), neutralRatio);
};

export const getSeriesTrendToneByKey = <T extends Record<string, unknown>>(
  data: T[],
  key: keyof T & string,
  options?: TrendOptions
) => getSeriesTrendTone(data, (point) => point[key], options);

export const buildTrendGradientStops = <T>(data: T[], pickValue: (point: T) => unknown, options?: TrendOptions): TrendStop[] => {
  if (data.length < 2) {
    const neutral = getTrendStrokeColor("neutral");
    return [
      { offset: 0, color: neutral },
      { offset: 1, color: neutral }
    ];
  }

  const entries = seriesEntries(data, pickValue);
  if (entries.length < 2) {
    const neutral = getTrendStrokeColor("neutral");
    return [
      { offset: 0, color: neutral },
      { offset: 1, color: neutral }
    ];
  }

  const direction = options?.direction ?? 1;
  const neutralRatio = options?.neutralRatio ?? DEFAULT_NEUTRAL_RATIO;
  const scale = seriesScale(entries.map((entry) => entry.value));
  const divisor = Math.max(data.length - 1, 1);

  const stops: TrendStop[] = [];
  let previousTone: TrendTone | null = null;

  for (let index = 1; index < entries.length; index += 1) {
    const left = entries[index - 1];
    const right = entries[index];
    const segmentTone = classifyDelta((right.value - left.value) * direction, scale, neutralRatio);
    const segmentColor = getTrendStrokeColor(segmentTone);
    const startOffset = clamp(left.index / divisor, 0, 1);
    const endOffset = clamp(right.index / divisor, 0, 1);

    if (stops.length === 0) {
      if (startOffset > 0) {
        stops.push({ offset: 0, color: segmentColor });
      }
      stops.push({ offset: startOffset, color: segmentColor });
    } else if (previousTone && previousTone !== segmentTone) {
      stops.push({ offset: startOffset, color: getTrendStrokeColor(previousTone) });
      stops.push({ offset: startOffset, color: segmentColor });
    }

    stops.push({ offset: endOffset, color: segmentColor });
    previousTone = segmentTone;
  }

  if (!stops.length) {
    const neutral = getTrendStrokeColor("neutral");
    return [
      { offset: 0, color: neutral },
      { offset: 1, color: neutral }
    ];
  }

  if (stops[0].offset > 0) {
    stops.unshift({ offset: 0, color: stops[0].color });
  }

  const last = stops[stops.length - 1];
  if (last.offset < 1) {
    stops.push({ offset: 1, color: last.color });
  }

  return stops;
};

export const buildTrendGradientStopsByKey = <T extends Record<string, unknown>>(
  data: T[],
  key: keyof T & string,
  options?: TrendOptions
) => buildTrendGradientStops(data, (point) => point[key], options);

export const getUtilizationTone = (value: number, limit: number, thresholds?: UtilizationThresholds): TrendTone => {
  if (!Number.isFinite(limit) || limit <= 0) return "neutral";

  const warningAt = thresholds?.warningAt ?? 0.8;
  const criticalAt = thresholds?.criticalAt ?? 1;
  const ratio = value / limit;

  if (ratio >= criticalAt) return "negative";
  if (ratio >= warningAt) return "neutral";
  return "positive";
};
