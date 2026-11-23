import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { dateOnly } from "@/lib/accounts";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiJson, originRejected, preflight, readJson } from "@/lib/http";
import {
  candidateFromInput,
  decodeCursor,
  encodeCursor,
  financialWrite,
  transactionData,
  transactionFailure,
  transactionInputSchema,
  transactionListSchema,
  auditChanges,
  validateAccounts,
  validateCandidate,
  writeData,
} from "@/lib/transactions";

export const runtime = "nodejs";

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");

    const parsed = transactionListSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return apiError(request, 400, "INVALID_FILTER", "Filtros de movimientos inválidos.");
    const filters = parsed.data;

    if (filters.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: filters.accountId, userId: session.userId },
        select: { id: true },
      });
      if (!account) return apiError(request, 404, "ACCOUNT_NOT_FOUND", "Cuenta no encontrada.");
    }

    const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
    if (filters.cursor && !cursor) {
      return apiError(request, 400, "INVALID_CURSOR", "Cursor de paginación inválido.");
    }

    const where: Prisma.TransactionWhereInput = {
      userId: session.userId,
      type: filters.type,
      status: filters.status,
      ...(filters.accountId ? {
        OR: [
          { sourceAccountId: filters.accountId },
          { destinationAccountId: filters.accountId },
        ],
      } : {}),
      ...(filters.from || filters.to ? {
        operationDate: {
          ...(filters.from ? { gte: dateOnly(filters.from) } : {}),
          ...(filters.to ? { lte: dateOnly(filters.to) } : {}),
        },
      } : {}),
      ...(cursor ? {
        AND: [{
          OR: [
            { operationDate: { lt: dateOnly(cursor.date) } },
            { operationDate: dateOnly(cursor.date), id: { lt: cursor.id } },
          ],
        }],
      } : {}),
    };
    const rows = await prisma.transaction.findMany({
      where,
      orderBy: [{ operationDate: "desc" }, { id: "desc" }],
      take: filters.limit + 1,
    });
    const page = rows.slice(0, filters.limit);
    return apiJson(request, {
      items: page.map(transactionData),
      nextCursor: rows.length > filters.limit ? encodeCursor(page[page.length - 1]) : null,
    });
  } catch (error) {
    return transactionFailure(request, error, "la consulta de movimientos");
  }
}

export async function POST(request: NextRequest) {
  if (originRejected(request)) {
    return apiError(request, 403, "FORBIDDEN_ORIGIN", "Origen no autorizado.");
  }

  try {
    const session = await getSession(request);
    if (!session) return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");

    const parsed = transactionInputSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(request, 400, "INVALID_INPUT", "Datos de movimiento inválidos.");
    const candidate = candidateFromInput(parsed.data);
    validateCandidate(candidate);

    const created = await financialWrite(async (tx) => {
      await validateAccounts(tx, session.userId, candidate);
      const transaction = await tx.transaction.create({
        data: { userId: session.userId, ...writeData(candidate) },
      });
      await tx.transactionAudit.create({
        data: {
          userId: session.userId,
          actorUserId: session.userId,
          transactionId: transaction.id,
          action: "created",
          changes: auditChanges(null, transaction),
        },
      });
      return transaction;
    });

    return apiJson(request, transactionData(created), 201);
  } catch (error) {
    return transactionFailure(request, error, "el registro de movimiento");
  }
}
