"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import type { Loan, LoanInstallment, LoanPayment } from "@/types/loan.types";
import type { Bank, Account } from "@/types/account";

import { getLoanById } from "@/services/loan.service";
import {
  getLoanOutstandingBalance,
  getLoanInstallmentsWithCurrentStatus,
  getLoanPayments,
} from "@/services/loan-payment.service";
import { getBanks } from "@/services/bank.service";
import { getActiveAccounts } from "@/services/account.service";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDate = (value: string) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
};

const loanTypeLabels: Record<string, string> = {
  personal: "Personal",
  auto: "Automotriz",
  mortgage: "Hipotecario",
  other: "Otro",
};

const installmentStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagada",
  overdue: "Vencida",
};

const paymentStatusLabels: Record<string, string> = {
  completed: "Completado",
  cancelled: "Cancelado",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600",
    paid: "bg-blue-500/10 text-blue-600",
    cancelled: "bg-red-500/10 text-red-600",
    pending: "bg-amber-500/10 text-amber-600",
    partial: "bg-blue-500/10 text-blue-600",
    overdue: "bg-red-500/10 text-red-600",
    completed: "bg-emerald-500/10 text-emerald-600",
  };

  const labels: Record<string, string> = {
    active: "Activo",
    paid: "Liquidado",
    cancelled: "Cancelado",
    pending: "Pendiente",
    partial: "Parcial",
    overdue: "Vencida",
    completed: "Completado",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-muted/10 text-muted"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const loanId = params.id;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const loanData = getLoanById(loanId);

      if (!loanData) {
        setLoan(null);
        setError("No encontramos el préstamo solicitado.");
        return;
      }

      const scheduleData = getLoanInstallmentsWithCurrentStatus(loanId);

      const paymentData = getLoanPayments(loanId);
      const bankData = getBanks();
      const accountData = getActiveAccounts();
      const balance = getLoanOutstandingBalance(loanId);

      setLoan(loanData);
      setInstallments(scheduleData);
      setPayments(paymentData);
      setBanks(bankData);
      setAccounts(accountData);
      setOutstandingBalance(balance);
    } catch (err) {
      console.error("Error al cargar el detalle del préstamo:", err);
      setError("Ocurrió un error al cargar la información del préstamo.");
    } finally {
      setIsLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Cargando información del préstamo...
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-7 w-7"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-foreground">
          No se pudo cargar el préstamo
        </h2>

        <p className="mt-2 max-w-sm text-sm text-muted">
          {error ?? "El préstamo solicitado no existe."}
        </p>

        <button
          type="button"
          onClick={() => router.push("/loans")}
          className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Volver a préstamos
        </button>
      </div>
    );
  }

  const bank = banks.find((item) => item.id === loan.institutionId);

  const receivingAccount = accounts.find(
    (account) => account.id === loan.receivingAccountId,
  );

  const paymentAccount = accounts.find(
    (account) => account.id === loan.paymentAccountId,
  );

  const paidInstallments = installments.filter(
    (item) => item.status === "paid",
  ).length;

  const pendingInstallments = installments.filter(
    (item) => item.status === "pending",
  ).length;

  const partialInstallments = installments.filter(
    (item) => item.status === "partial",
  ).length;

  const overdueInstallments = installments.filter(
    (item) => item.status === "overdue",
  ).length;

  const nextInstallment = installments.find(
    (item) =>
      item.status === "pending" ||
      item.status === "partial" ||
      item.status === "overdue",
  );

  const completedPayments = payments.filter(
    (payment) => payment.status === "completed",
  );

  const totalPaid = installments.reduce((total, installment) => {
    if (installment.status === "paid") {
      return total + installment.totalAmount;
    }

    return total;
  }, 0);

  const progress =
    loan.contractedAmount > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((loan.contractedAmount - outstandingBalance) /
              loan.contractedAmount) *
              100,
          ),
        )
      : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push("/loans")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Volver a préstamos
        </button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {loan.name}
              </h1>
              <StatusBadge status={loan.status} />
            </div>

            <p className="text-sm text-muted">
              {bank?.name ?? "Institución no disponible"} ·{" "}
              {loanTypeLabels[loan.type] ?? "Otro"}
            </p>

            {loan.contractNumber && (
              <p className="mt-1 text-xs text-muted">
                Contrato: {loan.contractNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Saldo pendiente"
          value={formatCurrency(outstandingBalance)}
          description="Monto restante por pagar"
        />

        <MetricCard
          label="Monto contratado"
          value={formatCurrency(loan.contractedAmount)}
          description="Monto total del contrato"
        />

        <MetricCard
          label="Total pagado"
          value={formatCurrency(totalPaid)}
          description="Capital, intereses y conceptos de parcialidades liquidadas"
        />

        <MetricCard
          label="Tasa de interés anual"
          value={`${loan.annualInterestRate}%`}
          description={
            loan.interestType === "fixed" ? "Tasa fija" : "Tasa variable"
          }
        />
      </section>

      {/* Progress */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-foreground">
              Progreso de liquidación
            </h2>
            <p className="mt-1 text-sm text-muted">
              Avance calculado con base en el saldo pendiente.
            </p>
          </div>

          <span className="text-2xl font-bold text-foreground">
            {progress.toFixed(1)}%
          </span>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted/15">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex justify-between text-xs text-muted">
          <span>Pagado</span>
          <span>Pendiente</span>
        </div>
      </section>

      {/* Installment summary */}
      <section>
        <SectionTitle
          title="Resumen de parcialidades"
          description="Estado actual del calendario de amortización."
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Pagadas" value={paidInstallments} />
          <MetricCard label="Pendientes" value={pendingInstallments} />
          <MetricCard label="Parciales" value={partialInstallments} />
          <MetricCard label="Vencidas" value={overdueInstallments} />
        </div>
      </section>

      {/* Next installment */}
      {nextInstallment && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-muted">
                Próxima parcialidad por atender
              </p>

              <h3 className="mt-2 text-xl font-bold text-foreground">
                Parcialidad #{nextInstallment.installmentNumber}
              </h3>

              <p className="mt-1 text-sm text-muted">
                Vencimiento: {formatDate(nextInstallment.dueDate)}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(nextInstallment.totalAmount)}
              </p>
              <div className="mt-2">
                <StatusBadge status={nextInstallment.status} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Loan information */}
      <section>
        <SectionTitle
          title="Información del préstamo"
          description="Datos generales y condiciones del contrato."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Monto principal"
            value={formatCurrency(loan.principalAmount)}
          />

          <MetricCard
            label="Monto neto recibido"
            value={formatCurrency(loan.netDisbursedAmount)}
          />

          <MetricCard label="Plazo" value={`${loan.termInMonths} meses`} />

          <MetricCard
            label="Fecha de contratación"
            value={formatDate(loan.contractDate)}
          />

          <MetricCard
            label="Fecha de disposición"
            value={formatDate(loan.disbursementDate)}
          />

          <MetricCard
            label="Primera parcialidad"
            value={formatDate(loan.firstPaymentDate)}
          />

          <MetricCard
            label="Fecha de vencimiento"
            value={formatDate(loan.endDate)}
          />

          <MetricCard
            label="Frecuencia de pago"
            value={
              {
                weekly: "Semanal",
                biweekly: "Quincenal",
                monthly: "Mensual",
              }[loan.paymentFrequency]
            }
          />

          <MetricCard
            label="Tipo de amortización"
            value={
              {
                manual: "Manual",
                french: "Francés",
                german: "Alemán",
                custom: "Personalizado",
              }[loan.amortizationType]
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <MetricCard
            label="Cuenta receptora"
            value={receivingAccount?.name ?? "No especificada"}
          />

          <MetricCard
            label="Cuenta de pago"
            value={paymentAccount?.name ?? "No especificada"}
          />
        </div>

        {loan.notes && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Notas</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
              {loan.notes}
            </p>
          </div>
        )}
      </section>

      {/* Amortization schedule */}
      <section>
        <SectionTitle
          title="Calendario de amortización"
          description={`${installments.length} parcialidades registradas en el calendario.`}
        />

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {installments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              Este préstamo no tiene parcialidades registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border bg-muted/5">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-4">Parcialidad</th>
                    <th className="px-5 py-4">Vencimiento</th>
                    <th className="px-5 py-4 text-right">Capital</th>
                    <th className="px-5 py-4 text-right">Intereses</th>
                    <th className="px-5 py-4 text-right">Comisión</th>
                    <th className="px-5 py-4 text-right">Seguro</th>
                    <th className="px-5 py-4 text-right">Total</th>
                    <th className="px-5 py-4">Estado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {installments.map((installment) => (
                    <tr
                      key={installment.id}
                      className="transition hover:bg-muted/5"
                    >
                      <td className="px-5 py-4 font-medium text-foreground">
                        #{installment.installmentNumber}
                      </td>

                      <td className="px-5 py-4 text-muted">
                        {formatDate(installment.dueDate)}
                      </td>

                      <td className="px-5 py-4 text-right text-foreground">
                        {formatCurrency(installment.principalAmount)}
                      </td>

                      <td className="px-5 py-4 text-right text-foreground">
                        {formatCurrency(installment.interestAmount)}
                      </td>

                      <td className="px-5 py-4 text-right text-foreground">
                        {formatCurrency(installment.commissionAmount)}
                      </td>

                      <td className="px-5 py-4 text-right text-foreground">
                        {formatCurrency(installment.insuranceAmount)}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-foreground">
                        {formatCurrency(installment.totalAmount)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={installment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Payment history */}
      <section>
        <SectionTitle
          title="Historial de pagos"
          description="Movimientos registrados para este préstamo."
        />

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {payments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-foreground">
                Todavía no hay pagos registrados
              </p>
              <p className="mt-1 text-sm text-muted">
                Aquí aparecerán los pagos que realices a este préstamo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-border bg-muted/5">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-4">Fecha</th>
                    <th className="px-5 py-4">Cuenta</th>
                    <th className="px-5 py-4">Método</th>
                    <th className="px-5 py-4 text-right">Importe</th>
                    <th className="px-5 py-4">Estado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {payments.map((payment) => {
                    const sourceAccount = accounts.find(
                      (account) => account.id === payment.sourceAccountId,
                    );

                    return (
                      <tr
                        key={payment.id}
                        className="transition hover:bg-muted/5"
                      >
                        <td className="px-5 py-4 text-foreground">
                          {formatDate(payment.paidAt)}
                        </td>

                        <td className="px-5 py-4 text-muted">
                          {sourceAccount?.name ?? "Cuenta no disponible"}
                        </td>

                        <td className="px-5 py-4 text-muted">
                          {payment.method === "transaction"
                            ? "Transacción"
                            : "Manual"}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-foreground">
                          {formatCurrency(payment.amount)}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={payment.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
