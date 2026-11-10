"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "Inicio",
    href: "/dashboard",
    icon: "grid",
  },
  {
    label: "Transacciones",
    href: "/transactions",
    icon: "receipt",
  },
  {
    label: "Cuentas",
    href: "/accounts",
    icon: "wallet",
  },
  {
    label: "Tarjetas",
    href: "/cards",
    icon: "card",
  },
  {
    label: "Préstamos",
    href: "/loans",
    icon: "loan",
  },
  {
    label: "Presupuestos",
    href: "/budgets",
    icon: "target",
  },
  {
    label: "Metas",
    href: "/goals",
    icon: "savings",
  },
  {
    label: "Informes",
    href: "/reports",
    icon: "chart",
  },
  {
    label: "Configuración",
    href: "/settings",
    icon: "settings",
  },
];

function SidebarIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    receipt: (
      <>
        <path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="15" rx="3" />
        <path d="M3 10h18M16 15h2" />
        <path d="M6 6V4h12" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    savings: (
      <>
        <path d="M5 9a7 7 0 0 1 12-2l2 2h2v5h-3l-2 3H9l-2-3H5a3 3 0 0 1 0-6z" />
        <path d="M10 11h.01M15 11h.01M10 17v2M17 17v2" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <rect x="6" y="12" width="3" height="5" rx="1" />
        <rect x="12" y="8" width="3" height="9" rx="1" />
        <rect x="18" y="4" width="3" height="13" rx="1" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.5-2.6L7.2 15a8 8 0 0 1 0-2l-1.4-1.1 1.5-2.6 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h3l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.5 2.6-1.4 1.1a8 8 0 0 1 0 2z" />
      </>
    ),
    loan: (
      <>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14h-2v-2h2zm0-4h-2V7h2z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    walletLogo: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 9h18M16 14h2" />
        <path d="M7 5V3h10" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      {paths[name] ?? paths.grid}
    </svg>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col justify-between overflow-y-auto border-r border-hairline bg-surface-container-low p-4">
      <div className="flex flex-col gap-6">
        {/* Logo */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 px-1"
          aria-label="Gestor de Presupuestos, ir al inicio"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <SidebarIcon name="walletLogo" />
          </span>

          <span className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight text-foreground">
              Gestor
            </span>
            <span className="text-xs text-muted">Finanzas personales</span>
          </span>
        </Link>

        {/* Nueva transacción */}
        <Link
          href="/transactions"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-neutral-800"
        >
          <SidebarIcon name="plus" />
          <span>Nueva transacción</span>
        </Link>

        {/* Navegación */}
        <nav aria-label="Navegación principal" className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-full px-4 py-3 transition-colors ${
                  isActive
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-body hover:bg-surface-container-high hover:text-foreground"
                }`}
              >
                <SidebarIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Perfil */}
      <div className="mt-8 flex items-center justify-between gap-2 rounded-xl bg-surface-card p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <SidebarIcon name="person" />
          </span>

          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              Usuario de prueba
            </p>
            <p className="truncate text-xs text-muted">Cuenta personal</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Más opciones de perfil"
          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-container-high hover:text-foreground"
        >
          <SidebarIcon name="more" />
        </button>
      </div>
    </aside>
  );
}
