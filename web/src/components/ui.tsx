import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";

export function PageHeader(props: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {props.eyebrow ? <span className="page-eyebrow">{props.eyebrow}</span> : null}
        <h1>{props.title}</h1>
        {props.description ? <p>{props.description}</p> : null}
      </div>
      {props.action ? <div>{props.action}</div> : null}
    </header>
  );
}

export function Surface({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <section className={clsx("surface", className)}>{children}</section>;
}

export function StatCard(props: { label: string; value: string; hint?: string; tone?: "default" | "accent" | "dark" }) {
  return (
    <Surface className={clsx("stat-card", props.tone && `tone-${props.tone}`)}>
      <span className="kicker">{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </Surface>
  );
}

export function Mono({ children }: PropsWithChildren) {
  return <span className="mono">{children}</span>;
}

export function Pill(props: PropsWithChildren<{ tone?: "blue" | "neutral" | "success" | "warning" }>) {
  return <span className={clsx("pill", props.tone ? `pill-${props.tone}` : "pill-neutral")}>{props.children}</span>;
}

export function DataTable(props: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={`${index}-${row.length}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState(props: { title: string; body: string }) {
  return (
    <Surface className="empty-state">
      <h3>{props.title}</h3>
      <p>{props.body}</p>
    </Surface>
  );
}

export function ChoiceCards<T extends string>(props: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; hint?: string }>;
  compact?: boolean;
}) {
  return (
    <div className={clsx("choice-grid", props.compact && "choice-grid-compact")}>
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx("choice-card", props.value === option.value && "active")}
          onClick={() => props.onChange(option.value)}
        >
          <strong>{option.label}</strong>
          {option.hint ? <span>{option.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function QuickPills(props: {
  items: Array<{ value: string; label?: string }>;
  onPick: (value: string) => void;
}) {
  return (
    <div className="quick-pills">
      {props.items.map((item) => (
        <button key={item.value} type="button" className="quick-pill" onClick={() => props.onPick(item.value)}>
          {item.label ?? item.value}
        </button>
      ))}
    </div>
  );
}

export function SelectMenu(props: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; hint?: string }>;
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = props.options.find((option) => option.value === props.value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return props.options;
    return props.options.filter((option) =>
      `${option.label} ${option.value} ${option.hint ?? ""}`.toLowerCase().includes(normalized)
    );
  }, [props.options, query]);

  return (
    <div className="select-menu">
      <button type="button" className={clsx("select-trigger", open && "active")} onClick={() => setOpen((value) => !value)}>
        <span>
          <strong>{active?.label ?? props.placeholder ?? "Выберите"}</strong>
          <small>{active?.hint ?? active?.value ?? ""}</small>
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="select-panel">
          {props.searchable ? (
            <input
              className="select-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск"
            />
          ) : null}
          <div className="select-options">
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                className={clsx("select-option", props.value === option.value && "active")}
                onClick={() => {
                  props.onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.hint ?? option.value}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
