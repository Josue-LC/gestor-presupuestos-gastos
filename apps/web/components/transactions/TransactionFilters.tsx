
"use client";

import type { TransactionCategory } from "@/lib/transaction-categories";

export interface TransactionFilterValues {
  search: string;
  type: string;
  account: string;
  category: string;
  status: string;
}

interface TransactionFiltersProps {
  filters: TransactionFilterValues;
  onChange: (filters: TransactionFilterValues) => void;
  accounts: string[];
  categories: TransactionCategory[];
}

export default function TransactionFilters({
  filters,
  onChange,
  accounts,
  categories,
}: TransactionFiltersProps) {
  function updateFilter(key: keyof TransactionFilterValues, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function clearFilters() {
    onChange({
      search: "",
      type: "all",
      account: "all",
      category: "all",
      status: "all",
    });
  }

  const hasActiveFilters =
    filters.search !== "" ||
    filters.type !== "all" ||
    filters.account !== "all" ||
    filters.category !== "all" ||
    filters.status !== "all";

  const selectClassName =
    "w-full rounded-xl border border-hairline bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-foreground";

  return (
    <section className="rounded-2xl bg-surface-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="m16 16 4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>

          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Buscar por descripción, categoría o cuenta..."
            aria-label="Buscar transacciones"
            className="w-full rounded-xl border border-hairline bg-background py-3 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            value={filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
            aria-label="Filtrar por tipo"
            className={selectClassName}
          >
            <option value="all">Todos los tipos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
            <option value="transfer">Transferencias</option>
          </select>

          <select
            value={filters.account}
            onChange={(event) => updateFilter("account", event.target.value)}
            aria-label="Filtrar por cuenta"
            className={selectClassName}
          >
            <option value="all">Todas las cuentas</option>

            {accounts.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>

<select
  value={filters.category}
  onChange={(event) => updateFilter("category", event.target.value)}
  aria-label="Filtrar por categoría"
  className={selectClassName}
>
  <option key="all-categories" value="all">
    Todas las categorías
  </option>

  {categories.map((category) => (
    <option key={category.id} value={category.name}>
      {category.name} (
      {category.type === "income" ? "Ingreso" : "Gasto"})
    </option>
  ))}
</select>

          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            aria-label="Filtrar por estado"
            className={selectClassName}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-muted transition hover:text-foreground"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
