
"use client";

import { useRouter } from "next/navigation";

import {
  CreditCard,
  Landmark,
  Wallet,
  Eye,
  Pencil,
} from "lucide-react";

import type { BankCard, CardType } from "@/types/account";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

interface CardListProps {
  cards: BankCard[];
  bankMap: Map<string, string>;
  debtMap: Map<string, number>;
  availableCreditMap: Map<string, number>;
  onEdit: (card: BankCard) => void;
  onCreate?: () => void;
  hasRegisteredCards: boolean;
}

// -----------------------------------------------------------------------------
// CONFIGURACIÓN
// -----------------------------------------------------------------------------

const CARD_TYPE_CONFIG: Record<
  CardType,
  {
    label: string;
    icon: typeof CreditCard;
    iconStyle: string;
    badgeStyle: string;
  }
> = {
  debit: {
    label: "Débito",
    icon: Wallet,
    iconStyle: "bg-brand-mint/40 text-success",
    badgeStyle: "bg-brand-mint/30 text-success",
  },
  credit: {
    label: "Crédito",
    icon: CreditCard,
    iconStyle: "bg-brand-lavender/40 text-foreground",
    badgeStyle: "bg-brand-lavender/30 text-foreground",
  },
};

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBalance(balance: number): string {
  return currencyFormatter.format(balance);
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------

export default function CardList({
  cards,
  bankMap,
  debtMap,
  availableCreditMap,
  onEdit,
  onCreate,
  hasRegisteredCards,
}: CardListProps) {
  const router = useRouter();

  function handleViewCard(card: BankCard) {
    router.push(`/cards/${card.id}`);
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-card px-5 py-12 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-lavender/30 text-foreground">
          <CreditCard
            className="h-6 w-6"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <p className="mt-4 text-sm font-semibold text-foreground">
          {hasRegisteredCards
            ? "No se encontraron tarjetas"
            : "Todavía no tienes tarjetas"}
        </p>

        <p className="mt-1 text-sm text-muted">
          {hasRegisteredCards
            ? "Prueba modificando los filtros de búsqueda."
            : "Registra tu primera tarjeta para comenzar a organizar tus finanzas."}
        </p>

        {!hasRegisteredCards && onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800"
          >
            Crear primera tarjeta
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-card shadow-sm">
      {/* Encabezados */}
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-hairline px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted lg:grid">
        <span>Tarjeta</span>
        <span>Institución</span>
        <span>Tipo</span>
        <span className="text-right">Límite</span>
        <span className="text-right">Deuda</span>
        <span className="w-20 text-right">Acciones</span>
      </div>

      {/* Tarjetas */}
      <div className="divide-y divide-hairline">
        {cards.map((card) => {
          const config = CARD_TYPE_CONFIG[card.type];
          const Icon = config.icon;

          const bankName =
            bankMap.get(card.bankId) ?? "Banco no disponible";

          const debt = debtMap.get(card.id) ?? 0;

          const availableCredit =
            availableCreditMap.get(card.id) ?? 0;

          return (
            <article
              key={card.id}
              className="grid grid-cols-1 items-center gap-3 px-4 py-4 transition-colors hover:bg-background/50 sm:px-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-4"
            >
              {/* Tarjeta */}
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.iconStyle}`}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => handleViewCard(card)}
                    className="block max-w-full truncate text-left text-sm font-semibold text-foreground transition hover:text-primary hover:underline"
                    aria-label={`Ver detalles de la tarjeta ${card.name}`}
                  >
                    {card.name}
                  </button>

                  <p className="mt-1 truncate text-xs text-muted lg:hidden">
                    {bankName}
                  </p>
                </div>
              </div>

              {/* Institución */}
              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm text-body">
                  {bankName}
                </p>
              </div>

              {/* Tipo */}
              <div className="hidden lg:block">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${config.badgeStyle}`}
                >
                  {config.label}
                </span>
              </div>

              {/* Límite */}
              <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                <span className="text-xs text-muted lg:hidden">
                  {config.label}
                </span>

                <p className="shrink-0 text-sm tabular-nums text-body">
                  {card.type === "credit" && card.creditLimit !== null
                    ? formatBalance(card.creditLimit)
                    : "—"}
                </p>
              </div>

              {/* Deuda */}
              <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                <span className="text-xs text-muted lg:hidden">
                  Deuda pendiente
                </span>

                <div className="shrink-0">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {card.type === "credit"
                      ? formatBalance(debt)
                      : "—"}
                  </p>

                  {card.type === "credit" && (
                    <p className="mt-1 text-xs tabular-nums text-muted">
                      Disponible: {formatBalance(availableCredit)}
                    </p>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => handleViewCard(card)}
                  aria-label={`Consultar tarjeta ${card.name}`}
                  title="Ver detalles"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
                >
                  <Eye
                    className="h-4 w-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(card)}
                  aria-label={`Editar tarjeta ${card.name}`}
                  title="Editar tarjeta"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
                >
                  <Pencil
                    className="h-4 w-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
