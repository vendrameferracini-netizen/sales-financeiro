import { DailyEvolution, PeriodSummary } from "../types";
import { formatDate } from "../utils/dates";
import { currency } from "../utils/format";

export const EvolutionChart = ({ data }: { data: DailyEvolution[] }) => {
  const max = Math.max(...data.map((item) => item.revenue), 1);
  return (
    <section className="chart-panel">
      <h2>Evolucao diaria</h2>
      <div className="bar-chart">
        {data.map((item) => (
          <div className="bar-item" key={item.date} title={`${formatDate(item.date)} - ${currency(item.revenue)}`}>
            <span style={{ height: `${Math.max(3, (item.revenue / max) * 100)}%` }} />
            <small>{item.date.slice(-2)}</small>
          </div>
        ))}
      </div>
    </section>
  );
};

export const ChannelChart = ({ summary }: { summary: PeriodSummary }) => {
  const channels = [
    { label: "ML", value: summary.totals.ml },
    { label: "Shopee", value: summary.totals.shopee },
    { label: "Avulso", value: summary.totals.avulso }
  ];
  const max = Math.max(...channels.map((item) => item.value), 1);
  return (
    <section className="chart-panel">
      <h2>Distribuicao por canal</h2>
      <div className="channel-chart">
        {channels.map((item) => (
          <div className="channel-row" key={item.label}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.value} pacotes</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
