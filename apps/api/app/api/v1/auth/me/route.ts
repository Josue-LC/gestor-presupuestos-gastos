import { NextRequest } from "next/server";
import { getSession, publicUser } from "@/lib/auth";
import { apiError, apiJson, preflight } from "@/lib/http";

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

    return apiJson(request, publicUser(session.user));
  } catch (error) {
    console.error("Falló la consulta de sesión:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible consultar la sesión.");
  }
}
