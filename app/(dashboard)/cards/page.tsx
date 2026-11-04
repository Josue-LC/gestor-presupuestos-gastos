
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import CardSummary from "@/components/cards/CardSummary";
import CardList from "@/components/cards/CardList";
import CardForm, {
  type CardFormData,
} from "@/components/cards/CardForm";

import type {
  Account,
  Bank,
  BankCard,
  CardType,
} from "@/types/account";

import { useAlert } from "@/context/AlertContext";

import {
  getActiveCards,
  createCard,
  updateCard,
} from "@/services/card.service";

import { getActiveAccounts } from "@/services/account.service";

import { getBanks } from "@/services/bank.service";

import {
  getAllCardSummaries,
  getTotalCreditCardDebt,
  getUpcomingInstallments,
} from "@/services/account-summary.service";

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

const CARD_TYPE_LABELS: Record<CardType, string> = {
  debit: "Débito",
  credit: "Crédito",
};

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------

export default function CardsPage() {
  const { toast } = useAlert();

  const [cards, setCards] = useState<BankCard[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [cardSummaries, setCardSummaries] = useState<
    ReturnType<typeof getAllCardSummaries>
  >([]);

  const [totalDebt, setTotalDebt] = useState(0);

  const [upcomingInstallments, setUpcomingInstallments] = useState<
    ReturnType<typeof getUpcomingInstallments>
  >([]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CardType | "all">("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<BankCard | null>(null);

  // ---------------------------------------------------------------------------
  // CARGA DE INFORMACIÓN
  // ---------------------------------------------------------------------------

  const loadData = useCallback(() => {
    try {
      const activeCards = getActiveCards();
      const cardData = getAllCardSummaries();
      const bankData = getBanks();
      const accountData = getActiveAccounts();

      const debt = getTotalCreditCardDebt();

      // Recuperamos todos los vencimientos futuros, no solamente los 10
      // que devuelve el servicio por defecto.
      const installments = getUpcomingInstallments(
        undefined,
        Number.MAX_SAFE_INTEGER,
      );

      setCards(activeCards);
      setCardSummaries(cardData);
      setBanks(bankData);
      setAccounts(accountData);
      setTotalDebt(debt);
      setUpcomingInstallments(installments);
    } catch (error) {
      console.error("Error al cargar las tarjetas:", error);

      toast.error(
        "No fue posible cargar la información de las tarjetas.",
        "Error de carga",
      );
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // MAPAS Y RESÚMENES
  // ---------------------------------------------------------------------------

  const bankMap = useMemo(
    () => new Map(banks.map((bank) => [bank.id, bank.name])),
    [banks],
  );

  const debtMap = useMemo(() => {
    return new Map(
      cardSummaries.map((summary) => [
        summary.card.id,
        summary.card.type === "credit"
          ? summary.outstandingSinglePurchases +
            summary.outstandingInstallments
          : 0,
      ]),
    );
  }, [cardSummaries]);

  const availableCreditMap = useMemo(() => {
    return new Map(
      cardSummaries.map((summary) => {
        const { card } = summary;

        if (card.type !== "credit" || card.creditLimit === null) {
          return [card.id, 0];
        }

        const debt =
          summary.outstandingSinglePurchases +
          summary.outstandingInstallments;

        return [
          card.id,
          Math.max(0, card.creditLimit - debt),
        ];
      }),
    );
  }, [cardSummaries]);

  const totalAvailableCredit = useMemo(() => {
    return Array.from(availableCreditMap.values()).reduce(
      (total, amount) => total + amount,
      0,
    );
  }, [availableCreditMap]);

  const upcomingInstallmentsAmount = useMemo(() => {
    return upcomingInstallments.reduce(
      (total, item) => total + item.remainingAmount,
      0,
    );
  }, [upcomingInstallments]);

  // ---------------------------------------------------------------------------
  // FILTROS
  // ---------------------------------------------------------------------------

  const filteredCards = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es-MX");

    return cards.filter((card) => {
      const bankName = bankMap.get(card.bankId) ?? "";

      const matchesSearch =
        !normalizedSearch ||
        card.name.toLocaleLowerCase("es-MX").includes(normalizedSearch) ||
        bankName.toLocaleLowerCase("es-MX").includes(normalizedSearch);

      const matchesType =
        typeFilter === "all" || card.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [cards, search, typeFilter, bankMap]);

  // ---------------------------------------------------------------------------
  // FORMULARIO
  // ---------------------------------------------------------------------------

  function handleCreateCard() {
    setEditingCard(null);
    setIsFormOpen(true);
  }

  function handleEditCard(card: BankCard) {
    setEditingCard(card);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingCard(null);
  }

  function handleSubmitCard(data: CardFormData) {
    try {
      if (editingCard) {
        updateCard(editingCard.id, data);

        toast.success(
          "La tarjeta se actualizó correctamente.",
          "Tarjeta actualizada",
        );
      } else {
        createCard(data);

        toast.success(
          "La tarjeta se registró correctamente.",
          "Tarjeta creada",
        );
      }

      handleCloseForm();
      loadData();
    } catch (error) {
      console.error("Error al guardar la tarjeta:", error);

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* Encabezado */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Gestión financiera
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tarjetas
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Administra tus tarjetas de débito y crédito, consulta tus
            deudas y mantén el control de tus pagos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateCard}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800"
        >
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

          Nueva tarjeta
        </button>
      </section>

      {/* Resumen de tarjetas */}
      <CardSummary
        activeCards={cards.length}
        totalDebt={totalDebt}
        availableCredit={totalAvailableCredit}
        upcomingInstallmentsAmount={upcomingInstallmentsAmount}
      />

      {/* Listado de tarjetas */}
      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Tus tarjetas
            </h2>

            <p className="mt-1 text-sm text-muted">
              Consulta y administra tus tarjetas registradas.
            </p>
          </div>

          <span className="text-sm text-muted">
            {filteredCards.length}{" "}
            {filteredCards.length === 1 ? "tarjeta" : "tarjetas"}
          </span>
        </div>

        {/* Búsqueda y filtros */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
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

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por tarjeta o banco..."
              aria-label="Buscar tarjetas"
              className="w-full rounded-xl border border-hairline bg-surface-card py-3 pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-foreground"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as CardType | "all")
            }
            aria-label="Filtrar por tipo de tarjeta"
            className="rounded-xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none focus:border-foreground sm:w-56"
          >
            <option value="all">Todos los tipos</option>

            {Object.entries(CARD_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="rounded-2xl bg-surface-card p-12 text-center shadow-sm">
            <p className="text-sm text-muted">Cargando tarjetas...</p>
          </div>
        ) : (
          <CardList
            cards={filteredCards}
            bankMap={bankMap}
            debtMap={debtMap}
            availableCreditMap={availableCreditMap}
            onEdit={handleEditCard}
            onCreate={handleCreateCard}
            hasRegisteredCards={cards.length > 0}
          />
        )}
      </section>

      {/* Formulario */}
      {isFormOpen && (
        <CardForm
          banks={banks}
          accounts={accounts}
          card={editingCard}
          onSubmit={handleSubmitCard}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
}
