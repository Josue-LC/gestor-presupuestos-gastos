import { NextRequest } from "next/server";
import {
  accountData,
  accountInputSchema,
  accountStatusSchema,
  dateOnly,
  decimal,
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

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");
    }

    const statusInput = request.nextUrl.searchParams.get("status");
    const status = statusInput === null ? null : accountStatusSchema.safeParse(statusInput);
    if (status !== null && !status.success) {
      return apiError(request, 400, "INVALID_STATUS", "Estado de cuenta inválido.");
    }

    const accounts = await prisma.account.findMany({
      where: {
        userId: session.userId,
        ...(status?.success ? { status: status.data } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return apiJson(request, accounts.map(accountData));
  } catch (error) {
    console.error("Falló la consulta de cuentas:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible consultar las cuentas.");
  }
}

export async function POST(request: NextRequest) {
  if (originRejected(request)) {
    return apiError(request, 403, "FORBIDDEN_ORIGIN", "Origen no autorizado.");
  }

  try {
    const session = await getSession(request);
    if (!session) {
      return apiError(request, 401, "UNAUTHORIZED", "Sesión inválida o vencida.");
    }

    const parsed = accountInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return apiError(request, 400, "INVALID_INPUT", "Datos de cuenta inválidos.");
    }

    if (!await ownsInstitution(session.userId, parsed.data.institutionId)) {
      return apiError(request, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");
    }

    const account = await prisma.account.create({
      data: {
        userId: session.userId,
        institutionId: parsed.data.institutionId ?? null,
        name: parsed.data.name,
        type: parsed.data.type,
        openingBalance: decimal(parsed.data.openingBalance),
        openingDate: dateOnly(parsed.data.openingDate),
      },
    });

    return apiJson(request, accountData(account), 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(request, 409, "ACCOUNT_EXISTS", "Ya existe una cuenta activa con ese nombre.");
    }
    console.error("Falló la creación de cuenta:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible crear la cuenta.");
  }
}
