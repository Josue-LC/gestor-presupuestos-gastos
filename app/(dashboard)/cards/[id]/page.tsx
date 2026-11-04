
"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Plus,
} from "lucide-react";

import type {
  Bank,
  BankCard,
  CardPurchase,
} from "@/types/account";

import { getCardById } from "@/services/card.service";
import { getBanks } from "@/services/bank.service";
import { getCardSummary } from "@/services/account-summary.service";

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
    default:
      return "Desconocido";
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
    default:
      return "bg-gray-100 text-gray-600";
  }
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
  const [summary, setSummary] = useState<
    ReturnType<typeof getCardSummary>
  >(null);

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
        setSummary(null);
        return;
      }

      const banks = getBanks();

      const bankData =
        banks.find((item) => item.id === cardData.bankId) ?? null;

      const purchaseData = getPurchasesByCard(cardId);
      const summaryData = getCardSummary(cardId);

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
            Compras a MSI
          </p>

          <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {currencyFormatter.format(
              summary?.totalInstallmentPurchases ?? 0,
            )}
          </p>

          <p className="mt-2 text-xs text-body">
            Importe original de compras a meses
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
                            <p className="text-sm font-semibold text-foreground">
                              {purchase.description}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-sm text-muted">
                            {formatDate(purchase.purchaseDate)}
                          </td>

                          <td className="px-6 py-5">
                            <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground">
                              {isInstallmentPurchase
                                ? `${purchase.installmentCount} MSI`
                                : "Contado"}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-right text-sm font-semibold text-foreground">
                            {currencyFormatter.format(purchase.amount)}
                          </td>

                          <td className="px-6 py-5 text-right">
                            {isInstallmentPurchase && (
                              <button
                                type="button"
                                onClick={() =>
                                  togglePurchaseDetails(purchase.id)
                                }
                                aria-expanded={isExpanded}
                                className="inline-flex items-center justify-end gap-2 whitespace-nowrap text-sm font-semibold text-foreground transition hover:text-primary"
                              >
                                {isExpanded
                                  ? "Ocultar detalle"
                                  : "Ver parcialidades"}

                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            )}
                          </td>
                        </tr>

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
                                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">
                                        Importe original
                                      </p>

                                      <p className="mt-2 text-sm font-bold text-foreground">
                                        {currencyFormatter.format(
                                          plan.totalAmount,
                                        )}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">
                                        Total pagado
                                      </p>

                                      <p className="mt-2 text-sm font-bold text-green-700">
                                        {currencyFormatter.format(totalPaid)}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">
                                        Saldo pendiente
                                      </p>

                                      <p className="mt-2 text-sm font-bold text-foreground">
                                        {currencyFormatter.format(
                                          totalRemaining,
                                        )}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-surface-card p-4 shadow-sm">
                                      <p className="text-xs text-muted">
                                        Parcialidades pagadas
                                      </p>

                                      <p className="mt-2 text-sm font-bold text-foreground">
                                        {paidInstallments} de{" "}
                                        {plan.installmentCount}
                                      </p>
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
                                                Importe
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
                                            </tr>
                                          </thead>

                                          <tbody className="divide-y divide-hairline">
                                            {installments.map((installment) => (
                                              <tr key={installment.id}>
                                                <td className="px-4 py-3 text-sm font-medium text-foreground">
                                                  {installment.installmentNumber}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                                                  {formatDate(installment.dueDate)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-foreground">
                                                  {currencyFormatter.format(
                                                    installment.amount,
                                                  )}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-green-700">
                                                  {currencyFormatter.format(
                                                    installment.paidAmount,
                                                  )}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-foreground">
                                                  {currencyFormatter.format(
                                                    getInstallmentRemainingAmount(
                                                      installment,
                                                    ),
                                                  )}
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                  <span
                                                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getInstallmentStatusClass(
                                                      installment.status,
                                                    )}`}
                                                  >
                                                    {getInstallmentStatusLabel(
                                                      installment.status,
                                                    )}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
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
    </div>
  );
}
