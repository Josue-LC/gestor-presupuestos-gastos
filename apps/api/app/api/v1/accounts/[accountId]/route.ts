import { NextRequest } from "next/server";
import { z } from "zod";
import {
  accountData,
  accountPatchSchema,
  dateOnly,
  decimal,
  hasActiveMovements,
  isUniqueViolation,
  ownsInstitution,
} from "@/lib/accounts";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  apiError,
  apiJson,
  originRejected,
  preflight,
  readJson,
} from "@/lib/http";

export const runtime = "nodejs";

type Context = { params: Promise<{ accountId: string }> };

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest, context: Context) {
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

    return apiJson(request, accountData(account));
  } catch (error) {
    console.error("Falló la consulta de cuenta:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible consultar la cuenta.");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
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
    if (account.status === "archived") {
      return apiError(request, 409, "ACCOUNT_ARCHIVED", "No puedes modificar una cuenta archivada.");
    }

    const parsed = accountPatchSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return apiError(request, 400, "INVALID_INPUT", "Datos de cuenta inválidos.");
    }

    if (!await ownsInstitution(session.userId, parsed.data.institutionId)) {
      return apiError(request, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");
    }

    const openingChanged = (
      parsed.data.openingBalance !== undefined &&
      account.openingBalance.toFixed(2) !== parsed.data.openingBalance
    ) || (
      parsed.data.openingDate !== undefined &&
      account.openingDate.toISOString().slice(0, 10) !== parsed.data.openingDate
    );
    if (openingChanged && await hasActiveMovements(session.userId, accountId)) {
      return apiError(request, 409, "ACCOUNT_HAS_MOVEMENTS", "La cuenta tiene movimientos activos; no se puede cambiar su saldo inicial ni fecha de apertura.");
    }

    const result = await prisma.account.updateMany({
      where: { id: accountId, userId: session.userId, status: "active" },
      data: {
        name: parsed.data.name,
        institutionId: parsed.data.institutionId,
        type: parsed.data.type,
        openingBalance: parsed.data.openingBalance === undefined
          ? undefined
          : decimal(parsed.data.openingBalance),
        openingDate: parsed.data.openingDate === undefined
          ? undefined
          : dateOnly(parsed.data.openingDate),
      },
    });
    if (result.count === 0) {
      return apiError(request, 409, "ACCOUNT_ARCHIVED", "No puedes modificar una cuenta archivada.");
    }

    const updated = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    return apiJson(request, accountData(updated));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(request, 409, "ACCOUNT_EXISTS", "Ya existe una cuenta activa con ese nombre.");
    }
    console.error("Falló la actualización de cuenta:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible actualizar la cuenta.");
  }
}
