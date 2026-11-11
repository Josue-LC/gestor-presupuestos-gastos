"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { z } from "zod";

import { useAlert } from "@/context/AlertContext";

import type { Account, Bank } from "@/types/account";
import type {
  Loan,
  LoanAmortizationType,
  LoanInstallment,
  LoanInterestType,
  LoanPaymentFrequency,
  LoanType,
} from "@/types/loan.types";

import type { CreateLoanInput } from "@/services/loan.service";
import {
  calculateAmortizationSummary,
  generateLoanAmortizationSchedule,
  type ManualLoanInstallment,
  type LoanAmortizationOptions,
} from "@/services/loan-amortization.service";

export type LoanFormData = CreateLoanInput & {
  regenerateSchedule?: boolean;
};

interface LoanFormProps {
  banks: Bank[];
  accounts: Account[];
  loan?: Loan | null;
  installments?: LoanInstallment[];
  onSubmit: (data: LoanFormData) => void;
  onCancel: () => void;
}

type ManualInstallmentForm = {
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  commissionAmount: string;
  insuranceAmount: string;
};

type FormValues = {
  name: string;
  institutionId: string;
  type: LoanType;
  contractNumber: string;
  contractedAmount: string;
  principalAmount: string;
  netDisbursedAmount: string;
  openingCommission: string;
  openingInsurance: string;
  financedCharges: string;
  annualInterestRate: string;
  interestType: LoanInterestType;
  termInMonths: string;
  paymentFrequency: LoanPaymentFrequency;
  amortizationType: LoanAmortizationType;
  contractDate: string;
  disbursementDate: string;
  firstPaymentDate: string;
  endDate: string;
  receivingAccountId: string;
  paymentAccountId: string;
  notes: string;
  commissionPerInstallment: string;
  insurancePerInstallment: string;
};

const loanSchema = z.object({
  name: z.string().trim().min(1, "El nombre del préstamo es obligatorio.").max(100),
  institutionId: z.string().min(1, "Selecciona una institución financiera."),
  type: z.enum(["personal", "auto", "mortgage", "other"]),
  contractNumber: z.string(),
  contractedAmount: z.number().finite().refine(isValidMoney, "El monto contratado debe tener máximo dos decimales."),
  principalAmount: z.number().finite().positive().refine(isValidMoney, "El capital debe tener máximo dos decimales."),
  netDisbursedAmount: z.number().finite().refine(isValidMoney, "El importe neto debe tener máximo dos decimales."),
  openingCommission: z.number().finite().refine(isValidMoney, "La comisión debe tener máximo dos decimales."),
  openingInsurance: z.number().finite().refine(isValidMoney, "El seguro debe tener máximo dos decimales."),
  financedCharges: z.number().finite().refine(isValidMoney, "Los cargos financiados deben tener máximo dos decimales."),
  annualInterestRate: z.number().finite().min(0).max(1000),
  interestType: z.enum(["fixed", "variable"]),
  termInMonths: z.number().int().positive().max(1200),
  paymentFrequency: z.enum(["weekly", "biweekly", "monthly"]),
  amortizationType: z.enum(["manual", "french", "german", "custom"]),
  contractDate: z.string().refine(isValidDate, "La fecha del contrato no es válida."),
  disbursementDate: z.string().refine(isValidDate, "La fecha de disposición no es válida."),
  firstPaymentDate: z.string().refine(isValidDate, "La fecha de la primera parcialidad no es válida."),
  endDate: z.string().refine(isValidDate, "La fecha de vencimiento no es válida."),
  receivingAccountId: z.string(),
  paymentAccountId: z.string(),
  notes: z.string(),
  commissionPerInstallment: z.number().finite().refine(isValidMoney, "La comisión por parcialidad debe tener máximo dos decimales."),
  insurancePerInstallment: z.number().finite().refine(isValidMoney, "El seguro por parcialidad debe tener máximo dos decimales."),
});

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-foreground disabled:cursor-not-allowed disabled:opacity-60";

const LOAN_TYPE_OPTIONS: { value: LoanType; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "auto", label: "Automotriz" },
  { value: "mortgage", label: "Hipotecario" },
  { value: "other", label: "Otro" },
];

const FREQUENCY_OPTIONS: { value: LoanPaymentFrequency; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
];

const AMORTIZATION_OPTIONS: { value: LoanAmortizationType; label: string }[] = [
  { value: "french", label: "Francesa" },
  { value: "german", label: "Alemana" },
  { value: "custom", label: "Personalizada" },
  { value: "manual", label: "Manual" },
];

function getToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function addMonthsClamped(dateValue: string, months: number): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function getDueDate(
  firstDate: string,
  frequency: LoanPaymentFrequency,
  index: number,
): string {
  const [year, month, day] = firstDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + index * 7);
    return date.toISOString().slice(0, 10);
  }

  if (frequency === "biweekly") {
    date.setUTCDate(date.getUTCDate() + index * 14);
    return date.toISOString().slice(0, 10);
  }

  return addMonthsClamped(firstDate, index);
}

function getInstallmentCount(
  termInMonths: number,
  frequency: LoanPaymentFrequency,
): number {
  const periodsPerYear =
    frequency === "weekly" ? 52 : frequency === "biweekly" ? 26 : 12;

  return Math.ceil((termInMonths * periodsPerYear) / 12);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function distributePrincipal(principal: number, count: number): string[] {
  if (!Number.isFinite(principal) || principal <= 0 || count <= 0) return [];

  const base = Math.floor((principal / count) * 100) / 100;
  const values = Array.from({ length: count }, () => base);
  const assigned = roundMoney(base * count);
  values[count - 1] = roundMoney(values[count - 1] + principal - assigned);

  return values.map(String);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidMoney(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function toNumber(value: string): number {
  if (!value.trim()) return 0;
  return Number(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string): string {
  if (!date) return "—";

  return new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitialValues(
  loan?: Loan | null,
  installments: LoanInstallment[] = [],
): FormValues {
  const today = getToday();

  return {
    name: loan?.name ?? "",
    institutionId: loan?.institutionId ?? "",
    type: loan?.type ?? "personal",
    contractNumber: loan?.contractNumber ?? "",
    contractedAmount: String(loan?.contractedAmount ?? ""),
    principalAmount: String(loan?.principalAmount ?? ""),
    netDisbursedAmount: String(loan?.netDisbursedAmount ?? ""),
    openingCommission: String(loan?.openingCommission ?? "0"),
    openingInsurance: String(loan?.openingInsurance ?? "0"),
    financedCharges: String(loan?.financedCharges ?? "0"),
    annualInterestRate: String(loan?.annualInterestRate ?? "0"),
    interestType: loan?.interestType ?? "fixed",
    termInMonths: String(loan?.termInMonths ?? "12"),
    paymentFrequency: loan?.paymentFrequency ?? "monthly",
    amortizationType: loan?.amortizationType ?? "french",
    contractDate: loan?.contractDate ?? today,
    disbursementDate: loan?.disbursementDate ?? today,
    firstPaymentDate: loan?.firstPaymentDate ?? today,
    endDate: loan?.endDate ?? addMonthsClamped(today, 12),
    receivingAccountId: loan?.receivingAccountId ?? "",
    paymentAccountId: loan?.paymentAccountId ?? "",
    notes: loan?.notes ?? "",
    commissionPerInstallment: String(installments[0]?.commissionAmount ?? 0),
    insurancePerInstallment: String(installments[0]?.insuranceAmount ?? 0),
  };
}

function getInitialManualRows(
  loan: Loan | null | undefined,
  installments: LoanInstallment[],
  values: FormValues,
): ManualInstallmentForm[] {
  if (loan && installments.length > 0) {
    return [...installments]
      .sort((a, b) => a.installmentNumber - b.installmentNumber)
      .map((item) => ({
        dueDate: item.dueDate,
        principalAmount: String(item.principalAmount),
        interestAmount: String(item.interestAmount),
        commissionAmount: String(item.commissionAmount),
        insuranceAmount: String(item.insuranceAmount),
      }));
  }

  const count = getInstallmentCount(
    Number(values.termInMonths) || 12,
    values.paymentFrequency,
  );
  const principals = distributePrincipal(
    Number(values.principalAmount) || 0,
    count,
  );

  return Array.from({ length: count }, (_, index) => ({
    dueDate: getDueDate(values.firstPaymentDate, values.paymentFrequency, index),
    principalAmount: principals[index] ?? "0",
    interestAmount: "0",
    commissionAmount: "0",
    insuranceAmount: "0",
  }));
}

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function sameMoney(a: number, b: number): boolean {
  return roundMoney(a) === roundMoney(b);
}

function hasScheduleConfigurationChanged(args: {
  loan: Loan;
  installments: LoanInstallment[];
  values: FormValues;
  customPrincipalAmounts: string[];
  manualRows: ManualInstallmentForm[];
}): boolean {
  const { loan, installments, values, customPrincipalAmounts, manualRows } = args;

  const baseChanged =
    loan.principalAmount !== toNumber(values.principalAmount) ||
    loan.annualInterestRate !== toNumber(values.annualInterestRate) ||
    loan.interestType !== values.interestType ||
    loan.termInMonths !== Number(values.termInMonths) ||
    loan.paymentFrequency !== values.paymentFrequency ||
    loan.amortizationType !== values.amortizationType ||
    loan.firstPaymentDate !== values.firstPaymentDate;

  if (baseChanged) return true;
  if (installments.length === 0) return true;

  const ordered = [...installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber,
  );

  if (values.amortizationType === "custom") {
    const principalChanged =
      customPrincipalAmounts.length !== ordered.length ||
      customPrincipalAmounts.some(
        (amount, index) => !sameMoney(toNumber(amount), ordered[index].principalAmount),
      );
    const commission = toNumber(values.commissionPerInstallment);
    const insurance = toNumber(values.insurancePerInstallment);
    const recurringChargesChanged = ordered.some(
      (item) =>
        !sameMoney(item.commissionAmount, commission) ||
        !sameMoney(item.insuranceAmount, insurance),
    );

    return principalChanged || recurringChargesChanged;
  }

  if (values.amortizationType === "manual") {
    return (
      manualRows.length !== ordered.length ||
      manualRows.some((row, index) => {
        const current = ordered[index];
        return (
          !current ||
          row.dueDate !== current.dueDate ||
          !sameMoney(toNumber(row.principalAmount), current.principalAmount) ||
          !sameMoney(toNumber(row.interestAmount), current.interestAmount) ||
          !sameMoney(toNumber(row.commissionAmount), current.commissionAmount) ||
          !sameMoney(toNumber(row.insuranceAmount), current.insuranceAmount)
        );
      })
    );
  }

  const commission = toNumber(values.commissionPerInstallment);
  const insurance = toNumber(values.insurancePerInstallment);

  return ordered.some(
    (item) =>
      !sameMoney(item.commissionAmount, commission) ||
      !sameMoney(item.insuranceAmount, insurance),
  );
}

export default function LoanForm({
  banks,
  accounts,
  loan = null,
  installments = [],
  onSubmit,
  onCancel,
}: LoanFormProps) {
  const { toast } = useAlert();
  const isEditing = Boolean(loan);
  const [values, setValues] = useState<FormValues>(() => getInitialValues(loan, installments));
  const [customPrincipalAmounts, setCustomPrincipalAmounts] = useState<string[]>(
    () => {
      const count = getInstallmentCount(
        Number(loan?.termInMonths ?? 12),
        loan?.paymentFrequency ?? "monthly",
      );

      if (loan && installments.length > 0) {
        return [...installments]
          .sort((a, b) => a.installmentNumber - b.installmentNumber)
          .map((item) => String(item.principalAmount));
      }

      return distributePrincipal(Number(loan?.principalAmount ?? 0), count);
    },
  );
  const [manualRows, setManualRows] = useState<ManualInstallmentForm[]>(() =>
    getInitialManualRows(loan, installments, getInitialValues(loan, installments)),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const installmentCount = useMemo(
    () =>
      getInstallmentCount(
        Number(values.termInMonths) || 0,
        values.paymentFrequency,
      ),
    [values.termInMonths, values.paymentFrequency],
  );

  const updateValue = <K extends keyof FormValues>(
    key: K,
    value: FormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateScheduleBase = (
    next: Partial<Pick<FormValues, "termInMonths" | "paymentFrequency" | "firstPaymentDate" | "principalAmount">>,
  ) => {
    const nextValues = { ...values, ...next };
    const count = getInstallmentCount(
      Number(nextValues.termInMonths) || 0,
      nextValues.paymentFrequency,
    );

    setValues(nextValues);
    setCustomPrincipalAmounts(
      distributePrincipal(Number(nextValues.principalAmount) || 0, count),
    );
    setManualRows(
      Array.from({ length: count }, (_, index) => ({
        dueDate: getDueDate(
          nextValues.firstPaymentDate,
          nextValues.paymentFrequency,
          index,
        ),
        principalAmount:
          distributePrincipal(Number(nextValues.principalAmount) || 0, count)[index] ?? "0",
        interestAmount: "0",
        commissionAmount: values.commissionPerInstallment || "0",
        insuranceAmount: values.insurancePerInstallment || "0",
      })),
    );
  };

  const preview = useMemo(() => {
    try {
      const principal = toNumber(values.principalAmount);
      const term = Number(values.termInMonths);

      if (
        !values.firstPaymentDate ||
        !Number.isInteger(term) ||
        term <= 0 ||
        principal <= 0 ||
        !Number.isFinite(principal)
      ) {
        return { installments: [], summary: null, error: null };
      }

      const draftLoan: Loan = {
        id: loan?.id ?? "loan-preview",
        name: values.name || "Préstamo de prueba",
        institutionId: values.institutionId || "preview-institution",
        type: values.type,
        status: "active",
        contractNumber: values.contractNumber || null,
        contractedAmount: toNumber(values.contractedAmount),
        principalAmount: principal,
        netDisbursedAmount: toNumber(values.netDisbursedAmount),
        openingCommission: toNumber(values.openingCommission),
        openingInsurance: toNumber(values.openingInsurance),
        financedCharges: toNumber(values.financedCharges),
        annualInterestRate: toNumber(values.annualInterestRate),
        interestType: values.interestType,
        termInMonths: term,
        paymentFrequency: values.paymentFrequency,
        amortizationType: values.amortizationType,
        contractDate: values.contractDate || values.firstPaymentDate,
        disbursementDate: values.disbursementDate || values.firstPaymentDate,
        firstPaymentDate: values.firstPaymentDate,
        endDate: values.endDate || values.firstPaymentDate,
        receivingAccountId: values.receivingAccountId || null,
        paymentAccountId: values.paymentAccountId || null,
        notes: values.notes || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const options: Omit<LoanAmortizationOptions, "loan"> = {
        commissionPerInstallment: toNumber(values.commissionPerInstallment),
        insurancePerInstallment: toNumber(values.insurancePerInstallment),
        createId: (() => {
          let index = 0;
          return () => `preview-installment-${++index}`;
        })(),
      };

      if (values.amortizationType === "custom") {
        options.customPrincipalAmounts = customPrincipalAmounts.map(toNumber);
      }

      if (values.amortizationType === "manual") {
        options.manualInstallments = manualRows.map((row) => ({
          dueDate: row.dueDate,
          principalAmount: toNumber(row.principalAmount),
          interestAmount: toNumber(row.interestAmount),
          commissionAmount: toNumber(row.commissionAmount),
          insuranceAmount: toNumber(row.insuranceAmount),
        }));
      }

      const generated = generateLoanAmortizationSchedule({
        loan: draftLoan,
        ...options,
      });

      return {
        installments: generated,
        summary: calculateAmortizationSummary(generated),
        error: null,
      };
    } catch (error) {
      return {
        installments: [],
        summary: null,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible generar la vista previa.",
      };
    }
  }, [
    loan?.id,
    values,
    customPrincipalAmounts,
    manualRows,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const parsed = loanSchema.safeParse({
      ...values,
      contractedAmount: toNumber(values.contractedAmount),
      principalAmount: toNumber(values.principalAmount),
      netDisbursedAmount: toNumber(values.netDisbursedAmount),
      openingCommission: toNumber(values.openingCommission),
      openingInsurance: toNumber(values.openingInsurance),
      financedCharges: toNumber(values.financedCharges),
      annualInterestRate: toNumber(values.annualInterestRate),
      termInMonths: Number(values.termInMonths),
      commissionPerInstallment: toNumber(values.commissionPerInstallment),
      insurancePerInstallment: toNumber(values.insurancePerInstallment),
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(issue?.message ?? "Revisa los datos del préstamo.", "Datos incompletos o inválidos");
      return;
    }

    if (!banks.some((bank) => bank.id === parsed.data.institutionId)) {
      toast.error("La institución financiera seleccionada no está disponible.", "Institución inválida");
      return;
    }

    if (
      parsed.data.receivingAccountId &&
      !accounts.some((account) => account.id === parsed.data.receivingAccountId)
    ) {
      toast.error("La cuenta receptora seleccionada no está disponible.", "Cuenta inválida");
      return;
    }

    if (
      parsed.data.paymentAccountId &&
      !accounts.some((account) => account.id === parsed.data.paymentAccountId)
    ) {
      toast.error("La cuenta de pago seleccionada no está disponible.", "Cuenta inválida");
      return;
    }

    if (!preview.summary || preview.error) {
      toast.error(preview.error ?? "No se pudo generar el calendario de amortización.", "Calendario inválido");
      return;
    }

    if (values.amortizationType === "manual") {
      const invalidDate = manualRows.some((row) => !row.dueDate);
      if (invalidDate) {
        toast.error("Todas las parcialidades manuales deben tener una fecha.", "Fechas incompletas");
        return;
      }
    }

    const shouldRegenerateSchedule = loan
      ? hasScheduleConfigurationChanged({
          loan,
          installments,
          values,
          customPrincipalAmounts,
          manualRows,
        })
      : true;

    let amortizationOptions: LoanFormData["amortizationOptions"];

    if (shouldRegenerateSchedule) {
      amortizationOptions = {
        commissionPerInstallment: parsed.data.commissionPerInstallment,
        insurancePerInstallment: parsed.data.insurancePerInstallment,
      };

      if (values.amortizationType === "custom") {
        amortizationOptions.customPrincipalAmounts =
          customPrincipalAmounts.map(toNumber);
      }

      if (values.amortizationType === "manual") {
        amortizationOptions.manualInstallments = manualRows.map(
          (row): ManualLoanInstallment => ({
            dueDate: row.dueDate,
            principalAmount: toNumber(row.principalAmount),
            interestAmount: toNumber(row.interestAmount),
            commissionAmount: toNumber(row.commissionAmount),
            insuranceAmount: toNumber(row.insuranceAmount),
          }),
        );
      }
    }

    setIsSubmitting(true);

    try {
      onSubmit({
        name: parsed.data.name,
        institutionId: parsed.data.institutionId,
        type: parsed.data.type,
        contractNumber: parsed.data.contractNumber.trim() || null,
        contractedAmount: parsed.data.contractedAmount,
        principalAmount: parsed.data.principalAmount,
        netDisbursedAmount: parsed.data.netDisbursedAmount,
        openingCommission: parsed.data.openingCommission,
        openingInsurance: parsed.data.openingInsurance,
        financedCharges: parsed.data.financedCharges,
        annualInterestRate: parsed.data.annualInterestRate,
        interestType: parsed.data.interestType,
        termInMonths: parsed.data.termInMonths,
        paymentFrequency: parsed.data.paymentFrequency,
        amortizationType: parsed.data.amortizationType,
        contractDate: parsed.data.contractDate,
        disbursementDate: parsed.data.disbursementDate,
        firstPaymentDate: parsed.data.firstPaymentDate,
        endDate: parsed.data.endDate,
        receivingAccountId: parsed.data.receivingAccountId || null,
        paymentAccountId: parsed.data.paymentAccountId || null,
        notes: parsed.data.notes.trim() || null,
        ...(amortizationOptions ? { amortizationOptions } : {}),
        ...(loan ? { regenerateSchedule: shouldRegenerateSchedule } : {}),
      });
    } catch (error) {
      console.error("Error al guardar el préstamo:", error);
      toast.error(
        error instanceof Error ? error.message : "No fue posible guardar el préstamo.",
        "Error al guardar",
      );
      setIsSubmitting(false);
    }
  }

  const handleCustomPrincipalChange = (index: number, value: string) => {
    setCustomPrincipalAmounts((current) =>
      current.map((amount, currentIndex) =>
        currentIndex === index ? value : amount,
      ),
    );
  };

  const handleManualRowChange = (
    index: number,
    key: keyof ManualInstallmentForm,
    value: string,
  ) => {
    setManualRows((current) =>
      current.map((row, currentIndex) =>
        currentIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const customPrincipalTotal = roundMoney(
    customPrincipalAmounts.reduce((total, value) => total + toNumber(value), 0),
  );

  const inputDisabled = isSubmitting;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-form-title"
        className="my-auto max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Gestión financiera
            </p>
            <h2
              id="loan-form-title"
              className="mt-2 text-2xl font-bold tracking-tight text-foreground"
            >
              {isEditing ? "Editar préstamo" : "Nuevo préstamo"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isEditing
                ? "Modifica las condiciones y el calendario de tu préstamo."
                : "Registra las condiciones del préstamo y genera su calendario de pagos."}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar formulario"
            disabled={inputDisabled}
            className="rounded-full p-2 text-muted transition hover:bg-surface-card hover:text-foreground disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="m18 6-12 12M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-8">
          <Section title="Información general" description="Identifica el préstamo y la institución que lo otorgó.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre del préstamo" htmlFor="loan-name">
                <input id="loan-name" value={values.name} onChange={(e) => updateValue("name", e.target.value)} maxLength={100} placeholder="Ej. Crédito automotriz" disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Institución financiera" htmlFor="loan-institution">
                <select id="loan-institution" value={values.institutionId} onChange={(e) => updateValue("institutionId", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS}>
                  <option value="">Selecciona una institución</option>
                  {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}{!bank.isCustom ? " (Predeterminada)" : ""}</option>)}
                </select>
              </Field>
              <Field label="Tipo de préstamo" htmlFor="loan-type">
                <select id="loan-type" value={values.type} onChange={(e) => updateValue("type", e.target.value as LoanType)} disabled={inputDisabled} className={INPUT_CLASS}>
                  {LOAN_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <Field label="Número de contrato (opcional)" htmlFor="loan-contract-number">
                <input id="loan-contract-number" value={values.contractNumber} onChange={(e) => updateValue("contractNumber", e.target.value)} maxLength={100} placeholder="Ej. CR-2026-001" disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
            </div>
          </Section>

          <div className="border-t border-hairline" />

          <Section title="Importes del préstamo" description="Registra los importes tal como aparecen en el contrato. El capital es la base del calendario de amortización.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Monto contratado (MXN)" htmlFor="loan-contracted-amount">
                <input id="loan-contracted-amount" type="number" min="0" step="0.01" value={values.contractedAmount} onChange={(e) => updateValue("contractedAmount", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Capital del préstamo (MXN)" htmlFor="loan-principal-amount" hint="Importe sobre el que se calculan los intereses.">
                <input id="loan-principal-amount" type="number" min="0.01" step="0.01" value={values.principalAmount} onChange={(e) => updateScheduleBase({ principalAmount: e.target.value })} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Importe neto recibido (MXN)" htmlFor="loan-net-disbursed">
                <input id="loan-net-disbursed" type="number" min="0" step="0.01" value={values.netDisbursedAmount} onChange={(e) => updateValue("netDisbursedAmount", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Comisión de apertura (MXN)" htmlFor="loan-opening-commission">
                <input id="loan-opening-commission" type="number" min="0" step="0.01" value={values.openingCommission} onChange={(e) => updateValue("openingCommission", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Seguro de apertura (MXN)" htmlFor="loan-opening-insurance">
                <input id="loan-opening-insurance" type="number" min="0" step="0.01" value={values.openingInsurance} onChange={(e) => updateValue("openingInsurance", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Cargos financiados (MXN)" htmlFor="loan-financed-charges" hint="Cargos incorporados al financiamiento, si aplica.">
                <input id="loan-financed-charges" type="number" min="0" step="0.01" value={values.financedCharges} onChange={(e) => updateValue("financedCharges", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
            </div>
          </Section>

          <div className="border-t border-hairline" />

          <Section title="Condiciones financieras" description="Estas condiciones determinan el cálculo de las parcialidades.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Tasa de interés anual (%)" htmlFor="loan-interest-rate">
                <input id="loan-interest-rate" type="number" min="0" max="1000" step="0.0001" value={values.annualInterestRate} onChange={(e) => updateValue("annualInterestRate", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Tipo de tasa" htmlFor="loan-interest-type">
                <select id="loan-interest-type" value={values.interestType} onChange={(e) => updateValue("interestType", e.target.value as LoanInterestType)} disabled={inputDisabled} className={INPUT_CLASS}>
                  <option value="fixed">Fija</option>
                  <option value="variable">Variable</option>
                </select>
              </Field>
              <Field label="Plazo (meses)" htmlFor="loan-term">
                <input id="loan-term" type="number" min="1" max="1200" step="1" value={values.termInMonths} onChange={(e) => updateScheduleBase({ termInMonths: e.target.value })} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Frecuencia de pago" htmlFor="loan-frequency">
                <select id="loan-frequency" value={values.paymentFrequency} onChange={(e) => updateScheduleBase({ paymentFrequency: e.target.value as LoanPaymentFrequency })} disabled={inputDisabled} className={INPUT_CLASS}>
                  {FREQUENCY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <Field label="Tipo de amortización" htmlFor="loan-amortization">
                <select id="loan-amortization" value={values.amortizationType} onChange={(e) => updateValue("amortizationType", e.target.value as LoanAmortizationType)} disabled={inputDisabled} className={INPUT_CLASS}>
                  {AMORTIZATION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <div className="rounded-xl bg-surface-card p-3">
                <p className="text-xs text-muted">Parcialidades estimadas</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{installmentCount.toLocaleString("es-MX")}</p>
              </div>
            </div>

            {values.interestType === "variable" && (
              <p className="rounded-xl border border-hairline bg-surface-card px-4 py-3 text-xs leading-5 text-muted">
                La tasa variable se registra con su valor vigente. El calendario actual utiliza esa tasa como referencia para todas las parcialidades; todavía no contempla ajustes futuros.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Comisión por parcialidad (MXN)" htmlFor="loan-recurring-commission">
                <input id="loan-recurring-commission" type="number" min="0" step="0.01" value={values.commissionPerInstallment} onChange={(e) => { updateValue("commissionPerInstallment", e.target.value); if (values.amortizationType === "manual") setManualRows((rows) => rows.map((row) => ({ ...row, commissionAmount: e.target.value }))); }} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Seguro por parcialidad (MXN)" htmlFor="loan-recurring-insurance">
                <input id="loan-recurring-insurance" type="number" min="0" step="0.01" value={values.insurancePerInstallment} onChange={(e) => { updateValue("insurancePerInstallment", e.target.value); if (values.amortizationType === "manual") setManualRows((rows) => rows.map((row) => ({ ...row, insuranceAmount: e.target.value }))); }} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
            </div>
          </Section>

          <div className="border-t border-hairline" />

          <Section title="Fechas" description="Define cuándo se formalizó y dispuso el préstamo, y cuándo comienza su calendario de pagos.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Fecha de contratación" htmlFor="loan-contract-date">
                <input id="loan-contract-date" type="date" value={values.contractDate} onChange={(e) => updateValue("contractDate", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Fecha de disposición" htmlFor="loan-disbursement-date">
                <input id="loan-disbursement-date" type="date" value={values.disbursementDate} onChange={(e) => updateValue("disbursementDate", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Primera parcialidad" htmlFor="loan-first-payment-date">
                <input id="loan-first-payment-date" type="date" value={values.firstPaymentDate} onChange={(e) => updateScheduleBase({ firstPaymentDate: e.target.value })} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
              <Field label="Fecha de vencimiento" htmlFor="loan-end-date">
                <input id="loan-end-date" type="date" value={values.endDate} onChange={(e) => updateValue("endDate", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
              </Field>
            </div>
          </Section>

          <div className="border-t border-hairline" />

          <Section title="Cuentas vinculadas" description="Estas cuentas se utilizarán como referencia para la disposición y el pago del préstamo.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Cuenta receptora" htmlFor="loan-receiving-account" hint="Cuenta donde recibiste el dinero del préstamo.">
                <select id="loan-receiving-account" value={values.receivingAccountId} onChange={(e) => updateValue("receivingAccountId", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS}>
                  <option value="">Sin cuenta vinculada</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Cuenta predeterminada para pagos" htmlFor="loan-payment-account" hint="Se propondrá como cuenta de origen al registrar un pago.">
                <select id="loan-payment-account" value={values.paymentAccountId} onChange={(e) => updateValue("paymentAccountId", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS}>
                  <option value="">Seleccionar al realizar cada pago</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {values.amortizationType === "custom" && (
            <>
              <div className="border-t border-hairline" />
              <Section title="Capital personalizado por parcialidad" description="Distribuye el capital entre las parcialidades. La suma debe coincidir exactamente con el capital del préstamo.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {customPrincipalAmounts.map((amount, index) => (
                    <Field key={index} label={`Parcialidad ${index + 1} · ${formatDate(getDueDate(values.firstPaymentDate, values.paymentFrequency, index))}`} htmlFor={`custom-principal-${index}`}>
                      <input id={`custom-principal-${index}`} type="number" min="0" step="0.01" value={amount} onChange={(e) => handleCustomPrincipalChange(index, e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
                    </Field>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-card px-4 py-3 text-sm">
                  <span className="text-muted">Capital distribuido</span>
                  <span className={`font-semibold tabular-nums ${Math.abs(customPrincipalTotal - toNumber(values.principalAmount)) < 0.005 ? "text-foreground" : "text-error"}`}>
                    {formatCurrency(customPrincipalTotal)} / {formatCurrency(toNumber(values.principalAmount))}
                  </span>
                </div>
              </Section>
            </>
          )}

          {values.amortizationType === "manual" && (
            <>
              <div className="border-t border-hairline" />
              <Section title="Parcialidades manuales" description="Define la fecha y los componentes de cada parcialidad. El capital de todas las filas debe sumar el capital del préstamo.">
                <div className="space-y-3">
                  {manualRows.map((row, index) => (
                    <div key={index} className="rounded-2xl border border-hairline p-3 sm:p-4">
                      <p className="mb-3 text-sm font-semibold text-foreground">Parcialidad {index + 1}</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <Field label="Vencimiento" htmlFor={`manual-date-${index}`}>
                          <input id={`manual-date-${index}`} type="date" value={row.dueDate} onChange={(e) => handleManualRowChange(index, "dueDate", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
                        </Field>
                        <Field label="Capital" htmlFor={`manual-principal-${index}`}>
                          <input id={`manual-principal-${index}`} type="number" min="0" step="0.01" value={row.principalAmount} onChange={(e) => handleManualRowChange(index, "principalAmount", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
                        </Field>
                        <Field label="Intereses" htmlFor={`manual-interest-${index}`}>
                          <input id={`manual-interest-${index}`} type="number" min="0" step="0.01" value={row.interestAmount} onChange={(e) => handleManualRowChange(index, "interestAmount", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
                        </Field>
                        <Field label="Comisión" htmlFor={`manual-commission-${index}`}>
                          <input id={`manual-commission-${index}`} type="number" min="0" step="0.01" value={row.commissionAmount} onChange={(e) => handleManualRowChange(index, "commissionAmount", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
                        </Field>
                        <Field label="Seguro" htmlFor={`manual-insurance-${index}`}>
                          <input id={`manual-insurance-${index}`} type="number" min="0" step="0.01" value={row.insuranceAmount} onChange={(e) => handleManualRowChange(index, "insuranceAmount", e.target.value)} disabled={inputDisabled} className={INPUT_CLASS} />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          <div className="border-t border-hairline" />

          <Section title="Notas" description="Agrega referencias o condiciones adicionales del contrato.">
            <Field label="Notas (opcional)" htmlFor="loan-notes">
              <textarea id="loan-notes" rows={3} value={values.notes} onChange={(e) => updateValue("notes", e.target.value)} maxLength={2000} placeholder="Información adicional del préstamo..." disabled={inputDisabled} className={`${INPUT_CLASS} resize-y`} />
            </Field>
          </Section>

          <div className="border-t border-hairline" />

          <Section title="Vista previa del calendario" description="Esta estimación se genera con el mismo servicio que guardará las parcialidades.">
            {preview.error ? (
              <div className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
                {preview.error}
              </div>
            ) : preview.summary ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Parcialidades", String(preview.summary.installmentCount)],
                    ["Capital", formatCurrency(preview.summary.totalPrincipal)],
                    ["Intereses", formatCurrency(preview.summary.totalInterest)],
                    ["Comisiones", formatCurrency(preview.summary.totalCommissions)],
                    ["Seguros", formatCurrency(preview.summary.totalInsurance)],
                    ["Total a pagar", formatCurrency(preview.summary.totalToPay)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-surface-card p-3">
                      <p className="text-xs text-muted">{label}</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="max-h-64 overflow-auto rounded-xl border border-hairline">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="sticky top-0 bg-surface-card text-xs text-muted">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">#</th>
                        <th className="px-3 py-2.5 font-semibold">Vencimiento</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Capital</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Intereses</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Cargos</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {preview.installments.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2.5 text-muted">{item.installmentNumber}</td>
                          <td className="px-3 py-2.5 text-foreground">{formatDate(item.dueDate)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(item.principalAmount)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(item.interestAmount)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(item.commissionAmount + item.insuranceAmount)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(item.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="rounded-xl bg-surface-card px-4 py-3 text-sm text-muted">
                Ingresa el capital, el plazo y la fecha de la primera parcialidad para generar la vista previa.
              </p>
            )}
          </Section>

          <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} disabled={inputDisabled} className="rounded-full border border-hairline px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={inputDisabled || !preview.summary || Boolean(preview.error)} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar préstamo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
