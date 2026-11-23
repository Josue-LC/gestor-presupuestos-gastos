import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiJson, preflight } from "@/lib/http";

export const runtime = "nodejs";

type Context = { params: Promise<{ accountId: string }> };

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await getSession(request);
    if (!session) return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");

    const { accountId } = await context.params;
    if (!z.uuid().safeParse(accountId).success) {
      return apiError(request, 404, "ACCOUNT_NOT_FOUND", "Cuenta no encontrada.");
    }
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: session.userId },
    });
    if (!account) return apiError(request, 404, "ACCOUNT_NOT_FOUND", "Cuenta no encontrada.");

    const requestedDate = request.nextUrl.searchParams.get("asOfDate");
    const asOfDate = requestedDate ?? new Date().toISOString().slice(0, 10);
    if (!z.iso.date().safeParse(asOfDate).success ||
        asOfDate < account.openingDate.toISOString().slice(0, 10)) {
      return apiError(request, 400, "INVALID_DATE", "Fecha de consulta inválida o anterior a la apertura de la cuenta.");
    }

    const rows = await prisma.$queryRaw<Array<{ delta: Prisma.Decimal | string | null }>>`
      SELECT COALESCE(SUM(CASE
        WHEN "type" = 'income' AND "destination_account_id" = ${accountId}::uuid THEN "amount"
        WHEN "type" = 'expense' AND "source_account_id" = ${accountId}::uuid THEN -"amount"
        WHEN "type" = 'transfer' AND "destination_account_id" = ${accountId}::uuid THEN "amount"
        WHEN "type" = 'transfer' AND "source_account_id" = ${accountId}::uuid THEN -"amount"
        ELSE 0::numeric
      END), 0::numeric) AS "delta"
      FROM "transactions"
      WHERE "user_id" = ${session.userId}::uuid
        AND "status" = 'active'
        AND "operation_date" >= ${account.openingDate.toISOString().slice(0, 10)}::date
        AND "operation_date" <= ${asOfDate}::date
        AND ("source_account_id" = ${accountId}::uuid OR "destination_account_id" = ${accountId}::uuid)
    `;
    const delta = new Prisma.Decimal(rows[0]?.delta?.toString() ?? "0");

    return apiJson(request, {
      accountId,
      asOfDate,
      currency: account.currency,
      balance: account.openingBalance.plus(delta).toFixed(2),
    });
  } catch (error) {
    console.error("Falló el cálculo de saldo:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible calcular el saldo.");
  }
}
