import { NextRequest } from "next/server";
import { z } from "zod";
import { accountData, isUniqueViolation } from "@/lib/accounts";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiJson, originRejected, preflight } from "@/lib/http";

export const runtime = "nodejs";

type Context = { params: Promise<{ accountId: string }> };

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest, context: Context) {
  if (originRejected(request)) {
    return apiError(request, 403, "FORBIDDEN_ORIGIN", "Origen no autorizado.");
  }

  try {
    const session = await getSession(request);
    if (!session) {
      return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");
    }

    const { accountId } = await context.params;
    if (!z.uuid().safeParse(accountId).success) {
      return apiError(request, 404, "ACCOUNT_NOT_FOUND", "Cuenta no encontrada.");
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: session.userId },
    });
    if (!account) {
      return apiError(request, 404, "ACCOUNT_NOT_FOUND", "Cuenta no encontrada.");
    }
    if (account.status === "active") {
      return apiError(request, 409, "ACCOUNT_ACTIVE", "La cuenta ya está activa.");
    }

    const result = await prisma.account.updateMany({
      where: { id: accountId, userId: session.userId, status: "archived" },
      data: { status: "active", archivedAt: null },
    });
    if (result.count === 0) {
      return apiError(request, 409, "ACCOUNT_ACTIVE", "La cuenta ya está activa.");
    }

    const updated = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    return apiJson(request, accountData(updated));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(request, 409, "ACCOUNT_EXISTS", "Ya existe una cuenta activa con ese nombre.");
    }
    console.error("Falló la restauración de cuenta:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible restaurar la cuenta.");
  }
}
