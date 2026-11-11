"use client";

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Plus,
  Wallet,
} from "lucide-react";

import type {
  Account,
  Bank,
  BankCard,
  CardPurchase,
  CardPayment,
  CardPaymentAllocation,
  Installment,
} from "@/types/account";

import { getCardById } from "@/services/card.service";
import { getBanks } from "@/services/bank.service";
import { getCardSummary } from "@/services/account-summary.service";
import { loadAccountStorage } from "@/services/account-storage.service";
import { registerInstallmentPaymentFromAccount } from "@/services/card-payment-registration.service";

import {
  getPurchasesByCard,
  createCardPurchaseWithPlan,
  type CreateCardPurchaseData,
} from "@/services/card-purchase.service";

import {
  getInstallmentPlanByPurchaseId,
  getInstallmentsByPlan,
  getInstallmentRemainingAmount,
} from "@/services/installment.service";

import CardPurchaseForm from "@/components/cards/CardPurchaeForm";

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function getInstallmentStatusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Pagada";
    case "partial":
      return "Pago parcial";
    case "pending":
      return "Pendiente";
    case "overdue":
      return "Vencida";
    default:
      return "Desconocido";
  }
}

function getInterestTypeLabel(interestType: string | undefined): string {
  switch (interestType) {
    case "fixed":
      return "Interés fijo";
    case "annual_rate":
      return "Tasa anual";
    case "none":
    default:
      return "Meses sin intereses";
  }
}

function getInstallmentStatusClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "partial":
      return "bg-amber-100 text-amber-700";
    case "pending":
      return "bg-gray-100 text-gray-600";
    case "overdue":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getInstallmentDisplayStatus(installment: Installment): string {
  const remaining = getInstallmentRemainingAmount(installment);

  if (remaining <= 0) return "paid";
  if (installment.dueDate < getTodayDate()) return "overdue";
  if (installment.paidAmount > 0) return "partial";

  return "pending";
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const cardId = params.id;

  const [card, setCard] = useState<BankCard | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [purchases, setPurchases] = useState<CardPurchase[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);
  const [cardPaymentAllocations, setCardPaymentAllocations] = useState<
    CardPaymentAllocation[]
  >([]);
  const [summary, setSummary] = useState<
    ReturnType<typeof getCardSummary>
  >(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------------------------------
  // ESTADOS DEL FORMULARIO DE COMPRAS
  // ---------------------------------------------------------------------------

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState("");

  // ---------------------------------------------------------------------------
  // ESTADO DEL FORMULARIO DE PAGO DE PARCIALIDAD
  // ---------------------------------------------------------------------------

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] =
    useState<Installment | null>(null);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // ---------------------------------------------------------------------------
  // ESTADO DE PARCIALIDADES DESPLEGADAS
  // ---------------------------------------------------------------------------

  const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(
    new Set(),
  );

  const togglePurchaseDetails = (purchaseId: string) => {
    setExpandedPurchases((previous) => {
      const updated = new Set(previous);

      if (updated.has(purchaseId)) {
        updated.delete(purchaseId);
      } else {
        updated.add(purchaseId);
      }

      return updated;
    });
  };

  // ---------------------------------------------------------------------------
  // CARGA DE INFORMACIÓN
  // ---------------------------------------------------------------------------

  const loadData = useCallback(() => {
    try {
      setIsLoading(true);
      setError("");

      const cardData = getCardById(cardId);

      if (!cardData || cardData.status !== "active") {
        setCard(null);
        setBank(null);
        setPurchases([]);
        setCardPayments([]);
        setCardPaymentAllocations([]);
        setSummary(null);
        setAccounts([]);
        return;
      }

      const banks = getBanks();

      const bankData =
        banks.find((item) => item.id === cardData.bankId) ?? null;

      const purchaseData = getPurchasesByCard(cardId);
      const summaryData = getCardSummary(cardId);
      const accountStorage = loadAccountStorage();
      const activeAccounts = accountStorage.accounts.filter(
        (account) => account.status === "active",
      );
      const cardPaymentsData = accountStorage.cardPayments.filter(
        (payment) => payment.cardId === cardId,
      );
      const cardPaymentIds = new Set(
        cardPaymentsData.map((payment) => payment.id),
      );
      const cardPaymentAllocationsData =
        accountStorage.cardPaymentAllocations.filter((allocation) =>
          cardPaymentIds.has(allocation.cardPaymentId),
        );

      setAccounts(activeAccounts);
      setCardPayments(cardPaymentsData);
      setCardPaymentAllocations(cardPaymentAllocationsData);
      setCard(cardData);
      setBank(bankData);
      setPurchases(purchaseData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Error al cargar el detalle de la tarjeta:", err);

      setError("No fue posible cargar la información de la tarjeta.");
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // REGISTRO DE COMPRAS
  // ---------------------------------------------------------------------------

  const handleCreatePurchase = (data: CreateCardPurchaseData) => {
    try {
      setIsSubmittingPurchase(true);
      setPurchaseError("");
      setPurchaseSuccess("");

      createCardPurchaseWithPlan(data);

      setIsPurchaseModalOpen(false);
      setPurchaseSuccess("La compra se registró correctamente.");

      loadData();
    } catch (err) {
      console.error("Error al registrar la compra:", err);

      setPurchaseError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar la compra.",
      );
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // ---------------------------------------------------------------------------
  // REGISTRO DE PAGO DE PARCIALIDAD
  // ---------------------------------------------------------------------------

  const handleOpenPaymentModal = (installment: Installment) => {
    const remaining = getInstallmentRemainingAmount(installment);

    if (remaining <= 0 || card?.type !== "credit") return;

    const defaultAccount = accounts.find(
      (account) => account.id === card.paymentAccountId,
    );

    setSelectedInstallment(installment);
    setPaymentAccountId(defaultAccount?.id ?? accounts[0]?.id ?? "");
    setPaymentAmount(remaining.toFixed(2));
    setPaymentDate(getTodayDate());
    setPaymentError("");
    setIsPaymentModalOpen(true);
  };

  const handleClosePaymentModal = () => {
    if (isSubmittingPayment) return;

    setIsPaymentModalOpen(false);
    setSelectedInstallment(null);
    setPaymentError("");
  };

  const handleRegisterInstallmentPayment = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!card || !selectedInstallment) return;

    try {
      setIsSubmittingPayment(true);
      setPaymentError("");

      const amount = Number(paymentAmount);
      const remaining = getInstallmentRemainingAmount(selectedInstallment);

      if (!paymentAccountId) {
        throw new Error("Selecciona una cuenta de origen.");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Ingresa un importe válido.");
      }

      if (amount > remaining) {
        throw new Error(
          `El importe no puede superar el saldo pendiente de ${currencyFormatter.format(remaining)}.`,
        );
      }

      registerInstallmentPaymentFromAccount({
        cardId: card.id,
        sourceAccountId: paymentAccountId,
        installmentId: selectedInstallment.id,
        amount,
        paidAt: paymentDate,
      });

      setIsPaymentModalOpen(false);
      setSelectedInstallment(null);
      setPurchaseSuccess("El pago de la parcialidad se registró correctamente.");
      loadData();
    } catch (err) {
      console.error("Error al registrar el pago de la parcialidad:", err);

      setPaymentError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar el pago.",
      );
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ESTADOS
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-surface-card p-12 text-center shadow-sm">
        <p className="text-sm text-muted">
          Cargando información de la tarjeta...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{error}</p>

        <button
          type="button"
          onClick={loadData}
          className="mt-4 text-sm font-semibold text-red-700 underline"
        >
          Intentar nuevamente
        </button>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="rounded-2xl bg-surface-card p-12 text-center shadow-sm">
        <CreditCard className="mx-auto h-10 w-10 text-muted" />

        <h2 className="mt-4 text-lg font-bold text-foreground">
          Tarjeta no encontrada
        </h2>

        <p className="mt-2 text-sm text-muted">
          La tarjeta no existe o se encuentra archivada.
        </p>

        <button
          type="button"
          onClick={() => router.push("/cards")}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Volver a tarjetas
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CÁLCULOS
  // ---------------------------------------------------------------------------

  const outstandingSinglePurchases =
    summary?.outstandingSinglePurchases ?? 0;

  const outstandingInstallments =
    summary?.outstandingInstallments ?? 0;

  const totalDebt =
    outstandingSinglePurchases + outstandingInstallments;

  const availableCredit =
    card.type === "credit" && card.creditLimit !== null
      ? Math.max(0, card.creditLimit - totalDebt)
      : null;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* Encabezado */}
      <section>
        <button
          type="button"
          onClick={() => router.push("/cards")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a tarjetas
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Gestión financiera
        </p>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {card.name}
            </h1>

            <p className="mt-2 text-sm text-muted">
              {bank?.name ?? "Institución bancaria"} ·{" "}
              {card.type === "credit" ? "Crédito" : "Débito"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPurchaseError("");
              setPurchaseSuccess("");
              setIsPurchaseModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Registrar compra
          </button>
        </div>
      </section>

      {/* Información de la tarjeta */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-brand-peach/40 p-5 shadow-sm">
          <p className="text-sm font-medium text-body">
            Deuda pendiente
          </p>

          <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {currencyFormatter.format(totalDebt)}
          </p>

          <p className="mt-2 text-xs text-body">
            Importe pendiente de pago
          </p>
        </article>

        <article className="rounded-2xl bg-brand-mint/40 p-5 shadow-sm">
          <p className="text-sm font-medium text-body">
            Compras de contado
          </p>

          <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {currencyFormatter.format(
              summary?.totalSinglePurchases ?? 0,
            )}
          </p>

          <p className="mt-2 text-xs text-body">
            Compras registradas a una sola exhibición
          </p>
        </article>

        <article className="rounded-2xl bg-brand-lavender/40 p-5 shadow-sm">
          <p className="text-sm font-medium text-body">
            Compras a parcialidades
          </p>

          <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {currencyFormatter.format(
              summary?.totalInstallmentPurchases ?? 0,
            )}
          </p>

          <p className="mt-2 text-xs text-body">
            Capital original de las compras financiadas
          </p>
        </article>

        <article className="rounded-2xl bg-brand-mint/40 p-5 shadow-sm">
          <p className="text-sm font-medium text-body">
            {card.type === "credit"
              ? "Crédito disponible"
              : "Total de compras"}
          </p>

          <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {card.type === "credit"
              ? currencyFormatter.format(availableCredit ?? 0)
              : currencyFormatter.format(summary?.totalPurchases ?? 0)}
          </p>

          <p className="mt-2 text-xs text-body">
            {card.type === "credit"
              ? "Límite menos deuda pendiente"
              : "Importe acumulado de compras"}
          </p>
        </article>
      </section>

      {/* Configuración */}
      <section className="rounded-2xl bg-surface-card p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">
          Información de la tarjeta
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Institución bancaria</p>

            <p className="mt-1 text-sm font-semibold text-foreground">
              {bank?.name ?? "No disponible"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">Tipo de tarjeta</p>

            <p className="mt-1 text-sm font-semibold text-foreground">
              {card.type === "credit" ? "Crédito" : "Débito"}
            </p>
          </div>

          {card.type === "credit" && (
            <>
              <div>
                <p className="text-xs text-muted">Límite de crédito</p>

                <p className="mt-1 text-sm font-semibold text-foreground">
                  {currencyFormatter.format(card.creditLimit ?? 0)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted">Día de corte</p>

                <p className="mt-1 text-sm font-semibold text-foreground">
                  Día {card.cutoffDay}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted">
                  Día límite de pago
                </p>

                <p className="mt-1 text-sm font-semibold text-foreground">
                  Día {card.paymentDueDay}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Historial de compras */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Historial de compras
          </h2>

          <p className="mt-1 text-sm text-muted">
            Consulta los movimientos registrados en esta tarjeta.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface-card shadow-sm">
          {purchases.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-muted" />

              <h3 className="mt-4 text-base font-semibold text-foreground">
                Sin compras registradas
              </h3>

              <p className="mt-2 text-sm text-muted">
                Las compras que registres aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-hairline bg-background">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-muted">
                      Descripción
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold text-muted">
                      Fecha
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold text-muted">
                      Modalidad
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted">
                      Importe
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted">
                      Detalle
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-hairline">
                  {purchases.map((purchase) => {
                    const isInstallmentPurchase =
                      purchase.purchaseType === "installments";

                    const isExpanded = expandedPurchases.has(purchase.id);

                    const purchaseAllocations = !isInstallmentPurchase
                      ? cardPaymentAllocations.filter(
                          (allocation) =>
                            allocation.type === "single_purchase" &&
                            allocation.purchaseId === purchase.id,
                        )
                      : [];

                    const singlePurchasePaid = purchaseAllocations.reduce(
                      (total, allocation) => total + allocation.amount,
                      0,
                    );
                    const singlePurchaseRemaining = Math.max(
                      0,
                      purchase.amount - singlePurchasePaid,
                    );
                    const singlePurchaseProgress =
                      purchase.amount > 0
                        ? Math.min(
                            100,
                            (singlePurchasePaid / purchase.amount) * 100,
                          )
                        : 0;
                    const singlePurchaseStatus =
                      singlePurchaseRemaining <= 0
                        ? "paid"
                        : singlePurchasePaid > 0
                          ? "partial"
                          : "pending";

                    const purchasePaymentHistory = purchaseAllocations
                      .flatMap((allocation) => {
                        const payment = cardPayments.find(
                          (item) => item.id === allocation.cardPaymentId,
                        );

                        return payment ? [{ allocation, payment }] : [];
                      })
                      .sort((a, b) =>
                        b.payment.paidAt.localeCompare(a.payment.paidAt),
                      );

                    const plan = isInstallmentPurchase
                      ? getInstallmentPlanByPurchaseId(purchase.id)
                      : undefined;

                    const installments = plan
                      ? getInstallmentsByPlan(plan.id)
                      : [];

                    const totalPaid = installments.reduce(
                      (total, installment) =>
                        total + installment.paidAmount,
                      0,
                    );

                    const totalRemaining = installments.reduce(
                      (total, installment) =>
                        total +
                        getInstallmentRemainingAmount(installment),
                      0,
                    );

                    const paidInstallments = installments.filter(
                      (installment) => installment.status === "paid",
                    ).length;

                    const progress =
                      plan && plan.totalAmount > 0
                        ? Math.min(
                            100,
                            (totalPaid / plan.totalAmount) * 100,
                          )
                        : 0;

                    return (
                      <Fragment key={purchase.id}>
                        {/* Fila de compra */}
                        <tr className="transition hover:bg-background/50">
                          <td className="px-6 py-5">
                            <div className="flex flex-col items-start gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {purchase.description}
                              </p>
                              {!isInstallmentPurchase && (
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    singlePurchaseStatus === "paid"
                                      ? "bg-green-100 text-green-700"
                                      : singlePurchaseStatus === "partial"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {singlePurchaseStatus === "paid"
                                    ? "Liquidada"
                                    : singlePurchaseStatus === "partial"
                                      ? "Pago parcial"
                                      : "Pendiente"}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-sm text-muted">
                            {formatDate(purchase.purchaseDate)}
                          </td>

                          <td className="px-6 py-5">
                            <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground">
                              {isInstallmentPurchase
                                ? `${purchase.installmentCount} meses · ${getInterestTypeLabel(purchase.interestType)}`
                                : "Contado"}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-right text-sm font-semibold text-foreground">
                            {currencyFormatter.format(purchase.amount)}
                          </td>

                          <td className="px-6 py-5 text-right">
                            <button
                              type="button"
                              onClick={() => togglePurchaseDetails(purchase.id)}
                              aria-expanded={isExpanded}
                              className="inline-flex items-center justify-end gap-2 whitespace-nowrap text-sm font-semibold text-foreground transition hover:text-primary"
                            >
                              {isExpanded
                                ? "Ocultar detalle"
                                : isInstallmentPurchase
                                  ? "Ver parcialidades"
                                  : "Ver pagos"}

                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </td>
                        </tr>

                        {/* Detalle de pagos de compra de contado */}
                        {!isInstallmentPurchase && isExpanded && (
                          <tr>
                            <td
                              colSpan={5}
                              className="bg-background/60 p-4 sm:p-6"
                            >
                              <div className="space-y-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <h3 className="text-base font-bold text-foreground">
                                      Estado de la compra
                                    </h3>
                                    <p className="mt-1 text-sm text-muted">
                                      Seguimiento de los pagos aplicados a esta compra.
                                    </p>
                                  </div>
                                  <span
                                    className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                      singlePurchaseStatus === "paid"
                                        ? "bg-green-100 text-green-700"
                                        : singlePurchaseStatus === "partial"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {singlePurchaseStatus === "paid" && (
                                      <span aria-hidden="true">✓</span>
                                    )}
                                    {singlePurchaseStatus === "paid"
                                      ? "Compra liquidada"
                                      : singlePurchaseStatus === "partial"
                                        ? "Pago parcial"
                                        : "Sin pagos aplicados"}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                    <p className="text-xs text-muted">Importe original</p>
                                    <p className="mt-2 text-base font-bold text-foreground">
                                      {currencyFormatter.format(purchase.amount)}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                    <p className="text-xs text-muted">Total pagado</p>
                                    <p className="mt-2 text-base font-bold text-green-700">
                                      {currencyFormatter.format(singlePurchasePaid)}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                    <p className="text-xs text-muted">Saldo pendiente</p>
                                    <p className="mt-2 text-base font-bold text-foreground">
                                      {currencyFormatter.format(singlePurchaseRemaining)}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-medium text-muted">
                                      Progreso de pago
                                    </p>
                                    <p className="text-xs font-semibold text-foreground">
                                      {Math.round(singlePurchaseProgress)}%
                                    </p>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-surface-card">
                                    <div
                                      className="h-full rounded-full bg-green-600 transition-all"
                                      style={{ width: `${singlePurchaseProgress}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-sm font-bold text-foreground">
                                    Historial de pagos
                                  </h4>

                                  {purchasePaymentHistory.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-hairline bg-surface-card p-5 text-center">
                                      <p className="text-sm text-muted">
                                        Todavía no hay pagos aplicados a esta compra.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card">
                                      {purchasePaymentHistory.map(
                                        ({ allocation, payment }, index) => (
                                          <div
                                            key={allocation.id}
                                            className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                                              index > 0 ? "border-t border-hairline" : ""
                                            }`}
                                          >
                                            <div className="flex items-start gap-3">
                                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                                                <Wallet className="h-4 w-4" />
                                              </div>
                                              <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                  Pago aplicado
                                                </p>
                                                <p className="mt-0.5 text-xs text-muted">
                                                  {formatDate(payment.paidAt)}
                                                </p>
                                              </div>
                                            </div>
                                            <p className="text-sm font-bold text-green-700 sm:text-right">
                                              +{currencyFormatter.format(allocation.amount)}
                                            </p>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Detalle de parcialidades */}
                        {isInstallmentPurchase && isExpanded && (
                          <tr>
                            <td colSpan={5} className="bg-background/60 p-4 sm:p-6">
                              {plan ? (
                                <div className="space-y-6">
                                  {/* Encabezado */}
                                  <div>
                                    <h3 className="text-base font-bold text-foreground">
                                      Plan de mensualidades
                                    </h3>

                                    <p className="mt-1 text-sm text-muted">
                                      {purchase.description}
                                    </p>
                                  </div>

                                  {/* Resumen del plan */}
                                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">Capital original</p>
                                      <p className="mt-2 text-sm font-bold text-foreground">
                                        {currencyFormatter.format(plan.principalAmount)}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">Intereses totales</p>
                                      <p className="mt-2 text-sm font-bold text-foreground">
                                        {currencyFormatter.format(plan.interestAmount)}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">Total financiado</p>
                                      <p className="mt-2 text-sm font-bold text-foreground">
                                        {currencyFormatter.format(plan.totalAmount)}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">Total pagado</p>
                                      <p className="mt-2 text-sm font-bold text-green-700">
                                        {currencyFormatter.format(totalPaid)}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">Saldo pendiente</p>
                                      <p className="mt-2 text-sm font-bold text-foreground">
                                        {currencyFormatter.format(totalRemaining)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-xs text-muted">Tipo de financiamiento</p>
                                        <p className="mt-1 text-sm font-semibold text-foreground">
                                          {getInterestTypeLabel(plan.interestType)}
                                        </p>
                                      </div>

                                      {plan.interestType === "annual_rate" &&
                                        plan.annualInterestRate !== null && (
                                          <div>
                                            <p className="text-xs text-muted">Tasa anual nominal</p>
                                            <p className="mt-1 text-sm font-semibold text-foreground">
                                              {plan.annualInterestRate.toFixed(2)}%
                                            </p>
                                          </div>
                                        )}

                                      <div>
                                        <p className="text-xs text-muted">Parcialidades pagadas</p>
                                        <p className="mt-1 text-sm font-semibold text-foreground">
                                          {paidInstallments} de {plan.installmentCount}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Progreso de pago */}
                                  <div>
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-xs font-medium text-muted">
                                        Progreso de pago
                                      </p>

                                      <p className="text-xs font-semibold text-foreground">
                                        {Math.round(progress)}%
                                      </p>
                                    </div>

                                    <div className="h-2 overflow-hidden rounded-full bg-surface-card">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{
                                          width: `${progress}%`,
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Calendario */}
                                  <div>
                                    <div className="mb-3 flex items-center justify-between">
                                      <h4 className="text-sm font-bold text-foreground">
                                        Calendario de parcialidades
                                      </h4>

                                      <span className="text-xs text-muted">
                                        {installments.length} registros
                                      </span>
                                    </div>

                                    {installments.length === 0 ? (
                                      <div className="rounded-xl bg-surface-card p-6 text-center">
                                        <p className="text-sm text-muted">
                                          Este plan todavía no tiene parcialidades registradas.
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-card">
                                        <table className="w-full text-left">
                                          <thead className="border-b border-hairline bg-background">
                                            <tr>
                                              <th className="px-4 py-3 text-xs font-semibold text-muted">
                                                #
                                              </th>

                                              <th className="px-4 py-3 text-xs font-semibold text-muted">
                                                Vencimiento
                                              </th>

                                              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-muted">
                                                Capital
                                              </th>

                                              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-muted">
                                                Intereses
                                              </th>

                                              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-muted">
                                                Total
                                              </th>

                                              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-muted">
                                                Pagado
                                              </th>

                                              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-muted">
                                                Pendiente
                                              </th>

                                              <th className="px-4 py-3 text-right text-xs font-semibold text-muted">
                                                Estado
                                              </th>
                                              <th className="px-4 py-3 text-right text-xs font-semibold text-muted">
                                                Acción
                                              </th>
                                            </tr>
                                          </thead>

                                          <tbody className="divide-y divide-hairline">
                                            {installments.map((installment) => {
                                              const remaining =
                                                getInstallmentRemainingAmount(installment);
                                              const displayStatus =
                                                getInstallmentDisplayStatus(installment);

                                              return (
                                              <tr key={installment.id}>
                                                <td className="px-4 py-3 text-sm font-medium text-foreground">
                                                  {installment.installmentNumber}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                                                  {formatDate(installment.dueDate)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-foreground">
                                                  {currencyFormatter.format(installment.principalAmount)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-muted">
                                                  {currencyFormatter.format(installment.interestAmount)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-foreground">
                                                  {currencyFormatter.format(installment.amount)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-green-700">
                                                  {currencyFormatter.format(
                                                    installment.paidAmount,
                                                  )}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-foreground">
                                                  {currencyFormatter.format(
                                                    remaining,
                                                  )}
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                  <span
                                                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getInstallmentStatusClass(
                                                      displayStatus,
                                                    )}`}
                                                  >
                                                    {getInstallmentStatusLabel(
                                                      displayStatus,
                                                    )}
                                                  </span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                                  {card.type === "credit" && remaining > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleOpenPaymentModal(installment)
                                                      }
                                                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                                                    >
                                                      <Wallet className="h-3.5 w-3.5" />
                                                      Pagar
                                                    </button>
                                                  )}
                                                </td>
                                              </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                  <p className="text-sm font-medium text-amber-800">
                                    No se encontró el plan de parcialidades asociado a esta compra.
                                  </p>

                                  <p className="mt-1 text-xs text-amber-700">
                                    Es necesario revisar la integridad de los registros MSI.
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Mensaje de éxito */}
      {purchaseSuccess && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-medium text-green-800 shadow-lg">
          {purchaseSuccess}
        </div>
      )}

      {/* Modal de registro de compra */}
      {isPurchaseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !isSubmittingPurchase
            ) {
              setIsPurchaseModalOpen(false);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">
                Registrar compra
              </h2>

              <p className="mt-1 text-sm text-muted">
                Registra una compra realizada con esta tarjeta.
              </p>
            </div>

            {purchaseError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {purchaseError}
              </div>
            )}

            <CardPurchaseForm
              card={card}
              onSubmit={handleCreatePurchase}
              onCancel={() => setIsPurchaseModalOpen(false)}
              isSubmitting={isSubmittingPurchase}
            />
          </div>
        </div>
      )}

      {/* Modal de pago de parcialidad */}
      {isPaymentModalOpen && selectedInstallment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleClosePaymentModal();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">
                Pagar parcialidad
              </h2>
              <p className="mt-1 text-sm text-muted">
                Registra el pago desde una de tus cuentas activas.
              </p>
            </div>

            <div className="mb-5 rounded-xl bg-surface-card p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted">Parcialidad</span>
                <span className="text-sm font-semibold text-foreground">
                  #{selectedInstallment.installmentNumber}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-sm text-muted">Vencimiento</span>
                <span className="text-sm font-medium text-foreground">
                  {formatDate(selectedInstallment.dueDate)}
                </span>
              </div>
              <div className="mt-3 border-t border-hairline pt-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-muted">
                    Saldo pendiente
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {currencyFormatter.format(
                      getInstallmentRemainingAmount(selectedInstallment),
                    )}
                  </span>
                </div>
              </div>
            </div>

            {paymentError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {paymentError}
              </div>
            )}

            {accounts.length === 0 ? (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No tienes cuentas activas disponibles. Registra o reactiva una
                cuenta antes de realizar el pago.
              </div>
            ) : (
              <form
                onSubmit={handleRegisterInstallmentPayment}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="payment-account"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Cuenta de origen
                  </label>
                  <select
                    id="payment-account"
                    value={paymentAccountId}
                    onChange={(event) =>
                      setPaymentAccountId(event.target.value)
                    }
                    required
                    className="w-full rounded-xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                  >
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payment-amount"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Importe a pagar
                  </label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="0.01"
                    max={getInstallmentRemainingAmount(selectedInstallment)}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    required
                    className="w-full rounded-xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-muted">
                    Puedes registrar un pago parcial o liquidar la parcialidad.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="payment-date"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Fecha del pago
                  </label>
                  <input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    max={getTodayDate()}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    required
                    className="w-full rounded-xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleClosePaymentModal}
                    disabled={isSubmittingPayment}
                    className="rounded-full border border-hairline px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPayment || !paymentAccountId}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wallet className="h-4 w-4" />
                    {isSubmittingPayment ? "Registrando..." : "Confirmar pago"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
