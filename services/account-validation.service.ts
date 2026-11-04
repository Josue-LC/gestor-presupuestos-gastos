
import type {
  Account,
  BankCard,
  CardPurchase,
  Installment,
  InstallmentPlan,
  InstallmentPayment,
} from "@/types/account";

import type { Transaction } from "@/components/transactions/TransactionList";

import { loadAccountStorage } from "@/services/account-storage.service";
import { loadTransactionStorage } from "@/services/transaction-storage.service";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AccountValidationData {
  name: string;
  bankId: string | null;
  type: Account["type"];
  openingBalance: number;
  openingDate: string;
}

export interface CardValidationData {
  name: string;
  bankId: string;
  type: BankCard["type"];
  linkedAccountId: string | null;
  paymentAccountId: string | null;
  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDueDay: number | null;
}

export interface CardPurchaseValidationData {
  cardId: string;
  description: string;
  category: string;
  amount: number;
  purchaseDate: string;
  purchaseType: CardPurchase["purchaseType"];
  installmentCount: number | null;
  firstDueDate: string | null;
}

export interface InstallmentPlanValidationData {
  purchaseId: string;
}

export interface InstallmentPaymentValidationData {
  installmentId: string;
  amount: number;
  paidAt: string;
  method: InstallmentPayment["method"];
  transactionId?: string | null;
}

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function createResult(errors: string[]): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidMoney(
  value: number,
  allowZero = false,
): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }

  if (allowZero ? value < 0 : value <= 0) {
    return false;
  }

  return (
    Math.abs(value * 100 - Math.round(value * 100)) <
    0.000001
  );
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidDay(value: number | null): boolean {
  return (
    value !== null &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 31
  );
}

function getTransferAccounts(account: string): string[] {
  return account.split(" → ").map((value) => value.trim());
}

function getRemainingInstallmentAmount(
  installment: Installment,
): number {
  return roundMoney(
    installment.amount - installment.paidAmount,
  );
}

function getTransactionUsedAmount(
  transactionId: string,
): number {
  const storage = loadAccountStorage();

  if (!storage) {
    return 0;
  }

  return roundMoney(
    storage.installments.reduce(
      (total, installment) =>
        total +
        (installment.payments ?? [])
          .filter(
            (payment) => payment.transactionId === transactionId,
          )
          .reduce(
            (sum, payment) => sum + payment.amount,
            0,
          ),
      0,
    ),
  );
}

function getTransactionById(
  transactionId: string,
): Transaction | undefined {
  const storage = loadTransactionStorage();

  return storage?.transactions.find(
    (transaction) => transaction.id === transactionId,
  );
}

function getExpectedInstallmentStatus(
  amount: number,
  paidAmount: number,
): Installment["status"] {
  if (paidAmount >= amount) {
    return "paid";
  }

  if (paidAmount > 0) {
    return "partial";
  }

  return "pending";
}

function getInstallmentPaymentsTotal(
  installment: Installment,
): number {
  return roundMoney(
    (installment.payments ?? []).reduce(
      (total, payment) => total + payment.amount,
      0,
    ),
  );
}

function getPlanInstallments(
  planId: string,
): Installment[] {
  const storage = loadAccountStorage();

  if (!storage) {
    return [];
  }

  return storage.installments
    .filter((item) => item.planId === planId)
    .sort(
      (a, b) => a.installmentNumber - b.installmentNumber,
    );
}

function getPlanPaidAmount(
  planId: string,
): number {
  return roundMoney(
    getPlanInstallments(planId).reduce(
      (total, installment) => total + installment.paidAmount,
      0,
    ),
  );
}

function getExpectedInstallmentAmounts(
  totalAmount: number,
  installmentCount: number,
): number[] {
  const totalCents = Math.round(totalAmount * 100);
  const baseAmount = Math.floor(totalCents / installmentCount);
  const remainder = totalCents % installmentCount;

  return Array.from(
    { length: installmentCount },
    (_, index) =>
      (baseAmount + (index < remainder ? 1 : 0)) / 100,
  );
}

function addMonthsClamped(
  date: string,
  months: number,
): string {
  const [year, month, day] = date.split("-").map(Number);

  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;

  const lastDayOfMonth = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();

  return [
    targetYear,
    String(normalizedMonth + 1).padStart(2, "0"),
    String(Math.min(day, lastDayOfMonth)).padStart(2, "0"),
  ].join("-");
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE CUENTAS
// -----------------------------------------------------------------------------

export function validateAccount(
  data: AccountValidationData,
  accountId?: string,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  if (!data.name.trim()) {
    errors.push("El nombre de la cuenta es obligatorio.");
  }

  if (
    !["checking", "savings", "cash", "investment", "other"].includes(
      data.type,
    )
  ) {
    errors.push("El tipo de cuenta no es válido.");
  }

  if (
    !Number.isFinite(data.openingBalance) ||
    !isValidMoney(Math.abs(data.openingBalance), true)
  ) {
    errors.push(
      "El saldo inicial debe ser un importe válido con máximo dos decimales.",
    );
  }

  if (!isValidDate(data.openingDate)) {
    errors.push("La fecha de apertura no es válida.");
  }

  if (data.bankId !== null) {
    const bankExists = storage.banks.some(
      (bank) => bank.id === data.bankId,
    );

    if (!bankExists) {
      errors.push(
        "La institución bancaria seleccionada no existe.",
      );
    }
  }

  const duplicatedName = storage.accounts.some(
    (account) =>
      account.id !== accountId &&
      account.status === "active" &&
      account.name.trim().toLowerCase() ===
        data.name.trim().toLowerCase(),
  );

  if (duplicatedName) {
    errors.push(
      "Ya existe una cuenta activa con ese nombre.",
    );
  }

  return createResult(errors);
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE TARJETAS
// -----------------------------------------------------------------------------

export function validateCard(
  data: CardValidationData,
  cardId?: string,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  if (!data.name.trim()) {
    errors.push("El nombre de la tarjeta es obligatorio.");
  }

  if (!data.bankId) {
    errors.push(
      "Debes seleccionar una institución bancaria.",
    );
  } else if (
    !storage.banks.some((bank) => bank.id === data.bankId)
  ) {
    errors.push(
      "La institución bancaria seleccionada no existe.",
    );
  }

  const duplicatedName = storage.cards.some(
    (card) =>
      card.id !== cardId &&
      card.status === "active" &&
      card.bankId === data.bankId &&
      card.name.trim().toLowerCase() ===
        data.name.trim().toLowerCase(),
  );

  if (duplicatedName) {
    errors.push(
      "Ya existe una tarjeta activa con ese nombre en esta institución.",
    );
  }

  if (data.type === "debit") {
    if (!data.linkedAccountId) {
      errors.push(
        "La tarjeta de débito debe estar vinculada a una cuenta bancaria.",
      );
    } else {
      const account = storage.accounts.find(
        (item) => item.id === data.linkedAccountId,
      );

      if (!account || account.status !== "active") {
        errors.push(
          "La cuenta vinculada no existe o está archivada.",
        );
      }
    }

    if (data.paymentAccountId !== null) {
      errors.push(
        "Una tarjeta de débito no debe tener una cuenta de pago configurada.",
      );
    }

    if (data.creditLimit !== null) {
      errors.push(
        "Una tarjeta de débito no debe tener límite de crédito.",
      );
    }

    if (
      data.cutoffDay !== null ||
      data.paymentDueDay !== null
    ) {
      errors.push(
        "Una tarjeta de débito no debe tener fechas de corte o pago.",
      );
    }
  } else if (data.type === "credit") {
    if (data.linkedAccountId !== null) {
      errors.push(
        "Una tarjeta de crédito no debe utilizar una cuenta vinculada de débito.",
      );
    }

    if (data.paymentAccountId !== null) {
      const account = storage.accounts.find(
        (item) => item.id === data.paymentAccountId,
      );

      if (!account || account.status !== "active") {
        errors.push(
          "La cuenta de pago no existe o está archivada.",
        );
      }
    }

    if (
      data.creditLimit !== null &&
      !isValidMoney(data.creditLimit)
    ) {
      errors.push(
        "El límite de crédito debe ser mayor a cero y tener máximo dos decimales.",
      );
    }

    if (!isValidDay(data.cutoffDay)) {
      errors.push(
        "El día de corte debe estar entre 1 y 31.",
      );
    }

    if (!isValidDay(data.paymentDueDay)) {
      errors.push(
        "El día límite de pago debe estar entre 1 y 31.",
      );
    }
  } else {
    errors.push("El tipo de tarjeta no es válido.");
  }

  return createResult(errors);
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE COMPRAS CON TARJETA
// -----------------------------------------------------------------------------

export function validateCardPurchase(
  data: CardPurchaseValidationData,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  const card = storage.cards.find(
    (item) => item.id === data.cardId,
  );

  if (!card || card.status !== "active") {
    errors.push(
      "La tarjeta seleccionada no existe o está archivada.",
    );
  }

  if (!data.description.trim()) {
    errors.push("La descripción de la compra es obligatoria.");
  }

  if (!data.category.trim()) {
    errors.push("Debes seleccionar una categoría.");
  }

  if (!isValidMoney(data.amount)) {
    errors.push(
      "El importe de la compra debe ser mayor a cero y tener máximo dos decimales.",
    );
  }

  if (!isValidDate(data.purchaseDate)) {
    errors.push("La fecha de compra no es válida.");
  }

  if (card?.type === "debit") {
    if (!card.linkedAccountId) {
      errors.push(
        "La tarjeta de débito no tiene una cuenta bancaria vinculada.",
      );
    } else {
      const account = storage.accounts.find(
        (item) => item.id === card.linkedAccountId,
      );

      if (!account || account.status !== "active") {
        errors.push(
          "La cuenta bancaria vinculada a la tarjeta no está disponible.",
        );
      }
    }
  }

  if (data.purchaseType === "installments") {
    if (card && card.type !== "credit") {
      errors.push(
        "Las compras a MSI solamente pueden registrarse con tarjetas de crédito.",
      );
    }

    if (
      !Number.isInteger(data.installmentCount) ||
      (data.installmentCount ?? 0) < 2
    ) {
      errors.push(
        "Una compra MSI debe tener al menos dos parcialidades.",
      );
    }

    if (
      !data.firstDueDate ||
      !isValidDate(data.firstDueDate)
    ) {
      errors.push(
        "Debes indicar una fecha válida para la primera parcialidad.",
      );
    } else if (
      isValidDate(data.purchaseDate) &&
      data.firstDueDate < data.purchaseDate
    ) {
      errors.push(
        "La primera parcialidad no puede vencer antes de la compra.",
      );
    }
  } else if (data.purchaseType === "single") {
    if (data.installmentCount !== null) {
      errors.push(
        "Una compra de contado no debe tener número de parcialidades.",
      );
    }

    if (data.firstDueDate !== null) {
      errors.push(
        "Una compra de contado no debe tener fecha de primera parcialidad.",
      );
    }
  } else {
    errors.push("El tipo de compra no es válido.");
  }

  return createResult(errors);
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE PLANES MSI
// -----------------------------------------------------------------------------

export function validateInstallmentPlan(
  data: InstallmentPlanValidationData,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  const purchase = storage.purchases.find(
    (item) => item.id === data.purchaseId,
  );

  if (!purchase) {
    errors.push(
      "No se encontró la compra asociada al plan.",
    );

    return createResult(errors);
  }

  if (purchase.status !== "active") {
    errors.push(
      "No se puede generar un plan para una compra cancelada.",
    );
  }

  if (purchase.purchaseType !== "installments") {
    errors.push("La compra no está registrada como MSI.");
  }

  if (purchase.installmentPlanId !== null) {
    errors.push(
      "La compra ya tiene un plan de parcialidades asociado.",
    );
  }

  const existingPlan = storage.installmentPlans.some(
    (plan) => plan.cardPurchaseId === purchase.id,
  );

  if (existingPlan) {
    errors.push(
      "Ya existe un plan de parcialidades asociado a esta compra.",
    );
  }

  if (
    purchase.installmentCount === null ||
    !Number.isInteger(purchase.installmentCount) ||
    purchase.installmentCount < 2
  ) {
    errors.push(
      "La compra MSI debe tener al menos dos parcialidades configuradas.",
    );
  }

  if (
    !purchase.firstDueDate ||
    !isValidDate(purchase.firstDueDate)
  ) {
    errors.push(
      "La compra MSI debe tener una fecha válida para la primera parcialidad.",
    );
  } else if (
    isValidDate(purchase.purchaseDate) &&
    purchase.firstDueDate < purchase.purchaseDate
  ) {
    errors.push(
      "La primera parcialidad no puede vencer antes de la compra.",
    );
  }

  const card = storage.cards.find(
    (item) => item.id === purchase.cardId,
  );

  if (!card || card.status !== "active") {
    errors.push(
      "La tarjeta asociada a la compra no existe o está archivada.",
    );
  } else if (card.type !== "credit") {
    errors.push(
      "Un plan MSI requiere una tarjeta de crédito.",
    );
  }

  if (!isValidMoney(purchase.amount)) {
    errors.push(
      "El importe de la compra MSI no es válido.",
    );
  }

  return createResult(errors);
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE PAGOS MSI
// -----------------------------------------------------------------------------

export function validateInstallmentPayment(
  data: InstallmentPaymentValidationData,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  const installment = storage.installments.find(
    (item) => item.id === data.installmentId,
  );

  if (!installment) {
    return createResult([
      "No se encontró la parcialidad indicada.",
    ]);
  }

  const plan = storage.installmentPlans.find(
    (item) => item.id === installment.planId,
  );

  if (!plan || plan.status !== "active") {
    errors.push(
      "El plan de parcialidades no está activo.",
    );
  }

  if (!isValidMoney(data.amount)) {
    errors.push(
      "El importe del pago debe ser mayor a cero y tener máximo dos decimales.",
    );
  }

  if (!isValidDate(data.paidAt)) {
    errors.push("La fecha del pago no es válida.");
  }

  const remainingAmount =
    getRemainingInstallmentAmount(installment);

  if (
    !Number.isFinite(installment.paidAmount) ||
    installment.paidAmount < 0 ||
    installment.paidAmount > installment.amount
  ) {
    errors.push(
      "El importe abonado de la parcialidad no es válido.",
    );
  }

  if (
    getInstallmentPaymentsTotal(installment) !==
    roundMoney(installment.paidAmount)
  ) {
    errors.push(
      "El importe abonado no coincide con el historial de pagos.",
    );
  }

  if (
    data.amount > 0 &&
    data.amount > remainingAmount
  ) {
    errors.push(
      "El importe supera el saldo pendiente de la parcialidad.",
    );
  }

  if (
    installment.status !==
    getExpectedInstallmentStatus(
      installment.amount,
      installment.paidAmount,
    )
  ) {
    errors.push(
      "El estado de la parcialidad no coincide con su importe pagado.",
    );
  }

  if (data.method === "manual") {
    if (data.transactionId) {
      errors.push(
        "Un pago manual no debe tener una transacción vinculada.",
      );
    }
  } else if (data.method === "transaction") {
    if (!data.transactionId) {
      errors.push(
        "Debes seleccionar una transacción para este pago.",
      );
    } else {
      const transaction = getTransactionById(
        data.transactionId,
      );

      if (!transaction) {
        errors.push(
          "No se encontró la transacción seleccionada.",
        );
      } else {
        if (transaction.status === "cancelled") {
          errors.push(
            "No se puede utilizar una transacción cancelada.",
          );
        }

        if (transaction.type !== "transfer") {
          errors.push(
            "El pago debe vincularse a una transferencia.",
          );
        }

        const purchase = plan
          ? storage.purchases.find(
              (item) => item.id === plan.cardPurchaseId,
            )
          : undefined;

        if (!purchase) {
          errors.push(
            "No se encontró la compra asociada a la parcialidad.",
          );
        } else {
          const card = storage.cards.find(
            (item) => item.id === purchase.cardId,
          );

          if (
            !card ||
            card.status !== "active" ||
            card.type !== "credit"
          ) {
            errors.push(
              "La tarjeta de crédito asociada no está disponible.",
            );
          } else {
            const transferAccounts = getTransferAccounts(
              transaction.account,
            );

            if (
              transferAccounts.length !== 2 ||
              !transferAccounts[0] ||
              !transferAccounts[1]
            ) {
              errors.push(
                "La transferencia no tiene cuentas de origen y destino válidas.",
              );
            } else {
              const [sourceAccountId, destinationAccountId] =
                transferAccounts;

              if (
                destinationAccountId !== `card:${card.id}`
              ) {
                errors.push(
                  "La transferencia debe tener como destino la tarjeta de crédito asociada a esta compra.",
                );
              }

              const sourceAccount = storage.accounts.find(
                (account) =>
                  account.id === sourceAccountId,
              );

              if (
                !sourceAccount ||
                sourceAccount.status !== "active"
              ) {
                errors.push(
                  "La cuenta de origen de la transferencia no existe o está archivada.",
                );
              }

              if (
                card.paymentAccountId &&
                card.paymentAccountId !== sourceAccountId
              ) {
                errors.push(
                  "La cuenta de origen no coincide con la cuenta de pago configurada para esta tarjeta.",
                );
              }
            }
          }
        }

        if (
          isValidDate(data.paidAt) &&
          isValidDate(transaction.date) &&
          transaction.date > data.paidAt
        ) {
          errors.push(
            "La fecha del pago no puede ser anterior a la fecha de la transferencia.",
          );
        }

        if (
          !Number.isFinite(transaction.amount) ||
          transaction.amount <= 0
        ) {
          errors.push(
            "El importe de la transferencia no es válido.",
          );
        } else if (isValidMoney(data.amount)) {
          const alreadyUsed = getTransactionUsedAmount(
            data.transactionId,
          );

          const availableAmount = roundMoney(
            transaction.amount - alreadyUsed,
          );

          if (data.amount > availableAmount) {
            errors.push(
              "El importe disponible de la transferencia ya está utilizado total o parcialmente.",
            );
          }
        }
      }
    }
  } else {
    errors.push("El método de pago no es válido.");
  }

  return createResult(errors);
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE RELACIONES ENTRE ENTIDADES
// -----------------------------------------------------------------------------

export function validateAccountRelations(
  accountId: string,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  const account = storage.accounts.find(
    (item) => item.id === accountId,
  );

  if (!account) {
    return createResult([
      "No se encontró la cuenta indicada.",
    ]);
  }

  if (
    account.bankId &&
    !storage.banks.some(
      (bank) => bank.id === account.bankId,
    )
  ) {
    errors.push(
      "La cuenta está vinculada a una institución bancaria inexistente.",
    );
  }

  return createResult(errors);
}

export function validateCardRelations(
  cardId: string,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  const card = storage.cards.find(
    (item) => item.id === cardId,
  );

  if (!card) {
    return createResult([
      "No se encontró la tarjeta indicada.",
    ]);
  }

  if (
    !storage.banks.some(
      (bank) => bank.id === card.bankId,
    )
  ) {
    errors.push(
      "La tarjeta está vinculada a una institución inexistente.",
    );
  }

  if (card.linkedAccountId) {
    const linkedAccount = storage.accounts.find(
      (account) => account.id === card.linkedAccountId,
    );

    if (!linkedAccount) {
      errors.push(
        "La cuenta vinculada a la tarjeta no existe.",
      );
    } else if (
      card.status === "active" &&
      linkedAccount.status !== "active"
    ) {
      errors.push(
        "La tarjeta activa está vinculada a una cuenta archivada.",
      );
    }
  }

  if (card.paymentAccountId) {
    const paymentAccount = storage.accounts.find(
      (account) => account.id === card.paymentAccountId,
    );

    if (!paymentAccount) {
      errors.push(
        "La cuenta de pago de la tarjeta no existe.",
      );
    } else if (
      card.status === "active" &&
      paymentAccount.status !== "active"
    ) {
      errors.push(
        "La tarjeta activa tiene configurada una cuenta de pago archivada.",
      );
    }
  }

  if (
    card.type === "debit" &&
    card.paymentAccountId !== null
  ) {
    errors.push(
      "Una tarjeta de débito no debe tener una cuenta de pago configurada.",
    );
  }

  if (
    card.type === "credit" &&
    card.linkedAccountId !== null
  ) {
    errors.push(
      "Una tarjeta de crédito no debe tener una cuenta vinculada de débito.",
    );
  }

  return createResult(errors);
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE RELACIONES DE PARCIALIDADES
// -----------------------------------------------------------------------------

export function validateInstallmentRelations(
  installmentId: string,
): ValidationResult {
  const errors: string[] = [];
  const storage = loadAccountStorage();

  if (!storage) {
    return createResult([
      "No hay información de cuentas disponible.",
    ]);
  }

  const installment = storage.installments.find(
    (item) => item.id === installmentId,
  );

  if (!installment) {
    return createResult([
      "No se encontró la parcialidad indicada.",
    ]);
  }

  const plan = storage.installmentPlans.find(
    (item) => item.id === installment.planId,
  );

  if (!plan) {
    return createResult([
      "La parcialidad no tiene un plan asociado.",
    ]);
  }

  const purchase = storage.purchases.find(
    (item) => item.id === plan.cardPurchaseId,
  );

  if (!purchase) {
    errors.push(
      "El plan está vinculado a una compra inexistente.",
    );
  } else {
    if (purchase.installmentPlanId !== plan.id) {
      errors.push(
        "La compra no tiene registrado el mismo plan de parcialidades.",
      );
    }

    if (purchase.purchaseType !== "installments") {
      errors.push(
        "La compra asociada al plan no está registrada como MSI.",
      );
    }

    if (
      purchase.installmentCount !== plan.installmentCount ||
      purchase.firstDueDate !== plan.firstDueDate
    ) {
      errors.push(
        "Los datos del plan no coinciden con los datos MSI de la compra.",
      );
    }

    if (
      roundMoney(purchase.amount) !==
      roundMoney(plan.totalAmount)
    ) {
      errors.push(
        "El importe del plan no coincide con el importe de la compra.",
      );
    }

    const card = storage.cards.find(
      (item) => item.id === purchase.cardId,
    );

    if (!card || card.type !== "credit") {
      errors.push(
        "La compra MSI no está asociada a una tarjeta de crédito válida.",
      );
    }
  }

  if (plan.status === "active" && purchase?.status !== "active") {
    errors.push(
      "Un plan activo no puede estar asociado a una compra cancelada.",
    );
  }

  const duplicatePlans = storage.installmentPlans.filter(
    (item) =>
      item.cardPurchaseId === plan.cardPurchaseId,
  );

  if (duplicatePlans.length > 1) {
    errors.push(
      "La compra tiene más de un plan de parcialidades asociado.",
    );
  }

  if (
    !Number.isInteger(plan.installmentCount) ||
    plan.installmentCount < 2
  ) {
    errors.push(
      "El número de parcialidades del plan no es válido.",
    );
  }

  if (!isValidDate(plan.firstDueDate)) {
    errors.push(
      "La fecha de primera parcialidad del plan no es válida.",
    );
  }

  const planInstallments = getPlanInstallments(plan.id);

  if (planInstallments.length !== plan.installmentCount) {
    errors.push(
      "El número de parcialidades registradas no coincide con el plan.",
    );
  }

  if (
    !Number.isInteger(installment.installmentNumber) ||
    installment.installmentNumber < 1 ||
    installment.installmentNumber > plan.installmentCount
  ) {
    errors.push(
      "El número de parcialidad no corresponde al plan.",
    );
  }

  if (!isValidDate(installment.dueDate)) {
    errors.push(
      "La fecha de vencimiento de la parcialidad no es válida.",
    );
  }

  if (!isValidMoney(installment.amount)) {
    errors.push(
      "El importe de la parcialidad no es válido.",
    );
  }

  if (
    !isValidMoney(installment.paidAmount, true) ||
    installment.paidAmount > installment.amount
  ) {
    errors.push(
      "El importe abonado supera el importe de la parcialidad o no es válido.",
    );
  }

  const expectedAmounts = getExpectedInstallmentAmounts(
    plan.totalAmount,
    plan.installmentCount,
  );

  const expectedAmount =
    expectedAmounts[installment.installmentNumber - 1];

  if (
    expectedAmount !== undefined &&
    roundMoney(installment.amount) !== expectedAmount
  ) {
    errors.push(
      "El importe de la parcialidad no coincide con la distribución del total del plan.",
    );
  }

  if (
    isValidDate(plan.firstDueDate) &&
    installment.installmentNumber >= 1 &&
    installment.installmentNumber <= plan.installmentCount
  ) {
    const expectedDueDate = addMonthsClamped(
      plan.firstDueDate,
      installment.installmentNumber - 1,
    );

    if (installment.dueDate !== expectedDueDate) {
      errors.push(
        "La fecha de vencimiento no coincide con el calendario del plan.",
      );
    }
  }

  const duplicateInstallmentNumber = planInstallments.filter(
    (item) =>
      item.installmentNumber === installment.installmentNumber,
  );

  if (duplicateInstallmentNumber.length > 1) {
    errors.push(
      "El plan contiene números de parcialidad duplicados.",
    );
  }

  const payments = installment.payments ?? [];

  const paymentsTotal = roundMoney(
    payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    ),
  );

  if (
    paymentsTotal !== roundMoney(installment.paidAmount)
  ) {
    errors.push(
      "El importe abonado no coincide con el historial de pagos.",
    );
  }

  for (const payment of payments) {
    if (!isValidMoney(payment.amount)) {
      errors.push(
        "El historial contiene un pago con importe no válido.",
      );
    }

    if (!isValidDate(payment.paidAt)) {
      errors.push(
        "El historial contiene un pago con fecha no válida.",
      );
    }

    if (purchase && payment.paidAt < purchase.purchaseDate) {
      errors.push(
        "El historial contiene un pago anterior a la fecha de compra.",
      );
    }

    if (
      payment.method === "manual" &&
      payment.transactionId != null
    ) {
      errors.push(
        "Un pago manual no debe tener una transacción vinculada.",
      );
    }

    if (
      payment.method !== "manual" &&
      payment.method !== "transaction"
    ) {
      errors.push("El método de pago del historial no es válido.");
    }

    if (
      payment.method === "transaction" &&
      !payment.transactionId
    ) {
      errors.push(
        "Un pago por transferencia debe tener una transacción vinculada.",
      );
    }

    if (payment.transactionId) {
      const transaction = getTransactionById(
        payment.transactionId,
      );

      if (!transaction) {
        errors.push(
          "Un pago está vinculado a una transacción inexistente.",
        );
      } else {
        if (transaction.status === "cancelled") {
          errors.push(
            "Un pago está vinculado a una transacción cancelada.",
          );
        }

        if (transaction.type !== "transfer") {
          errors.push(
            "Un pago está vinculado a una transacción que no es transferencia.",
          );
        }

        const transferAccounts = getTransferAccounts(
          transaction.account,
        );

        if (
          transferAccounts.length !== 2 ||
          !transferAccounts[0] ||
          !transferAccounts[1]
        ) {
          errors.push(
            "Una transacción vinculada a un pago tiene un formato de transferencia inválido.",
          );
        } else if (
          purchase &&
          transferAccounts[1] !== `card:${purchase.cardId}`
        ) {
          errors.push(
            "Una transferencia vinculada a un pago tiene un destino incorrecto.",
          );
        }
      }
    }
  }

  if (
    installment.status !==
    getExpectedInstallmentStatus(
      installment.amount,
      installment.paidAmount,
    )
  ) {
    errors.push(
      "El estado de la parcialidad no coincide con su importe abonado.",
    );
  }

  const transactionUsage = new Map<string, number>();

  for (const currentInstallment of storage.installments) {
    for (const payment of currentInstallment.payments ?? []) {
      if (!payment.transactionId) {
        continue;
      }

      const currentTotal =
        transactionUsage.get(payment.transactionId) ?? 0;

      transactionUsage.set(
        payment.transactionId,
        roundMoney(currentTotal + payment.amount),
      );
    }
  }

  for (const [transactionId, usedAmount] of transactionUsage) {
    const transaction = getTransactionById(transactionId);

    if (
      transaction &&
      Number.isFinite(transaction.amount) &&
      transaction.amount > 0 &&
      usedAmount > roundMoney(transaction.amount)
    ) {
      errors.push(
        "Los pagos vinculados a una misma transferencia superan el importe de esa transferencia.",
      );
      break;
    }
  }

  return createResult(errors);
}
