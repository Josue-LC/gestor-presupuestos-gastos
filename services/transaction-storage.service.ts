// transaction-storage service
import type { Transaction } from "@/components/transactions/TransactionList";
import type {
  TransactionAuditEvent,
  TransactionAuditAction,
  TransactionAuditField,
} from "@/types/transaction-audit";

const STORAGE_KEY = "proyecto-fs:transactions:v1";

export interface TransactionStorageData {
  transactions: Transaction[];
  auditEvents: TransactionAuditEvent[];
}

const TRANSACTION_TYPES = ["income", "expense", "transfer"];

const TRANSACTION_STATUSES = ["active", "cancelled"];

const AUDIT_ACTIONS: TransactionAuditAction[] = [
  "created",
  "updated",
  "cancelled",
  "restored",
  "removed",
];

const AUDIT_FIELDS: TransactionAuditField[] = [
  "description",
  "amount",
  "type",
  "category",
  "account",
  "date",
  "registeredAt",
  "status",
  "cancellationReason",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

/**
 * Valida fechas de operación.
 * Se aceptan fechas localizadas como "03 nov 2026".
 */
function isValidOperationDate(value: unknown): value is string {
  return isNonEmptyString(value);
}

/**
 * Valida fechas ISO utilizadas para registro y auditoría.
 */
function isValidDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function hasUniqueIds<T extends { id: string }>(
  items: T[],
): boolean {
  const ids = new Set(items.map((item) => item.id));

  return ids.size === items.length;
}

function isTransaction(value: unknown): value is Transaction {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.account) &&
    isValidOperationDate(value.date) &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    TRANSACTION_TYPES.includes(String(value.type)) &&
    (
      value.status === undefined ||
      TRANSACTION_STATUSES.includes(String(value.status))
    ) &&
    (
      value.registeredAt === undefined ||
      isValidDateTime(value.registeredAt)
    ) &&
    (
      value.cancellationReason === undefined ||
      typeof value.cancellationReason === "string"
    )
  );
}

function isAuditChange(value: unknown): boolean {
  if (!isObject(value)) return false;

  const isValidValue = (item: unknown): boolean =>
    item === null ||
    typeof item === "string" ||
    (
      typeof item === "number" &&
      Number.isFinite(item)
    );

  return (
    typeof value.field === "string" &&
    AUDIT_FIELDS.includes(
      value.field as TransactionAuditField,
    ) &&
    isValidValue(value.previousValue) &&
    isValidValue(value.newValue)
  );
}

function isAuditEvent(
  value: unknown,
): value is TransactionAuditEvent {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.transactionId) &&
    typeof value.action === "string" &&
    AUDIT_ACTIONS.includes(
      value.action as TransactionAuditAction,
    ) &&
    isValidDateTime(value.timestamp) &&
    isNonEmptyString(value.actor) &&
    (
      value.reason === undefined ||
      typeof value.reason === "string"
    ) &&
    Array.isArray(value.changes) &&
    value.changes.every(isAuditChange)
  );
}

function isValidStorageData(
  value: unknown,
): value is TransactionStorageData {
  if (!isObject(value)) return false;

  if (
    !Array.isArray(value.transactions) ||
    !Array.isArray(value.auditEvents)
  ) {
    return false;
  }

  if (
    !value.transactions.every(isTransaction) ||
    !value.auditEvents.every(isAuditEvent)
  ) {
    return false;
  }

  return (
    hasUniqueIds(value.transactions) &&
    hasUniqueIds(value.auditEvents)
  );
}

/**
 * Carga los movimientos y eventos de auditoría desde localStorage.
 */
export function loadTransactionStorage(): TransactionStorageData {
  const emptyData: TransactionStorageData = {
    transactions: [],
    auditEvents: [],
  };

  try {
    const rawData = localStorage.getItem(STORAGE_KEY);

    if (!rawData) {
      return emptyData;
    }

    const parsedData: unknown = JSON.parse(rawData);

    if (!isObject(parsedData)) {
      console.error(
        "El almacenamiento de movimientos tiene un formato inválido.",
      );

      return emptyData;
    }

    const transactions = Array.isArray(parsedData.transactions)
      ? parsedData.transactions.filter(isTransaction)
      : [];

    const auditEvents = Array.isArray(parsedData.auditEvents)
      ? parsedData.auditEvents.filter(isAuditEvent)
      : [];

    const invalidTransactions =
      Array.isArray(parsedData.transactions)
        ? parsedData.transactions.length - transactions.length
        : 0;

    const invalidAuditEvents =
      Array.isArray(parsedData.auditEvents)
        ? parsedData.auditEvents.length - auditEvents.length
        : 0;

    if (invalidTransactions > 0 || invalidAuditEvents > 0) {
      console.warn(
        "Se encontraron registros inválidos en el almacenamiento local.",
        {
          movimientosInvalidos: invalidTransactions,
          eventosAuditoriaInvalidos: invalidAuditEvents,
        },
      );
    }

    if (!hasUniqueIds(transactions)) {
      console.warn(
        "Se encontraron identificadores duplicados en los movimientos.",
      );
    }

    if (!hasUniqueIds(auditEvents)) {
      console.warn(
        "Se encontraron identificadores duplicados en los eventos de auditoría.",
      );
    }

    return {
      transactions,
      auditEvents,
    };
  } catch (error) {
    console.error(
      "No fue posible cargar los movimientos desde el almacenamiento local.",
      error,
    );

    return emptyData;
  }
}

/**
 * Guarda los movimientos y eventos de auditoría en localStorage.
 */
export function saveTransactionStorage(
  data: TransactionStorageData,
): boolean {
  try {
    if (!isValidStorageData(data)) {
      console.error(
        "No se guardaron los movimientos: los datos contienen registros inválidos o identificadores duplicados.",
      );

      return false;
    }

    const serializedData = JSON.stringify(data);

    localStorage.setItem(STORAGE_KEY, serializedData);

    return true;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "QuotaExceededError"
    ) {
      console.error(
        "No hay suficiente espacio disponible en el almacenamiento local.",
      );

      return false;
    }

    if (
      error instanceof DOMException &&
      error.name === "SecurityError"
    ) {
      console.error(
        "El navegador bloqueó el acceso al almacenamiento local.",
      );

      return false;
    }

    console.error(
      "Ocurrió un error al guardar los movimientos.",
      error,
    );

    return false;
  }
}

/**
 * Elimina todos los movimientos y eventos de auditoría almacenados.
 */
export function clearTransactionStorage(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);

    return true;
  } catch (error) {
    console.error(
      "No fue posible limpiar el almacenamiento local.",
      error,
    );

    return false;
  }
}
