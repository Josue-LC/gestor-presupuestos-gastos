import { NextRequest } from "next/server";
import {
  institutionData,
  institutionInputSchema,
  isUniqueViolation,
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

    const institutions = await prisma.institution.findMany({
      where: { userId: session.userId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return apiJson(request, institutions.map(institutionData));
  } catch (error) {
    console.error("Falló la consulta de instituciones:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible consultar las instituciones.");
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

    const parsed = institutionInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return apiError(request, 400, "INVALID_INPUT", "Nombre de institución inválido.");
    }

    const institution = await prisma.institution.create({
      data: { userId: session.userId, name: parsed.data.name },
    });

    return apiJson(request, institutionData(institution), 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(request, 409, "INSTITUTION_EXISTS", "Ya existe una institución con ese nombre.");
    }
    console.error("Falló la creación de institución:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible crear la institución.");
  }
}
