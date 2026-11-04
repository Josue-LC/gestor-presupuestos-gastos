
"use client";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BriefcaseBusiness,
  CarFront,
  ChartNoAxesCombined,
  Eye,
  Gamepad2,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Pencil,
  Receipt,
  Shapes,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Undo2,
  Wallet,
  X,
  Trash2,
} from "lucide-react";

export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "active" | "cancelled";

export interface Transaction {
  id: string;
  description: string;
  category: string;
  account: string;
  date: string;
  registeredAt?: string;
  amount: number;
  type: TransactionType;
  status?: TransactionStatus;
  cancellationReason?: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onCancel: (transaction: Transaction) => void;
  onView: (transaction: Transaction) => void;
  onRestore: (transaction: Transaction) => void;
  onRemove: (transaction: Transaction) => void;
  highlightedTransactionId?: string | null;
}

const typeLabels: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
};

const categoryIcons = {
  food: ShoppingBasket,
  transport: CarFront,
  housing: House,
  services: Receipt,
  health: HeartPulse,
  entertainment: Gamepad2,
  shopping: ShoppingBag,
  education: GraduationCap,
  "other-expense": Shapes,
  salary: Wallet,
  freelance: BriefcaseBusiness,
  sales: Store,
  investments: ChartNoAxesCombined,
  refunds: Undo2,
  "other-income": HandCoins,
};

const categoryStyles: Record<string, string> = {
  income: "bg-brand-mint/30 text-success",
  expense: "bg-brand-peach/30 text-error",
};

const categoryLabels: Record<string, string> = {
  food: "Alimentación",
  transport: "Transporte",
  housing: "Vivienda",
  services: "Servicios",
  health: "Salud",
  entertainment: "Entretenimiento",
  shopping: "Compras",
  education: "Educación",
  "other-expense": "Otros",
  salary: "Nómina",
  freelance: "Trabajo independiente",
  sales: "Ventas",
  investments: "Inversiones",
  refunds: "Reembolsos",
  "other-income": "Otros",
};

function getCategoryId(transaction: Transaction): string | null {
  if (transaction.type === "transfer") {
    return null;
  }

  const category = transaction.category.trim().toLowerCase();

  const categoryByName: Record<string, string> = {
    alimentación: "food",
    supermercado: "food",
    comida: "food",
    transporte: "transport",
    gasolina: "transport",
    vivienda: "housing",
    servicios: "services",
    internet: "services",
    salud: "health",
    entretenimiento: "entertainment",
    compras: "shopping",
    educación: "education",
    nómina: "salary",
    "trabajo independiente": "freelance",
    ventas: "sales",
    inversiones: "investments",
    reembolsos: "refunds",
  };

  if (categoryByName[category]) {
    return categoryByName[category];
  }

  if (category === "otros") {
    return transaction.type === "income" ? "other-income" : "other-expense";
  }

  return transaction.type === "income" ? "other-income" : "other-expense";
}

function formatAmount(transaction: Transaction) {
  const amount = Math.abs(transaction.amount).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  if (transaction.type === "income") return `+${amount}`;
  if (transaction.type === "expense") return `-${amount}`;

  return amount;
}

function TransactionIcon({ type }: { type: TransactionType }) {
  const iconClassName = "h-5 w-5";

  if (type === "income") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-mint/40 text-success">
        <ArrowUp
          className={iconClassName}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (type === "expense") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-peach/40 text-error">
        <ArrowDown
          className={iconClassName}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-lavender/40 text-foreground">
      <ArrowLeftRight
        className={iconClassName}
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </div>
  );
}

function CategoryIcon({ transaction }: { transaction: Transaction }) {
  const categoryId = getCategoryId(transaction);

  if (!categoryId) {
    return null;
  }

  const Icon = categoryIcons[categoryId as keyof typeof categoryIcons];
  const style = categoryStyles[transaction.type];

  return (
    <span
      title={categoryLabels[categoryId] ?? transaction.category}
      aria-label={`Categoría: ${transaction.category}`}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

export default function TransactionList({
  transactions,
  onEdit,
  onCancel,
  onView,
  onRestore,
  onRemove,
  highlightedTransactionId,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-card px-5 py-12 text-center">
        <p className="text-sm font-semibold text-foreground">
          No se encontraron movimientos
        </p>
        <p className="mt-1 text-sm text-muted">
          Prueba modificando los filtros de búsqueda.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-card shadow-sm">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-4 border-b border-hairline px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
        <span>Movimiento</span>
        <span>Cuenta</span>
        <span>Fecha</span>
        <span className="text-right">Importe</span>
        <span className="w-28 text-right">Acciones</span>
      </div>

      <div className="divide-y divide-hairline">
        {transactions.map((transaction) => {
          const isCancelled = transaction.status === "cancelled";
          const isHighlighted = transaction.id === highlightedTransactionId;

          const highlightStyle =
            isHighlighted && !isCancelled
              ? transaction.type === "income"
                ? "animate-highlight-income"
                : transaction.type === "expense"
                  ? "animate-highlight-expense"
                  : "animate-highlight-transfer"
              : "";

          return (
            <div
              key={transaction.id}
              className={`grid grid-cols-1 items-center gap-3 px-4 py-4 transition-all duration-300 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-4 ${
                isCancelled ? "opacity-60" : "hover:bg-background/50"
              } ${highlightStyle}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <TransactionIcon type={transaction.type} />

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {transaction.description}
                  </p>

                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                    <CategoryIcon transaction={transaction} />

                    <p className="truncate text-xs text-muted">
                      {transaction.category}
                    </p>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted md:hidden">
                      {typeLabels[transaction.type]}
                    </span>

                    {isCancelled && (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        Cancelado
                      </span>
                    )}
                  </div>

                  {isCancelled && transaction.cancellationReason && (
                    <p className="mt-1 text-xs text-muted">
                      Motivo: {transaction.cancellationReason}
                    </p>
                  )}
                </div>
              </div>

              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm text-body">
                  {transaction.account}
                </p>
              </div>

              <div className="hidden md:block">
                <p className="text-sm text-muted">{transaction.date}</p>
              </div>

              <div className="flex items-center justify-between gap-3 md:block md:text-right">
                <div className="min-w-0 md:hidden">
                  <p className="truncate text-xs text-muted">
                    {transaction.account}
                  </p>
                  <p className="text-xs text-muted">{transaction.date}</p>
                </div>

                <p
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    isCancelled
                      ? "text-muted line-through"
                      : transaction.type === "income"
                        ? "text-success"
                        : transaction.type === "expense"
                          ? "text-error"
                          : "text-foreground"
                  }`}
                >
                  {formatAmount(transaction)}
                </p>
              </div>

              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onView(transaction)}
                  aria-label={`Consultar ${transaction.description}`}
                  title="Ver detalle"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
                >
                  <Eye
                    className="h-4 w-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>

                {!isCancelled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(transaction)}
                      aria-label={`Editar ${transaction.description}`}
                      title="Editar movimiento"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
                    >
                      <Pencil
                        className="h-4 w-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onCancel(transaction)}
                      aria-label={`Cancelar ${transaction.description}`}
                      title="Cancelar movimiento"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X
                        className="h-4 w-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onRestore(transaction)}
                      aria-label={`Revertir cancelación de ${transaction.description}`}
                      title="Revertir cancelación"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Undo2
                        className="h-4 w-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemove(transaction)}
                      aria-label={`Quitar ${transaction.description}`}
                      title="Quitar movimiento cancelado"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2
                        className="h-4 w-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
