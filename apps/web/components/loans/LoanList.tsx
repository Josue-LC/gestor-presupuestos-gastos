
"use client";

import Link from "next/link";

import type { Loan, LoanStatus, LoanType } from "@/types/loan.types";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

export interface LoanListItem {
  loan: Loan;
  outstandingBalance: number;
  nextInstallment: {
    dueDate: string;
    amount: number;
    status: string;
  } | null;
}

type StatusFilter = LoanStatus | "all";

interface LoanListProps {
  loans: LoanListItem[];
  bankMap: ReadonlyMap<string, string>;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  isLoading: boolean;
  hasRegisteredLoans: boolean;
  onCreate: () => void;
  onEdit: (loan: Loan) => void;
}

// -----------------------------------------------------------------------------
// CONSTANTES
// -----------------------------------------------------------------------------

const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  personal: "Personal",
  auto: "Automotriz",
  mortgage: "Hipotecario",
  other: "Otro",
};

const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  active: "Activo",
  paid: "Liquidado",
  cancelled: "Cancelado",
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: string): string {
  if (!value) return "Sin fecha";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusClasses(status: LoanStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";

    case "paid":
      return "bg-blue-50 text-blue-700";

    case "cancelled":
      return "bg-neutral-100 text-neutral-500";

    default:
      return "bg-neutral-100 text-neutral-600";
  }
}

function getInstallmentStatusLabel(status: string): string {
  switch (status) {
    case "overdue":
      return "Vencida";

    case "partial":
      return "Pago parcial";

    case "pending":
      return "Pendiente";

    case "paid":
      return "Pagada";

    default:
      return "Sin información";
  }
}

// -----------------------------------------------------------------------------
// ICONOS
// -----------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      aria-hidden="true"
    >
      <circle
        cx="10.8"
        cy="10.8"
        r="6.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m16 16 4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoanIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-6"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3 10h18M7 15h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="m14 5 5 5M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------

export default function LoanList({
  loans,
  bankMap,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isLoading,
  hasRegisteredLoans,
  onCreate,
  onEdit,
}: LoanListProps) {
  return (
    <section className="space-y-5">
      {/* ENCABEZADO */}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Tus préstamos
          </h2>

          <p className="mt-1 text-sm text-muted">
            Consulta y administra tus préstamos registrados.
          </p>
        </div>

        <span className="text-sm text-muted">
          {loans.length} {loans.length === 1 ? "préstamo" : "préstamos"}
        </span>
      </div>

      {/* BÚSQUEDA Y FILTROS */}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por préstamo, institución o contrato..."
            aria-label="Buscar préstamos"
            className="w-full rounded-xl border border-hairline bg-surface-card py-3 pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-foreground"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as StatusFilter)
          }
          aria-label="Filtrar por estado"
          className="rounded-xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none focus:border-foreground sm:w-52"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="paid">Liquidados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>

      {/* CONTENIDO */}

      {isLoading ? (
        <div className="rounded-2xl border border-hairline bg-surface-card p-12 text-center shadow-sm">
          <p className="text-sm text-muted">Cargando préstamos...</p>
        </div>
      ) : loans.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface-card px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface text-muted">
            <LoanIcon />
          </div>

          <h3 className="mt-5 text-lg font-semibold text-foreground">
            {hasRegisteredLoans
              ? "No se encontraron préstamos"
              : "Todavía no tienes préstamos"}
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            {hasRegisteredLoans
              ? "Intenta cambiar los términos de búsqueda o el filtro seleccionado."
              : "Registra tu primer préstamo para llevar el control de tus deudas, parcialidades y pagos."}
          </p>

          {!hasRegisteredLoans && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800"
            >
              <PlusIcon />
              Registrar préstamo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {loans.map(({ loan, outstandingBalance, nextInstallment }) => {
            const institutionName =
              bankMap.get(loan.institutionId) ??
              "Institución no disponible";

            return (
              <article
                key={loan.id}
                className="group rounded-2xl border border-hairline bg-surface-card p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md sm:p-6"
              >
                {/* ENCABEZADO DE TARJETA */}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface text-foreground">
                      <LoanIcon />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-foreground">
                        {loan.name}
                      </h3>

                      <p className="mt-1 truncate text-sm text-muted">
                        {institutionName}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(loan.status)}`}
                  >
                    {LOAN_STATUS_LABELS[loan.status]}
                  </span>
                </div>

                {/* INFORMACIÓN PRINCIPAL */}

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted">Saldo pendiente</p>

                    <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
                      {formatCurrency(outstandingBalance)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted">Monto contratado</p>

                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {formatCurrency(loan.contractedAmount)}
                    </p>
                  </div>
                </div>

                <div className="my-5 border-t border-hairline" />

                {/* DATOS DEL PRÉSTAMO */}

                <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted">Tipo de préstamo</p>

                    <p className="mt-1 text-sm font-medium text-foreground">
                      {LOAN_TYPE_LABELS[loan.type]}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted">Tasa anual</p>

                    <p className="mt-1 text-sm font-medium text-foreground">
                      {loan.annualInterestRate.toFixed(2)}%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted">Plazo</p>

                    <p className="mt-1 text-sm font-medium text-foreground">
                      {loan.termInMonths} meses
                    </p>
                  </div>
                </div>

                {/* PRÓXIMA PARCIALIDAD */}

                {loan.status === "active" && (
                  <div className="mt-5 rounded-xl bg-surface p-4">
                    {nextInstallment ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted">
                            Próxima parcialidad
                          </p>

                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatDate(nextInstallment.dueDate)}
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            {getInstallmentStatusLabel(nextInstallment.status)}
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-xs text-muted">
                            Importe programado
                          </p>

                          <p className="mt-1 text-base font-bold text-foreground">
                            {formatCurrency(nextInstallment.amount)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">
                        No hay parcialidades pendientes.
                      </p>
                    )}
                  </div>
                )}

                {/* PIE DE TARJETA */}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    {loan.contractNumber && (
                      <p className="truncate text-xs text-muted">
                        Contrato: {loan.contractNumber}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {loan.status === "active" && (
                      <button
                        type="button"
                        onClick={() => onEdit(loan)}
                        className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-muted transition hover:text-foreground"
                        aria-label={`Editar préstamo ${loan.name}`}
                      >
                        <EditIcon />
                        Editar
                      </button>
                    )}

                    <Link
                      href={`/loans/${loan.id}`}
                      className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground transition hover:gap-3"
                    >
                      Ver detalle
                      <ArrowRightIcon />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
