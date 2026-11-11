// bank.service.ts
import type { Bank } from "@/types/account";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

function generateId(): string {
  return crypto.randomUUID();
}

function normalizeBankName(value: string): string {
  return value.trim().toLocaleLowerCase("es-MX");
}

function validateBankName(name: string): string {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("El nombre del banco es obligatorio.");
  }

  return normalizedName;
}

// Consultas

export function getBanks(): Bank[] {
  return [...loadAccountStorage().banks].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
}

export function getDefaultBanks(): Bank[] {
  return getBanks().filter((bank) => !bank.isCustom);
}

export function getCustomBanks(): Bank[] {
  return getBanks().filter((bank) => bank.isCustom);
}

export function getBankById(
  bankId: string,
): Bank | undefined {
  return loadAccountStorage().banks.find(
    (bank) => bank.id === bankId,
  );
}

export function searchBanks(query: string): Bank[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");

  if (!normalizedQuery) {
    return getBanks();
  }

  return getBanks().filter((bank) =>
    bank.name.toLocaleLowerCase("es-MX").includes(normalizedQuery),
  );
}

// Creación de bancos personalizados

export function createCustomBank(name: string): Bank {
  const normalizedName = validateBankName(name);
  const storage = loadAccountStorage();
  const comparableName = normalizeBankName(normalizedName);

  const alreadyExists = storage.banks.some(
    (bank) => normalizeBankName(bank.name) === comparableName,
  );

  if (alreadyExists) {
    throw new Error(
      "Ya existe una institución bancaria con ese nombre.",
    );
  }

  const bank: Bank = {
    id: `custom-${generateId()}`,
    name: normalizedName,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };

  const saved = saveAccountStorage({
    ...storage,
    banks: [...storage.banks, bank],
  });

  if (!saved) {
    throw new Error(
      "No fue posible guardar la institución bancaria.",
    );
  }

  return bank;
}

// Actualización de bancos personalizados

export function updateCustomBank(
  bankId: string,
  name: string,
): Bank {
  const normalizedName = validateBankName(name);
  const storage = loadAccountStorage();

  const bank = storage.banks.find(
    (item) => item.id === bankId,
  );

  if (!bank) {
    throw new Error("La institución bancaria no existe.");
  }

  if (!bank.isCustom) {
    throw new Error(
      "No puedes modificar una institución del catálogo predeterminado.",
    );
  }

  const comparableName = normalizeBankName(normalizedName);

  const alreadyExists = storage.banks.some(
    (item) =>
      item.id !== bankId &&
      normalizeBankName(item.name) === comparableName,
  );

  if (alreadyExists) {
    throw new Error(
      "Ya existe una institución bancaria con ese nombre.",
    );
  }

  const updatedBank: Bank = {
    ...bank,
    name: normalizedName,
  };

  const updatedBanks = storage.banks.map((item) =>
    item.id === bankId ? updatedBank : item,
  );

  const saved = saveAccountStorage({
    ...storage,
    banks: updatedBanks,
  });

  if (!saved) {
    throw new Error(
      "No fue posible actualizar la institución bancaria.",
    );
  }

  return updatedBank;
}

// Eliminación de bancos personalizados

export function deleteCustomBank(bankId: string): void {
  const storage = loadAccountStorage();

  const bank = storage.banks.find(
    (item) => item.id === bankId,
  );

  if (!bank) {
    throw new Error("La institución bancaria no existe.");
  }

  if (!bank.isCustom) {
    throw new Error(
      "No puedes eliminar una institución del catálogo predeterminado.",
    );
  }

  // Se consideran también las cuentas y tarjetas archivadas:
  // siguen conservando la referencia histórica al banco.
  const isBeingUsedByAccounts = storage.accounts.some(
    (account) => account.bankId === bankId,
  );

  const isBeingUsedByCards = storage.cards.some(
    (card) => card.bankId === bankId,
  );

  if (isBeingUsedByAccounts || isBeingUsedByCards) {
    throw new Error(
      "No puedes eliminar este banco porque está asociado a una cuenta o tarjeta.",
    );
  }

  const updatedBanks = storage.banks.filter(
    (item) => item.id !== bankId,
  );

  const saved = saveAccountStorage({
    ...storage,
    banks: updatedBanks,
  });

  if (!saved) {
    throw new Error(
      "No fue posible eliminar la institución bancaria.",
    );
  }
}
