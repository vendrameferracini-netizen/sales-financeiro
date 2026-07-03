import { ReactNode } from "react";

export const SummaryCards = ({ cards }: { cards: { label: string; value: string; tone?: "red" | "dark"; icon?: ReactNode }[] }) => (
  <section className="summary-grid">
    {cards.map((card) => (
      <article className={`metric-card ${card.tone || ""}`} key={card.label}>
        <div>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
        {card.icon && <div className="metric-icon">{card.icon}</div>}
      </article>
    ))}
  </section>
);
