import { BarChart3, CalendarDays, Clock3, DollarSign, FileText, LogOut, Menu, TrendingUp, Truck, Wallet, X } from "lucide-react";
import { ReactNode, useState } from "react";

export type PageKey = "daily" | "weekly" | "fortnightly" | "monthly" | "costs" | "profit" | "carriers";

const navItems = [
  { key: "daily", label: "Lancamento Diario", icon: CalendarDays },
  { key: "weekly", label: "Semanal", icon: Clock3 },
  { key: "fortnightly", label: "Quinzenal", icon: FileText },
  { key: "monthly", label: "Mensal", icon: BarChart3 },
  { key: "costs", label: "Custos Fixos", icon: Wallet },
  { key: "profit", label: "Lucro Real", icon: TrendingUp },
  { key: "carriers", label: "Transportadoras", icon: Truck }
] as const;

export const Layout = ({
  activePage,
  setActivePage,
  onLogout,
  children
}: {
  activePage: PageKey;
  setActivePage: (page: PageKey) => void;
  onLogout: () => void;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="nav-list">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className={`nav-item ${activePage === item.key ? "active" : ""}`}
            key={item.key}
            onClick={() => {
              setActivePage(item.key);
              setOpen(false);
            }}
          >
            <Icon size={19} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const logoutButton = (
    <button
      className="nav-item logout-item"
      onClick={() => {
        setOpen(false);
        onLogout();
      }}
    >
      <LogOut size={19} />
      <span>Sair</span>
    </button>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <DollarSign size={24} />
          </div>
          <div>
            <strong>FINANCEIRO</strong>
            <span>SALLES</span>
          </div>
        </div>
        {nav}
        <div className="sidebar-footer">{logoutButton}</div>
      </aside>

      <header className="mobile-topbar">
        <button className="icon-button" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={24} />
        </button>
        <strong>FINANCEIRO SALLES</strong>
      </header>

      {open && (
        <div className="mobile-menu">
          <div className="mobile-menu-panel">
            <button className="icon-button close" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X size={24} />
            </button>
            <div className="brand">
              <div className="brand-mark">
                <DollarSign size={24} />
              </div>
              <div>
                <strong>FINANCEIRO</strong>
                <span>SALLES</span>
              </div>
            </div>
            {nav}
            <div className="sidebar-footer">{logoutButton}</div>
          </div>
        </div>
      )}

      <main className="content">{children}</main>
    </div>
  );
};
