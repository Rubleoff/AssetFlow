import { useMemo } from "react";

import type { GoalForecast } from "../lib/types";
import { money } from "../lib/format";

type GoalCelebrationOverlayProps = {
  open: boolean;
  goal: GoalForecast | null;
  currency: string;
  onClose: () => void;
};

const COLORS = ["#0057ff", "#3f7cff", "#91b4ff", "#00a3ff", "#7bd3ff", "#d8e6ff"];

export function GoalCelebrationOverlay({
  open,
  goal,
  currency,
  onClose
}: GoalCelebrationOverlayProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: index,
        left: 6 + ((index * 37) % 88),
        delay: (index * 55) % 360,
        duration: 1500 + (index % 5) * 170,
        rotate: (index * 31) % 360,
        color: COLORS[index % COLORS.length]
      })),
    []
  );

  if (!open || !goal) return null;

  return (
    <div className="celebration-backdrop" onClick={onClose}>
      <section
        className="celebration-panel"
        onClick={(event) => event.stopPropagation()}
        aria-live="polite"
        aria-label="Цель достигнута"
      >
        <div className="celebration-fireworks" aria-hidden="true">
          {pieces.map((piece) => (
            <span
              key={piece.id}
              className="celebration-piece"
              style={{
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}ms`,
                animationDuration: `${piece.duration}ms`,
                transform: `rotate(${piece.rotate}deg)`,
                background: piece.color
              }}
            />
          ))}
        </div>

        <div className="celebration-badge">Цель закрыта</div>
        <h3>Поздравляем!</h3>
        <p>
          <strong>{goal.title}</strong> достигнута. На цели уже{" "}
          <strong>{money(goal.saved_amount, currency)}</strong>.
        </p>
        <div className="celebration-summary">
          <div>
            <span>Цель</span>
            <strong>{money(goal.target_amount, currency)}</strong>
          </div>
          <div>
            <span>Накоплено</span>
            <strong>{money(goal.saved_amount, currency)}</strong>
          </div>
        </div>
        <button type="button" className="primary-button" onClick={onClose}>
          Класс, продолжаем
        </button>
      </section>
    </div>
  );
}
