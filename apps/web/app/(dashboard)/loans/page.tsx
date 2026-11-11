"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  Loan,
  LoanInstallment,
  LoanStatus,
} from "@/types/loan.types";

import type { Bank, Account } from "@/types/account";

import { useAlert } from "@/context/AlertContext";

import {
  createLoan,
  getLoans,
  getLoanSchedule,
  updateLoan,
} from "@/services/loan.service";

import {
  getLoanOutstandingBalance,
  getLoanInstallmentsWithCurrentStatus,
  getLoanPayments,
} from "@/services/loan-payment.service";

import { getBanks } from "@/services/bank.service";
import { getActiveAccounts } from "@/services/account.service";

import type { LoanFormData } from "@/components/loans/LoanForm";
import LoanForm from "@/components/loans/LoanForm";
import LoanList from "@/components/loans/LoanList";
import LoanSummary from "@/components/loans/LoanSummary";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

type StatusFilter = LoanStatus | "all";

interface LoanListItem {
  loan: Loan;
  outstandingBalance: number;
  nextInstallment: {
    dueDate: string;
    amount: number;
    status: string;
  } | null;
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------

export default function LoansPage() {
  const { toast } = useAlert();

  // ---------------------------------------------------------------------------
  // ESTADOS
  // ---------------------------------------------------------------------------

  const [loans, setLoans] = useState<Loan[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [editingInstallments, setEditingInstallments] = useState<
    LoanInstallment[]
  >([]);

  // ---------------------------------------------------------------------------
  // CARGA DE INFORMACIÓN
  // ---------------------------------------------------------------------------

  const loadData = useCallback(() => {
    try {
      const loanData = getLoans();
      const bankData = getBanks();
      const accountData = getActiveAccounts();

      setLoans(loanData);
      setBanks(bankData);
      setAccounts(accountData);
    } catch (error) {
      console.error("Error al cargar los préstamos:", error);

      toast.error(
        "No fue posible cargar la información de los préstamos.",
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
  // MAPA DE INSTITUCIONES
  // ---------------------------------------------------------------------------

  const bankMap = useMemo(
    () => new Map(banks.map((bank) => [bank.id, bank.name])),
    [banks],
  );

  // ---------------------------------------------------------------------------
  // INFORMACIÓN DE LOS PRÉSTAMOS
  // ---------------------------------------------------------------------------

  const loanItems = useMemo<LoanListItem[]>(() => {
    return loans.map((loan) => {
      const outstandingBalance = getLoanOutstandingBalance(loan.id);

      const installments = getLoanInstallmentsWithCurrentStatus(loan.id);

      const nextInstallment =
        installments
          .filter((installment) => installment.status !== "paid")
          .sort(
            (a, b) =>
              new Date(a.dueDate).getTime() -
              new Date(b.dueDate).getTime(),
          )[0] ?? null;

      return {
        loan,
        outstandingBalance,
        nextInstallment: nextInstallment
          ? {
              dueDate: nextInstallment.dueDate,
              amount: nextInstallment.totalAmount,
              status: nextInstallment.status,
            }
          : null,
      };
    });
  }, [loans]);

  // ---------------------------------------------------------------------------
  // RESUMEN FINANCIERO
  // ---------------------------------------------------------------------------

  const summary = useMemo(() => {
    const activeLoans = loanItems.filter(
      (item) => item.loan.status === "active",
    );

    return {
      outstandingBalance: activeLoans.reduce(
        (total, item) => total + item.outstandingBalance,
        0,
      ),

      contractedAmount: activeLoans.reduce(
        (total, item) => total + item.loan.contractedAmount,
        0,
      ),

      activeLoansCount: activeLoans.length,
    };
  }, [loanItems]);

  // ---------------------------------------------------------------------------
  // BÚSQUEDA Y FILTROS
  // ---------------------------------------------------------------------------

  const filteredLoans = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es-MX");

    return loanItems.filter(({ loan }) => {
      const institutionName = bankMap.get(loan.institutionId) ?? "";

      const matchesSearch =
        !normalizedSearch ||
        loan.name.toLocaleLowerCase("es-MX").includes(normalizedSearch) ||
        institutionName
          .toLocaleLowerCase("es-MX")
          .includes(normalizedSearch) ||
        (loan.contractNumber ?? "")
          .toLocaleLowerCase("es-MX")
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || loan.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [loanItems, search, statusFilter, bankMap]);

  // ---------------------------------------------------------------------------
  // MODAL: CREAR PRÉSTAMO
  // ---------------------------------------------------------------------------

  const handleCreateLoan = () => {
    setEditingLoan(null);
    setEditingInstallments([]);
    setIsFormOpen(true);
  };

  // ---------------------------------------------------------------------------
  // MODAL: EDITAR PRÉSTAMO
  // ---------------------------------------------------------------------------

  const handleEditLoan = (loan: Loan) => {
    try {
      const installments = getLoanSchedule(loan.id);

      setEditingLoan(loan);
      setEditingInstallments(installments);
      setIsFormOpen(true);
    } catch (error) {
      console.error("Error al consultar el préstamo:", error);

      toast.error(
        "No fue posible obtener la información del préstamo.",
        "Error",
      );
    }
  };

  // ---------------------------------------------------------------------------
  // CERRAR MODAL
  // ---------------------------------------------------------------------------

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingLoan(null);
    setEditingInstallments([]);
  };

  // ---------------------------------------------------------------------------
  // CREAR / ACTUALIZAR PRÉSTAMO
  // ---------------------------------------------------------------------------

  const handleSubmitLoan = (data: LoanFormData) => {
    try {
      if (!editingLoan) {
        createLoan(data);

        toast.success(
          "El préstamo se registró correctamente.",
          "Préstamo creado",
        );
      } else {
        const existingPayments = getLoanPayments(editingLoan.id);

        const hasPaymentHistory = existingPayments.length > 0;

        if (hasPaymentHistory) {
          /*
           * Si ya existen registros de pago:
           *
           * - No enviamos amortizationOptions.
           * - No solicitamos regenerar el calendario.
           * - El servicio rechazará cualquier modificación que altere
           *   las condiciones de amortización.
           *
           * Así conservamos el historial financiero del préstamo.
           */

          const { amortizationOptions: _amortizationOptions, ...loanData } =
            data;

          updateLoan(editingLoan.id, loanData);

        } else {
          /*
           * Si todavía no existen pagos:
           *
           * Podemos actualizar las condiciones y regenerar el calendario
           * de amortización con los nuevos valores.
           */

          updateLoan(editingLoan.id, {
            ...data,
            regenerateSchedule: true,
          });
        }

        toast.success(
          "El préstamo se actualizó correctamente.",
          "Préstamo actualizado",
        );
      }

      handleCloseForm();
      loadData();
    } catch (error) {
      console.error("Error al guardar el préstamo:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el préstamo.",
        "Error al guardar",
      );

      throw error;
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* ENCABEZADO */}

      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Gestión financiera
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Préstamos
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Administra tus préstamos, consulta tus obligaciones financieras y
            lleva el control de tus pagos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateLoan}
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

          Nuevo préstamo
        </button>
      </section>

      {/* RESUMEN */}

      <LoanSummary
        outstandingBalance={summary.outstandingBalance}
        contractedAmount={summary.contractedAmount}
        activeLoansCount={summary.activeLoansCount}
      />

      {/* LISTADO */}

      <LoanList
        loans={filteredLoans}
        bankMap={bankMap}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isLoading={isLoading}
        hasRegisteredLoans={loans.length > 0}
        onCreate={handleCreateLoan}
        onEdit={handleEditLoan}
      />

      {/* MODAL DE CREACIÓN / EDICIÓN */}

      {isFormOpen && (
        <LoanForm
          banks={banks}
          accounts={accounts}
          loan={editingLoan}
          installments={editingInstallments}
          onSubmit={handleSubmitLoan}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
}