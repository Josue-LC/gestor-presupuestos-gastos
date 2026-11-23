import { NextRequest } from "next/server";
import {
  createSessionToken,
  hashSessionToken,
  normalizeEmail,
  publicUser,
  sessionExpiresAt,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getLoginLock,
  identifierHashForEmail,
  recordLoginFailure,
  retryAfterSeconds,
} from "@/lib/login-attempts";
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

function tooManyAttempts(request: NextRequest, lockedUntil: Date) {
  const response = apiError(
    request,
    429,
    "TOO_MANY_ATTEMPTS",
    "Demasiados intentos. Intenta más tarde.",
  );
  response.headers.set("Retry-After", String(retryAfterSeconds(lockedUntil)));
  return response;
}

export async function POST(request: NextRequest) {
  if (originRejected(request)) {
    return apiError(request, 403, "FORBIDDEN_ORIGIN", "Origen no autorizado.");
  }

  const parsed = await readCredentials(request);

  if (!parsed.success) {
    return apiError(request, 400, "INVALID_INPUT", "Correo o contraseña inválidos.");
  }

  try {
    const email = normalizeEmail(parsed.data.email);
    const existingLock = await getLoginLock(email);

    if (existingLock) {
      return tooManyAttempts(request, existingLock);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    const validPassword = await verifyPassword(
      user?.passwordHash ?? null,
      parsed.data.password,
    );

    if (!user || !validPassword) {
      const newLock = await recordLoginFailure(email);
      if (newLock) {
        return tooManyAttempts(request, newLock);
      }
      return apiError(request, 401, "INVALID_CREDENTIALS", "Credenciales incorrectas.");
    }

    const token = createSessionToken();

    await prisma.$transaction([
      prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashSessionToken(token),
          expiresAt: sessionExpiresAt(),
        },
      }),
      prisma.loginAttempt.deleteMany({
        where: { identifierHash: identifierHashForEmail(email) },
      }),
    ]);

    const response = apiJson(request, publicUser(user));
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Falló el inicio de sesión:", error);
    return apiError(request, 500, "INTERNAL_ERROR", "No fue posible iniciar sesión.");
  }
}
