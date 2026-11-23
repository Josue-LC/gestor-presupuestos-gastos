import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiJson, preflight } from "@/lib/http";
import { auditData, transactionFailure } from "@/lib/transactions";

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
      select: { id: true },
    });
    if (!transaction) return apiError(request, 404, "TRANSACTION_NOT_FOUND", "Movimiento no encontrado.");

    const events = await prisma.transactionAudit.findMany({
      where: { transactionId, userId: session.userId },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    return apiJson(request, events.map(auditData));
  } catch (error) {
    return transactionFailure(request, error, "la consulta de auditoría");
  }
}
