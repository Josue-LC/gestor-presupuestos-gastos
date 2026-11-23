import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  apiError,
  clearSessionCookie,
  originRejected,
  preflight,
  withCors,
} from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(request: NextRequest) {
  return preflight(request);
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

    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const response = withCors(request, new NextResponse(null, { status: 204 }));
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error("Falló el cierre de sesión:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible cerrar sesión.");
  }
}
