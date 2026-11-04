// card service
import type {
  BankCard,
  CardStatus,
  CardType,
} from "@/types/account";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

function generateId(): string {
  return crypto.randomUUID();
}

export interface CardData {
  name: string;
  bankId: string;
  type: CardType;
  linkedAccountId: string | null;
  paymentAccountId: string | null;
  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDueDay: number | null;
}

export type UpdateCardData = Partial<CardData>;

function validateDay(
  day: number | null,
  fieldName: string,
): void {
  if (
    day !== null &&
    (!Number.isInteger(day) || day < 1 || day > 31)
  ) {
    throw new Error(
      `${fieldName} debe ser un día entre 1 y 31.`,
    );
  }
}

function validateCardData(data: CardData): void {
  const storage = loadAccountStorage();

  if (!data.name.trim()) {
    throw new Error("El nombre de la tarjeta es obligatorio.");
  }

  const bankExists = storage.banks.some(
    (bank) => bank.id === data.bankId,
  );

  if (!bankExists) {
    throw new Error("La institución bancaria no existe.");
  }

  if (data.type === "debit") {
    if (data.paymentAccountId !== null) {
      throw new Error(
        "Una tarjeta de débito no debe tener una cuenta de pago.",
      );
    }

    if (
      data.linkedAccountId !== null &&
      !storage.accounts.some(
        (account) =>
          account.id === data.linkedAccountId &&
          account.status === "active",
      )
    ) {
      throw new Error(
        "La cuenta vinculada no existe o está archivada.",
      );
    }

    if (
      data.creditLimit !== null ||
      data.cutoffDay !== null ||
      data.paymentDueDay !== null
    ) {
      throw new Error(
        "Las tarjetas de débito no utilizan límite de crédito ni fechas de corte o pago.",
      );
    }
  }

  if (data.type === "credit") {
    if (data.linkedAccountId !== null) {
      throw new Error(
        "Una tarjeta de crédito no debe utilizar una cuenta vinculada de débito.",
      );
    }

    if (
      data.paymentAccountId !== null &&
      !storage.accounts.some(
        (account) =>
          account.id === data.paymentAccountId &&
          account.status === "active",
      )
    ) {
      throw new Error(
        "La cuenta de pago no existe o está archivada.",
      );
    }

    if (
      data.creditLimit !== null &&
      (!Number.isFinite(data.creditLimit) ||
        data.creditLimit <= 0)
    ) {
      throw new Error(
        "El límite de crédito debe ser mayor que cero.",
      );
    }

    if (data.cutoffDay === null) {
      throw new Error(
        "El día de corte es obligatorio para una tarjeta de crédito.",
      );
    }

    if (data.paymentDueDay === null) {
      throw new Error(
        "El día límite de pago es obligatorio para una tarjeta de crédito.",
      );
    }

    validateDay(data.cutoffDay, "El día de corte");
    validateDay(data.paymentDueDay, "El día límite de pago");
  }
}

// Consultas

export function getCards(): BankCard[] {
  return loadAccountStorage().cards;
}

export function getActiveCards(): BankCard[] {
  return getCards().filter(
    (card) => card.status === "active",
  );
}

export function getArchivedCards(): BankCard[] {
  return getCards().filter(
    (card) => card.status === "archived",
  );
}

export function getCardsByType(type: CardType): BankCard[] {
  return getActiveCards().filter(
    (card) => card.type === type,
  );
}

export function getCardsByBank(bankId: string): BankCard[] {
  return getActiveCards().filter(
    (card) => card.bankId === bankId,
  );
}

export function getCardById(
  cardId: string,
): BankCard | undefined {
  return getCards().find(
    (card) => card.id === cardId,
  );
}

// Creación

export function createCard(data: CardData): BankCard {
  validateCardData(data);

  const storage = loadAccountStorage();

  const card: BankCard = {
    id: generateId(),
    name: data.name.trim(),
    bankId: data.bankId,
    type: data.type,
    linkedAccountId: data.linkedAccountId,
    paymentAccountId: data.paymentAccountId,
    creditLimit: data.creditLimit,
    cutoffDay: data.cutoffDay,
    paymentDueDay: data.paymentDueDay,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  const saved = saveAccountStorage({
    ...storage,
    cards: [...storage.cards, card],
  });

  if (!saved) {
    throw new Error("No fue posible guardar la tarjeta.");
  }

  return card;
}

// Actualización

export function updateCard(
  cardId: string,
  data: UpdateCardData,
): BankCard {
  const storage = loadAccountStorage();

  const card = storage.cards.find(
    (item) => item.id === cardId,
  );

  if (!card) {
    throw new Error("La tarjeta no existe.");
  }

  if (card.status === "archived") {
    throw new Error(
      "No puedes modificar una tarjeta archivada.",
    );
  }

  const updatedData: CardData = {
    name: data.name ?? card.name,
    bankId: data.bankId ?? card.bankId,
    type: data.type ?? card.type,
    linkedAccountId:
      data.linkedAccountId !== undefined
        ? data.linkedAccountId
        : card.linkedAccountId,
    paymentAccountId:
      data.paymentAccountId !== undefined
        ? data.paymentAccountId
        : card.paymentAccountId,
    creditLimit:
      data.creditLimit !== undefined
        ? data.creditLimit
        : card.creditLimit,
    cutoffDay:
      data.cutoffDay !== undefined
        ? data.cutoffDay
        : card.cutoffDay,
    paymentDueDay:
      data.paymentDueDay !== undefined
        ? data.paymentDueDay
        : card.paymentDueDay,
  };

  validateCardData(updatedData);

  const updatedCard: BankCard = {
    ...card,
    ...updatedData,
    name: updatedData.name.trim(),
  };

  const updatedCards = storage.cards.map((item) =>
    item.id === cardId ? updatedCard : item,
  );

  const saved = saveAccountStorage({
    ...storage,
    cards: updatedCards,
  });

  if (!saved) {
    throw new Error("No fue posible actualizar la tarjeta.");
  }

  return updatedCard;
}

// Archivado

export function archiveCard(cardId: string): BankCard {
  const storage = loadAccountStorage();

  const card = storage.cards.find(
    (item) => item.id === cardId,
  );

  if (!card) {
    throw new Error("La tarjeta no existe.");
  }

  if (card.status === "archived") {
    throw new Error("La tarjeta ya está archivada.");
  }

  const archivedCard: BankCard = {
    ...card,
    status: "archived" as CardStatus,
    archivedAt: new Date().toISOString(),
  };

  const updatedCards = storage.cards.map((item) =>
    item.id === cardId ? archivedCard : item,
  );

  const saved = saveAccountStorage({
    ...storage,
    cards: updatedCards,
  });

  if (!saved) {
    throw new Error("No fue posible archivar la tarjeta.");
  }

  return archivedCard;
}

// Restauración

export function restoreCard(cardId: string): BankCard {
  const storage = loadAccountStorage();

  const card = storage.cards.find(
    (item) => item.id === cardId,
  );

  if (!card) {
    throw new Error("La tarjeta no existe.");
  }

  if (card.status === "active") {
    throw new Error("La tarjeta ya está activa.");
  }

  const restoredCard: BankCard = {
    ...card,
    status: "active",
    archivedAt: undefined,
  };

  const updatedCards = storage.cards.map((item) =>
    item.id === cardId ? restoredCard : item,
  );

  const saved = saveAccountStorage({
    ...storage,
    cards: updatedCards,
  });

  if (!saved) {
    throw new Error("No fue posible restaurar la tarjeta.");
  }

  return restoredCard;
}