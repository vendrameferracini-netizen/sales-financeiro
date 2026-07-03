import { ReactNode } from "react";

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) => (
  <div className="page-header">
    <div>
      <p className="eyebrow">FINANCEIRO SALLES</p>
      <h1>{title}</h1>
      <span>{subtitle}</span>
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);
