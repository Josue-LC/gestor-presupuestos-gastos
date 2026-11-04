// account service
import type { Account, AccountType } from "@/types/account";
import type { Transaction } from "@/components/transactions/TransactionList";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

import { loadTransactionStorage } from "@/services/transaction-storage.service";

type CreateAccountData = {
  name: string;
  bankId: string | null;
  type: AccountType;
  currency: "MXN";
  openingBalance: number;
  openingDate: string;
};

type UpdateAccountData = Partial<CreateAccountData>;

const VALID_ACCOUNT_TYPES: AccountType[] = [
  "checking",
  "savings",
  "cash",
  "investment",
  "other",
];

function generateId(): string {
  return crypto.randomUUID();
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

function isValidMoney(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function getActiveTransactions(): Transaction[] {
  const storage = loadTransactionStorage();

  return (storage?.transactions ?? []).filter(
    (transaction) => transaction.status !== "cancelled",
  );
}

function getTransferAccounts(account: string): string[] {
  return account.split(" → ").map((value) => value.trim());
}

function transactionUsesAccount(
  transaction: Transaction,
  accountId: string,
): boolean {
  if (transaction.type === "transfer") {
    const [sourceAccountId, destinationAccountId] =
      getTransferAccounts(transaction.account);

    return (
      sourceAccountId === accountId ||
      destinationAccountId === accountId
    );
  }

  return transaction.account === accountId;
}

function validateAccountData(
  data: CreateAccountData,
  accountId?: string,
): void {
  const storage = loadAccountStorage();

  if (!data.name.trim()) {
    throw new Error("El nombre de la cuenta es obligatorio.");
  }

  if (!VALID_ACCOUNT_TYPES.includes(data.type)) {
    throw new Error("El tipo de cuenta no es válido.");
  }

  if (!isValidMoney(data.openingBalance)) {
    throw new Error(
      "El saldo inicial debe ser un importe válido con máximo dos decimales.",
    );
  }

  if (data.currency !== "MXN") {
    throw new Error("La moneda de la cuenta no es válida.");
  }

  if (!isValidDate(data.openingDate)) {
    throw new Error("La fecha de apertura no es válida.");
  }

  if (data.bankId !== null) {
    const bankExists = storage.banks.some(
      (bank) => bank.id === data.bankId,
    );

    if (!bankExists) {
      throw new Error("La institución bancaria seleccionada no existe.");
    }
  }

  const duplicatedName = storage.accounts.some(
    (account) =>
      account.id !== accountId &&
      account.status === "active" &&
      account.name.trim().toLocaleLowerCase() ===
        data.name.trim().toLocaleLowerCase(),
  );

  if (duplicatedName) {
    throw new Error("Ya existe una cuenta activa con ese nombre.");
  }
}

function getAccountCards(accountId: string) {
  const storage = loadAccountStorage();

  return storage.cards.filter(
    (card) =>
      card.status === "active" &&
      (card.linkedAccountId === accountId ||
        card.paymentAccountId === accountId),
  );
}

// Consultas

export function getAccounts(): Account[] {
  return loadAccountStorage().accounts;
}

export function getActiveAccounts(): Account[] {
  return getAccounts().filter(
    (account) => account.status === "active",
  );
}

export function getArchivedAccounts(): Account[] {
  return getAccounts().filter(
    (account) => account.status === "archived",
  );
}

export function getAccountById(
  accountId: string,
): Account | undefined {
  return getAccounts().find(
    (account) => account.id === accountId,
  );
}

// Creación

export function createAccount(
  data: CreateAccountData,
): Account {
  validateAccountData(data);

  const storage = loadAccountStorage();

  const account: Account = {
    id: generateId(),
    name: data.name.trim(),
    bankId: data.bankId,
    type: data.type,
    currency: "MXN",
    openingBalance: data.openingBalance,
    openingDate: data.openingDate,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  const saved = saveAccountStorage({
    ...storage,
    accounts: [...storage.accounts, account],
  });

  if (!saved) {
    throw new Error("No fue posible guardar la cuenta.");
  }

  return account;
}

// Actualización

export function updateAccount(
  accountId: string,
  data: UpdateAccountData,
): Account {
  const storage = loadAccountStorage();

  const account = storage.accounts.find(
    (item) => item.id === accountId,
  );

  if (!account) {
    throw new Error("La cuenta no existe.");
  }

  if (account.status === "archived") {
    throw new Error("No puedes modificar una cuenta archivada.");
  }

  const updatedData: CreateAccountData = {
    name: data.name ?? account.name,
    bankId:
      data.bankId !== undefined ? data.bankId : account.bankId,
    type: data.type ?? account.type,
    currency: "MXN",
    openingBalance:
      data.openingBalance ?? account.openingBalance,
    openingDate: data.openingDate ?? account.openingDate,
  };

  validateAccountData(updatedData, accountId);

  const hasMovements = getAccountMovementCount(accountId) > 0;

  if (
    hasMovements &&
    (updatedData.openingBalance !== account.openingBalance ||
      updatedData.openingDate !== account.openingDate)
  ) {
    throw new Error(
      "No puedes modificar el saldo inicial ni la fecha de apertura de una cuenta que ya tiene movimientos. Registra un ajuste de saldo para corregirlo.",
    );
  }

  const updatedAccount: Account = {
    ...account,
    ...updatedData,
    name: updatedData.name.trim(),
  };

  const updatedAccounts = storage.accounts.map((item) =>
    item.id === accountId ? updatedAccount : item,
  );

  const saved = saveAccountStorage({
    ...storage,
    accounts: updatedAccounts,
  });

  if (!saved) {
    throw new Error("No fue posible actualizar la cuenta.");
  }

  return updatedAccount;
}

// Movimientos relacionados

export function getAccountTransactions(
  accountId: string,
): Transaction[] {
  return getActiveTransactions().filter((transaction) =>
    transactionUsesAccount(transaction, accountId),
  );
}

export function getAccountMovementCount(
  accountId: string,
): number {
  return getAccountTransactions(accountId).length;
}

// Cálculo de saldo

export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
  asOfDate?: string,
): number {
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new Error("La fecha de consulta no es válida.");
  }

  const applicableTransactions = transactions.filter(
    (transaction) => {
      if (!transactionUsesAccount(transaction, account.id)) {
        return false;
      }

      if (transaction.date < account.openingDate) {
        return false;
      }

      if (asOfDate && transaction.date > asOfDate) {
        return false;
      }

      return true;
    },
  );

  return applicableTransactions.reduce((balance, transaction) => {
    const amount = Math.abs(transaction.amount);

    if (transaction.type === "income") {
      return balance + amount;
    }

    if (transaction.type === "expense") {
      return balance - amount;
    }

    const [sourceAccountId, destinationAccountId] =
      getTransferAccounts(transaction.account);

    if (sourceAccountId === account.id) {
      return balance - amount;
    }

    if (destinationAccountId === account.id) {
      return balance + amount;
    }

    return balance;
  }, account.openingBalance);
}

export function getAccountBalance(
  accountId: string,
  asOfDate?: string,
): number {
  const account = getAccountById(accountId);

  if (!account) {
    throw new Error("La cuenta no existe.");
  }

  if (asOfDate && !isValidDate(asOfDate)) {
    throw new Error("La fecha de consulta no es válida.");
  }

  const transactions = getActiveTransactions();

  return calculateAccountBalance(
    account,
    transactions,
    asOfDate,
  );
}

// Archivado y restauración

export function archiveAccount(accountId: string): Account {
  const storage = loadAccountStorage();

  const account = storage.accounts.find(
    (item) => item.id === accountId,
  );

  if (!account) {
    throw new Error("La cuenta no existe.");
  }

  if (account.status === "archived") {
    throw new Error("La cuenta ya está archivada.");
  }

  const linkedCards = getAccountCards(accountId);

  if (linkedCards.length > 0) {
    throw new Error(
      "No puedes archivar esta cuenta porque está vinculada a una o más tarjetas activas. Modifica primero la configuración de esas tarjetas.",
    );
  }

  const archivedAccount: Account = {
    ...account,
    status: "archived",
    archivedAt: new Date().toISOString(),
  };

  const updatedAccounts = storage.accounts.map((item) =>
    item.id === accountId ? archivedAccount : item,
  );

  const saved = saveAccountStorage({
    ...storage,
    accounts: updatedAccounts,
  });

  if (!saved) {
    throw new Error("No fue posible archivar la cuenta.");
  }

  return archivedAccount;
}

export function restoreAccount(accountId: string): Account {
  const storage = loadAccountStorage();

  const account = storage.accounts.find(
    (item) => item.id === accountId,
  );

  if (!account) {
    throw new Error("La cuenta no existe.");
  }

  if (account.status === "active") {
    throw new Error("La cuenta ya está activa.");
  }

  const restoredData: CreateAccountData = {
    name: account.name,
    bankId: account.bankId,
    type: account.type,
    currency: "MXN",
    openingBalance: account.openingBalance,
    openingDate: account.openingDate,
  };

  validateAccountData(restoredData, accountId);

  const restoredAccount: Account = {
    ...account,
    status: "active",
    archivedAt: undefined,
  };

  const updatedAccounts = storage.accounts.map((item) =>
    item.id === accountId ? restoredAccount : item,
  );

  const saved = saveAccountStorage({
    ...storage,
    accounts: updatedAccounts,
  });

  if (!saved) {
    throw new Error("No fue posible restaurar la cuenta.");
  }

  return restoredAccount;
}
