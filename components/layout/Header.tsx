
"use client";

import { useState } from "react";

interface HeaderProps {
  onMenuClick?: () => void;
}

function HeaderIcon({
  name,
}: {
  name: "search" | "calendar" | "wallet" | "bell" | "menu";
}) {
  const paths = {
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 9h18M16 14h2" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
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
      {paths[name]}
    </svg>
  );
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [period, setPeriod] = useState("Este mes");
  const [account, setAccount] = useState("Todas las cuentas");
  const [search, setSearch] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="flex flex-col gap-3">

        {/* Primera fila: menú, búsqueda y notificaciones */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="Abrir menú de navegación"
            onClick={onMenuClick}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-card text-foreground shadow-sm transition-colors hover:bg-surface-container-high md:hidden"
          >
            <HeaderIcon name="menu" />
          </button>

          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <HeaderIcon name="search" />
            </span>

            <input
              type="search"
              aria-label="Buscar movimientos, comercios o cuentas"
              placeholder="Buscar movimientos..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-transparent bg-surface-soft py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted focus:border-outline focus:outline-none"
            />
          </div>

          <button
            type="button"
            aria-label="Notificaciones"
            className="relative flex size-10 shrink-0 items-center justify-center rounded-xl text-body transition-colors hover:bg-surface-card"
          >
            <HeaderIcon name="bell" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-pink" />
          </button>
        </div>

        {/* Segunda fila: filtros */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">

          {/* Periodo */}
          <label className="flex min-w-0 items-center gap-2 rounded-xl bg-surface-card px-3 py-2.5">
            <span className="shrink-0 text-muted">
              <HeaderIcon name="calendar" />
            </span>

            <select
              aria-label="Periodo"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="w-full min-w-0 bg-transparent text-xs font-medium text-foreground outline-none sm:text-sm"
            >
              <option>Este mes</option>
              <option>Mes anterior</option>
              <option>Últimos 3 meses</option>
              <option>Este año</option>
            </select>
          </label>

          {/* Cuenta */}
          <label className="flex min-w-0 items-center gap-2 rounded-xl bg-surface-card px-3 py-2.5">
            <span className="shrink-0 text-muted">
              <HeaderIcon name="wallet" />
            </span>

            <select
              aria-label="Cuenta"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              className="w-full min-w-0 bg-transparent text-xs font-medium text-foreground outline-none sm:text-sm"
            >
              <option>Todas las cuentas</option>
              <option>Cuenta principal</option>
              <option>Efectivo</option>
              <option>Ahorro</option>
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
