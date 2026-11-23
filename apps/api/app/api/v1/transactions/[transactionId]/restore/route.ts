import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiError, apiJson, originRejected, preflight } from "@/lib/http";
import {
  auditChanges,
  candidateFromTransaction,
  DomainError,
  financialWrite,
  transactionData,
  transactionFailure,
  validateAccounts,
} from "@/lib/transactions";

export const runtime = "nodejs";

type Context = { params: Promise<{ transactionId: string }> };

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest, context: Context) {
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

    const restored = await financialWrite(async (tx) => {
      const previous = await tx.transaction.findFirst({
        where: { id: transactionId, userId: session.userId },
      });
      if (!previous) throw new DomainError(404, "TRANSACTION_NOT_FOUND", "Movimiento no encontrado.");
      if (previous.status === "active") {
        throw new DomainError(409, "TRANSACTION_ACTIVE", "El movimiento ya está activo.");
      }

      await validateAccounts(tx, session.userId, candidateFromTransaction(previous), previous);

      const transaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "active", cancellationReason: null },
      });
      await tx.transactionAudit.create({
        data: {
          userId: session.userId,
          actorUserId: session.userId,
          transactionId,
          action: "restored",
          changes: auditChanges(previous, transaction),
        },
      });
      return transaction;
    });

    return apiJson(request, transactionData(restored));
  } catch (error) {
    return transactionFailure(request, error, "la restauración de movimiento");
  }
}
