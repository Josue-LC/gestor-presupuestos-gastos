import { Prisma } from "@/generated/prisma/client";
import { NextRequest } from "next/server";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  publicUser,
  sessionExpiresAt,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  apiError,
  apiJson,
  originRejected,
  preflight,
  readCredentials,
  setSessionCookie,
} from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  if (originRejected(request)) {
    return apiError(request, 403, "FORBIDDEN_ORIGIN", "Origen no autorizado.");
  }

  const parsed = await readCredentials(request);

  if (!parsed.success) {
    return apiError(request, 400, "INVALID_INPUT", "Correo o contraseña inválidos.");
  }

  const email = normalizeEmail(parsed.data.email);
  const passwordHash = await hashPassword(parsed.data.password);
  const token = createSessionToken();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash },
      });

      await tx.session.create({
        data: {
          userId: created.id,
          tokenHash: hashSessionToken(token),
          expiresAt: sessionExpiresAt(),
        },
      });

      return created;
    });

    const response = apiJson(request, publicUser(user), 201);
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(request, 409, "EMAIL_EXISTS", "El correo ya está registrado.");
    }

    console.error("Falló el registro de usuario:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible registrar al usuario.");
  }
}
