
"use client";

import { useMemo, useState, useEffect } from "react";

import { transactionCategories } from "@/lib/transaction-categories";

import TransactionSummary from "@/components/transactions/TransactionSummary";
import TransactionList from "@/components/transactions/TransactionList";
import TransactionFilters, {
  type TransactionFilterValues,
} from "@/components/transactions/TransactionFilters";
import TransactionForm, {
  type NewTransactionData,
} from "@/components/transactions/TransactionForm";
import TransactionDetails from "@/components/transactions/TransactionDetails";
import CategoryExpenseChart from "@/components/transactions/CategoryExpenseChart";

import { transactionsData } from "@/lib/transactions-data";

import type { Transaction } from "@/components/transactions/TransactionList";
import type { TransactionAuditEvent } from "@/types/transaction-audit";

import {
  loadTransactionStorage,
  saveTransactionStorage,
} from "@/services/transaction-storage.service";

import {
  createTransactionAuditEvent,
  createTransactionUpdateAuditEvent,
  createTransactionCancellationAuditEvent,
  createTransactionRestoreAuditEvent,
  createTransactionRemovalAuditEvent,
} from "@/services/transaction-audit.service";

import { useAlert } from "@/context/AlertContext";

import { getActiveAccounts } from "@/services/account.service";
import { getActiveCards } from "@/services/card.service";
import { loadAccountStorage } from "@/services/account-storage.service";

import { registerCardPaymentFromAccount } from "@/services/card-payment-registration.service";

export default function TransactionsPage() {
  const [transactions, setTransactions] =
    useState<Transaction[]>(transactionsData);

  const [auditEvents, setAuditEvents] = useState<
    TransactionAuditEvent[]
  >([]);

  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  const [accountOptions, setAccountOptions] = useState<
    { id: string; name: string }[]
  >([]);

  const [destinationAccountOptions, setDestinationAccountOptions] =
    useState<{ id: string; name: string }[]>([]);

  const { toast, confirm } = useAlert();

  // ---------------------------------------------------------------------------
  // CARGA INICIAL
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const storedData = loadTransactionStorage();

    try {
      const activeAccounts = getActiveAccounts();
      const activeCards = getActiveCards();

      setAccountOptions(
        activeAccounts.map((account) => ({
          id: account.id,
          name: account.name,
        })),
      );

      setDestinationAccountOptions([
        ...activeAccounts.map((account) => ({
          id: account.id,
          name: account.name,
        })),

        ...activeCards
          .filter((card) => card.type === "credit")
          .map((card) => ({
            id: `card:${card.id}`,
            name: `${card.name} (Tarjeta de crédito)`,
          })),
      ]);
    } catch (error) {
      console.error(
        "No fue posible cargar las cuentas y tarjetas:",
        error,
      );

      setAccountOptions([]);
      setDestinationAccountOptions([]);
    }

    if (storedData) {
      setTransactions(storedData.transactions);
      setAuditEvents(storedData.auditEvents);
    }

    setIsStorageLoaded(true);
  }, []);

  // ---------------------------------------------------------------------------
  // PERSISTENCIA
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isStorageLoaded) return;

    const saved = saveTransactionStorage({
      transactions,
      auditEvents,
    });

    if (!saved) {
      console.error(
        "No fue posible guardar los movimientos en el almacenamiento local.",
      );
    }
  }, [transactions, auditEvents, isStorageLoaded]);

  // ---------------------------------------------------------------------------
  // ESTADOS DE FORMULARIOS Y MODALES
  // ---------------------------------------------------------------------------

  const [isFormOpen, setIsFormOpen] = useState(false);

  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const [transactionToCancel, setTransactionToCancel] =
    useState<Transaction | null>(null);

  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationError, setCancellationError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [highlightedTransactionId, setHighlightedTransactionId] =
    useState<string | null>(null);

  const ITEMS_PER_PAGE = 20;

  const [filters, setFilters] = useState<TransactionFilterValues>({
    search: "",
    type: "all",
    account: "all",
    category: "all",
    status: "all",
  });

  // ---------------------------------------------------------------------------
  // CUENTAS Y CATEGORÍAS
  // ---------------------------------------------------------------------------

  const accounts = useMemo(
    () =>
      [
        ...new Set(
          transactions.flatMap((transaction) =>
            transaction.type === "transfer"
              ? transaction.account.split(" → ")
              : [transaction.account],
          ),
        ),
      ].sort(),
    [transactions],
  );

  const categories = transactionCategories;

  // ---------------------------------------------------------------------------
  // FILTRADO
  // ---------------------------------------------------------------------------

  const filteredTransactions = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !search ||
        transaction.description.toLowerCase().includes(search) ||
        transaction.category.toLowerCase().includes(search) ||
        transaction.account.toLowerCase().includes(search) ||
        (transaction.cancellationReason ?? "")
          .toLowerCase()
          .includes(search);

      const matchesType =
        filters.type === "all" ||
        transaction.type === filters.type;

      const matchesAccount =
        filters.account === "all" ||
        transaction.account.split(" → ").includes(filters.account);

      const matchesCategory =
        filters.category === "all" ||
        transaction.category === filters.category;

      const transactionStatus =
        transaction.status === "cancelled"
          ? "cancelled"
          : "active";

      const matchesStatus =
        filters.status === "all" ||
        transactionStatus === filters.status;

      return (
        matchesSearch &&
        matchesType &&
        matchesAccount &&
        matchesCategory &&
        matchesStatus
      );
    });
  }, [transactions, filters]);

  // ---------------------------------------------------------------------------
  // PAGINACIÓN
  // ---------------------------------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE),
  );

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // ---------------------------------------------------------------------------
  // RESALTADO DE MOVIMIENTOS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!highlightedTransactionId) return;

    const timeout = window.setTimeout(() => {
      setHighlightedTransactionId(null);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [highlightedTransactionId]);

  // ---------------------------------------------------------------------------
  // RESUMEN FINANCIERO
  // ---------------------------------------------------------------------------

  const activeTransactions = filteredTransactions.filter(
    (transaction) => transaction.status !== "cancelled",
  );

  const income = activeTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce(
      (total, transaction) => total + Math.abs(transaction.amount),
      0,
    );

  const expenses = activeTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce(
      (total, transaction) => total + Math.abs(transaction.amount),
      0,
    );

  const netBalance = income - expenses;

  // ---------------------------------------------------------------------------
  // PROTECCIÓN DE TRANSFERENCIAS VINCULADAS A PAGOS FINANCIEROS
  // ---------------------------------------------------------------------------

  function isLinkedToCardPayment(transactionId: string): boolean {
    const storage = loadAccountStorage();

    return (storage?.cardPayments ?? []).some(
      (payment) => payment.transactionId === transactionId,
    );
  }

  function isLinkedToLoanPayment(transactionId: string): boolean {
    const storage = loadAccountStorage();

    return (storage?.loanPayments ?? []).some(
      (payment) => payment.transactionId === transactionId,
    );
  }

  function isLinkedToManagedPayment(transactionId: string): boolean {
    return (
      isLinkedToCardPayment(transactionId) ||
      isLinkedToLoanPayment(transactionId)
    );
  }

  // ---------------------------------------------------------------------------
  // FORMULARIOS
  // ---------------------------------------------------------------------------

  function closeForm() {
    setIsFormOpen(false);
    setEditingTransaction(null);
  }

  /**
   * Sincroniza el estado de React con el almacenamiento local.
   *
   * Se utiliza después de registrar un pago financiero porque el servicio
   * registra la transferencia y su auditoría directamente en localStorage.
   */
  function refreshTransactionStorage() {
    const storedData = loadTransactionStorage();

    if (!storedData) {
      throw new Error(
        "No fue posible recuperar los movimientos guardados.",
      );
    }

    setTransactions(storedData.transactions);
    setAuditEvents(storedData.auditEvents);

    return storedData;
  }

  // ---------------------------------------------------------------------------
  // CREACIÓN DE TRANSACCIONES
  // ---------------------------------------------------------------------------

  function handleCreateTransaction(data: NewTransactionData) {
    try {
      // -----------------------------------------------------------------------
      // CASO 1: PAGO A TARJETA DE CRÉDITO
      // -----------------------------------------------------------------------

      if (data.cardPayment) {
        if (data.type !== "transfer") {
          throw new Error(
            "El pago de una tarjeta debe registrarse como transferencia.",
          );
        }

        const [sourceAccountId, destinationAccountId] =
          data.account.split("→").map((part) => part.trim());

        if (!sourceAccountId || !destinationAccountId) {
          throw new Error(
            "No fue posible identificar las cuentas de la transferencia.",
          );
        }

        if (
          destinationAccountId !== `card:${data.cardPayment.cardId}`
        ) {
          throw new Error(
            "La tarjeta seleccionada no coincide con el destino de la transferencia.",
          );
        }

        const result = registerCardPaymentFromAccount({
          cardId: data.cardPayment.cardId,
          sourceAccountId,
          amount: Math.abs(data.amount),
          paidAt: data.date,
          allocationMode: "manual",
          allocations: data.cardPayment.allocations,
        });

        // El servicio ya guardó la transferencia, el pago global
        // y las asignaciones. No debemos crear otra transacción.
        refreshTransactionStorage();

        setCurrentPage(1);
        setHighlightedTransactionId(result.transaction.id);

        closeForm();

        toast.success(
          `Se registró el pago de ${formatCurrency(
            result.paymentResult.payment.amount,
          )} a la tarjeta. ${formatCurrency(
            result.paymentResult.allocatedAmount,
          )} fueron aplicados y ${formatCurrency(
            result.paymentResult.unappliedAmount,
          )} quedaron sin aplicar.`,
          "Pago de tarjeta registrado",
        );

        return;
      }

      // -----------------------------------------------------------------------
      // CASO 2: TRANSACCIÓN NORMAL O TRANSFERENCIA ENTRE CUENTAS
      // -----------------------------------------------------------------------

      const newTransaction: Transaction = {
        id: `transaction-${crypto.randomUUID()}`,
        ...data,
        registeredAt: new Date().toISOString(),
        status: "active",
        date: data.date,
      };

      const auditEvent =
        createTransactionAuditEvent(newTransaction);

      setTransactions((current) => [
        newTransaction,
        ...current,
      ]);

      setAuditEvents((current) => [
        auditEvent,
        ...current,
      ]);

      setCurrentPage(1);
      setHighlightedTransactionId(newTransaction.id);

      closeForm();
    } catch (error) {
      console.error(
        "Error al registrar la transacción:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible registrar el movimiento.",
        "Error al guardar",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // EDICIÓN DE TRANSACCIONES
  // ---------------------------------------------------------------------------

  function handleEditTransaction(data: NewTransactionData) {
    if (!editingTransaction) return;

    if (isLinkedToManagedPayment(editingTransaction.id)) {
      toast.error(
        "Esta transferencia está vinculada a un pago financiero. No se puede modificar.",
        "Movimiento protegido",
      );

      closeForm();
      return;
    }

    const updatedTransaction: Transaction = {
      ...editingTransaction,
      ...data,
      status: "active",
      date: data.date,
    };

    const auditEvent = createTransactionUpdateAuditEvent(
      editingTransaction,
      updatedTransaction,
    );

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === editingTransaction.id &&
        transaction.status !== "cancelled"
          ? updatedTransaction
          : transaction,
      ),
    );

    if (auditEvent) {
      setAuditEvents((current) => [
        auditEvent,
        ...current,
      ]);
    }

    closeForm();
  }

  // ---------------------------------------------------------------------------
  // APERTURA DE FORMULARIOS Y DETALLES
  // ---------------------------------------------------------------------------

  function handleOpenCreateForm() {
    setEditingTransaction(null);
    setIsFormOpen(true);
  }

  function handleOpenEditForm(transaction: Transaction) {
    if (transaction.status === "cancelled") return;

    if (isLinkedToManagedPayment(transaction.id)) {
      toast.error(
        "Esta transferencia está vinculada a un pago financiero y no se puede editar.",
        "Movimiento protegido",
      );
      return;
    }

    setSelectedTransaction(null);
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  }

  function handleOpenDetails(transaction: Transaction) {
    setSelectedTransaction(transaction);
  }

  // ---------------------------------------------------------------------------
  // CANCELACIÓN
  // ---------------------------------------------------------------------------

  function handleOpenCancellation(transaction: Transaction) {
    if (transaction.status === "cancelled") return;

    if (isLinkedToManagedPayment(transaction.id)) {
      toast.error(
        "Esta transferencia está vinculada a un pago financiero. No se puede cancelar.",
        "Movimiento protegido",
      );
      return;
    }

    setTransactionToCancel(transaction);
    setCancellationReason("");
    setCancellationError("");
  }

  function handleCancelTransaction() {
    if (!transactionToCancel) return;

    if (isLinkedToManagedPayment(transactionToCancel.id)) {
      toast.error(
        "Esta transferencia está vinculada a un pago financiero. No se puede cancelar.",
        "Movimiento protegido",
      );

      setTransactionToCancel(null);
      return;
    }

    const reason = cancellationReason.trim();

    if (!reason) {
      setCancellationError(
        "Debes indicar el motivo de la cancelación.",
      );
      return;
    }

    if (transactionToCancel.status === "cancelled") return;

    const auditEvent = createTransactionCancellationAuditEvent(
      transactionToCancel,
      reason,
    );

    const cancelledTransaction: Transaction = {
      ...transactionToCancel,
      status: "cancelled",
      cancellationReason: reason,
    };

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === transactionToCancel.id &&
        transaction.status !== "cancelled"
          ? cancelledTransaction
          : transaction,
      ),
    );

    setAuditEvents((current) => [
      auditEvent,
      ...current,
    ]);

    setSelectedTransaction((current) =>
      current?.id === transactionToCancel.id
        ? cancelledTransaction
        : current,
    );

    setTransactionToCancel(null);
    setCancellationReason("");
    setCancellationError("");

    toast.success(
      `El movimiento "${transactionToCancel.description}" fue cancelado.`,
      "Movimiento cancelado",
    );
  }

  // ---------------------------------------------------------------------------
  // RESTAURACIÓN
  // ---------------------------------------------------------------------------

  function handleRestoreTransaction(transaction: Transaction) {
    if (transaction.status !== "cancelled") return;

    if (isLinkedToManagedPayment(transaction.id)) {
      toast.error(
        "Esta transferencia está vinculada a un pago financiero y no puede modificarse desde aquí.",
        "Movimiento protegido",
      );
      return;
    }

    const restoredTransaction: Transaction = {
      ...transaction,
      status: "active",
      cancellationReason: undefined,
    };

    const auditEvent =
      createTransactionRestoreAuditEvent(transaction);

    setTransactions((current) =>
      current.map((item) =>
        item.id === transaction.id &&
        item.status === "cancelled"
          ? restoredTransaction
          : item,
      ),
    );

    setAuditEvents((current) => [
      auditEvent,
      ...current,
    ]);

    setSelectedTransaction((current) =>
      current?.id === transaction.id
        ? restoredTransaction
        : current,
    );

    toast.success(
      `El movimiento "${transaction.description}" volvió a estar activo.`,
      "Cancelación revertida",
    );
  }

  // ---------------------------------------------------------------------------
  // ELIMINACIÓN
  // ---------------------------------------------------------------------------

  function handleRemoveTransaction(transaction: Transaction) {
    if (transaction.status !== "cancelled") return;

    if (isLinkedToManagedPayment(transaction.id)) {
      toast.error(
        "Esta transferencia está vinculada a un pago financiero. No se puede retirar.",
        "Movimiento protegido",
      );
      return;
    }

    confirm({
      title: "Quitar movimiento cancelado",
      description: `¿Deseas quitar "${transaction.description}" de la lista? Esta acción no se puede deshacer desde la interfaz. Su historial de auditoría se conservará.`,
      confirmText: "Sí, quitar movimiento",
      cancelText: "Conservar",
      type: "warning",

      onConfirm: () => {
        if (isLinkedToManagedPayment(transaction.id)) {
          toast.error(
            "Esta transferencia está vinculada a un pago financiero. No se puede retirar.",
            "Movimiento protegido",
          );
          return;
        }

        const auditEvent =
          createTransactionRemovalAuditEvent(transaction);

        setTransactions((current) =>
          current.filter((item) => item.id !== transaction.id),
        );

        setAuditEvents((current) => [
          auditEvent,
          ...current,
        ]);

        setSelectedTransaction((current) =>
          current?.id === transaction.id ? null : current,
        );

        toast.success(
          `El movimiento "${transaction.description}" fue retirado de la lista.`,
          "Movimiento retirado",
        );
      },
    });
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Gestión financiera
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Transacciones
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Consulta y administra todos tus ingresos, gastos y transferencias.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateForm}
          className="flex w-fit items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-neutral-800"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Nueva transacción
        </button>
      </section>

      <TransactionSummary
        income={income}
        expenses={expenses}
        netBalance={netBalance}
      />

      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        accounts={accounts}
        categories={categories}
      />

      <section className="space-y-4">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
          {/* LISTA DE TRANSACCIONES */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Todos los movimientos
              </h2>

              <p className="text-xs text-muted">
                {filteredTransactions.length} de {transactions.length}{" "}
                movimientos
              </p>
            </div>

            <TransactionList
              transactions={paginatedTransactions}
              onEdit={handleOpenEditForm}
              onCancel={handleOpenCancellation}
              onView={handleOpenDetails}
              onRestore={handleRestoreTransaction}
              onRemove={handleRemoveTransaction}
              highlightedTransactionId={highlightedTransactionId}
            />

            {filteredTransactions.length > ITEMS_PER_PAGE && (
              <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(
                    currentPage * ITEMS_PER_PAGE,
                    filteredTransactions.length,
                  )}{" "}
                  de {filteredTransactions.length} movimientos
                </p>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, page - 1),
                      )
                    }
                    disabled={currentPage === 1}
                    className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  <span className="px-2 text-xs font-medium tabular-nums text-muted">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* GRÁFICA DE GASTOS POR CATEGORÍA */}
          <div className="min-w-0 xl:sticky xl:top-36">
            <CategoryExpenseChart
              transactions={filteredTransactions}
            />
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        Datos ilustrativos · Los movimientos y su historial de auditoría
        se conservan en el almacenamiento local de este navegador.
      </p>

      <button
        type="button"
        onClick={() =>
          toast.success(
            "El sistema global de alertas funciona correctamente.",
            "Prueba exitosa",
          )
        }
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
      >
        Probar alerta
      </button>

      <button
        type="button"
        onClick={() =>
          confirm({
            title: "Prueba de confirmación",
            description: "¿Deseas ejecutar esta acción de prueba?",
            confirmText: "Sí, continuar",
            cancelText: "Volver",
            type: "warning",
            onConfirm: () => {
              toast.success(
                "Confirmación ejecutada correctamente.",
              );
            },
          })
        }
        className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-foreground"
      >
        Probar confirmación
      </button>

      {/* FORMULARIO */}
      {isFormOpen && (
        <TransactionForm
          key={editingTransaction?.id ?? "new-transaction"}
          accounts={accountOptions}
          destinationAccounts={destinationAccountOptions}
          transaction={editingTransaction}
          onSubmit={
            editingTransaction
              ? handleEditTransaction
              : handleCreateTransaction
          }
          onCancel={closeForm}
        />
      )}

      {/* DETALLES */}
      {selectedTransaction && (
        <TransactionDetails
          transaction={selectedTransaction}
          auditEvents={auditEvents}
          onClose={() => setSelectedTransaction(null)}
          onEdit={handleOpenEditForm}
        />
      )}

      {/* MODAL DE CANCELACIÓN */}
      {transactionToCancel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-transaction-title"
            className="my-auto w-full max-w-md rounded-3xl bg-background p-6 shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 0l-7.5-13.1a2 2 0 0 0-3.4 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2
              id="cancel-transaction-title"
              className="mt-4 text-xl font-bold text-foreground"
            >
              Cancelar movimiento
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted">
              Vas a cancelar{" "}
              <strong>{transactionToCancel.description}</strong>.
              El movimiento permanecerá en el historial, pero dejará
              de considerarse en los indicadores financieros.
            </p>

            <label
              htmlFor="cancellation-reason"
              className="mt-5 block text-sm font-semibold text-foreground"
            >
              Motivo de cancelación
            </label>

            <textarea
              id="cancellation-reason"
              rows={3}
              value={cancellationReason}
              onChange={(event) => {
                setCancellationReason(event.target.value);
                setCancellationError("");
              }}
              placeholder="Explica por qué se cancela este movimiento..."
              className="mt-1.5 w-full resize-none rounded-xl border border-hairline bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />

            {cancellationError && (
              <p role="alert" className="mt-2 text-sm text-error">
                {cancellationError}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setTransactionToCancel(null)}
                className="rounded-full border border-hairline px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-card"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={handleCancelTransaction}
                className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
