import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiError, apiJson, originRejected, preflight, readJson } from "@/lib/http";
import {
  auditChanges,
  cancellationSchema,
  DomainError,
  financialWrite,
  transactionData,
  transactionFailure,
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
    const parsed = cancellationSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(request, 400, "INVALID_INPUT", "Motivo de cancelación inválido.");

    const cancelled = await financialWrite(async (tx) => {
      const previous = await tx.transaction.findFirst({
        where: { id: transactionId, userId: session.userId },
      });
      if (!previous) throw new DomainError(404, "TRANSACTION_NOT_FOUND", "Movimiento no encontrado.");
      if (previous.status === "cancelled") {
        throw new DomainError(409, "TRANSACTION_CANCELLED", "El movimiento ya está cancelado.");
      }

      const transaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "cancelled", cancellationReason: parsed.data.reason },
      });
      await tx.transactionAudit.create({
        data: {
          userId: session.userId,
          actorUserId: session.userId,
          transactionId,
          action: "cancelled",
          reason: parsed.data.reason,
          changes: auditChanges(previous, transaction),
        },
      });
      return transaction;
    });

    return apiJson(request, transactionData(cancelled));
  } catch (error) {
    return transactionFailure(request, error, "la cancelación de movimiento");
  }
}
