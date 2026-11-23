import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiJson, originRejected, preflight, readJson } from "@/lib/http";
import {
  auditChanges,
  candidateFromTransaction,
  DomainError,
  financialWrite,
  transactionData,
  transactionFailure,
  transactionPatchSchema,
  validateAccounts,
  validateCandidate,
  writeData,
} from "@/lib/transactions";

export const runtime = "nodejs";

type Context = { params: Promise<{ transactionId: string }> };

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await getSession(request);
    if (!session) return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");

    const { transactionId } = await context.params;
    if (!z.uuid().safeParse(transactionId).success) {
      return apiError(request, 404, "TRANSACTION_NOT_FOUND", "Movimiento no encontrado.");
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: session.userId },
    });
    if (!transaction) return apiError(request, 404, "TRANSACTION_NOT_FOUND", "Movimiento no encontrado.");

    return apiJson(request, transactionData(transaction));
  } catch (error) {
    return transactionFailure(request, error, "la consulta de movimiento");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  if (originRejected(request)) {
    return apiError(request, 403, "FORBIDDEN_ORIGIN", "Origen no autorizado.");
  }

  try {
    const session = await getSession(request);
    if (!session) return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");

    const { transactionId } = await context.params;
    if (!z.uuid().safeParse(transactionId).success) {
      return apiError(request, 404, "TRANSACTION_NOT_FOUND", "Movimiento no encontrado.");
    }
    const parsed = transactionPatchSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(request, 400, "INVALID_INPUT", "Datos de movimiento inválidos.");

    const updated = await financialWrite(async (tx) => {
      const previous = await tx.transaction.findFirst({
        where: { id: transactionId, userId: session.userId },
      });
      if (!previous) throw new DomainError(404, "TRANSACTION_NOT_FOUND", "Movimiento no encontrado.");
      if (previous.status === "cancelled") {
        throw new DomainError(409, "TRANSACTION_CANCELLED", "No se puede editar un movimiento cancelado.");
      }

      const before = candidateFromTransaction(previous);
      const candidate = { ...before, ...parsed.data };
      validateCandidate(candidate);
      await validateAccounts(tx, session.userId, candidate, previous);

      if (Object.keys(before).every((field) =>
        before[field as keyof typeof before] === candidate[field as keyof typeof candidate]
      )) {
        return previous;
      }

      const transaction = await tx.transaction.update({
        where: { id: transactionId },
        data: writeData(candidate),
      });
      const changes = auditChanges(previous, transaction);
      if (changes.length > 0) {
        await tx.transactionAudit.create({
          data: {
            userId: session.userId,
            actorUserId: session.userId,
            transactionId,
            action: "updated",
            changes,
          },
        });
      }
      return transaction;
    });

    return apiJson(request, transactionData(updated));
  } catch (error) {
    return transactionFailure(request, error, "la edición de movimiento");
  }
}
