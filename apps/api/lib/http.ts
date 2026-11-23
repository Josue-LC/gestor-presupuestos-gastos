import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

export const credentialsSchema = z.strictObject({
  email: z.email().max(320),
  password: z.string().min(12).max(128),
});

function allowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");

  if (!origin) return null;

  const isProduction = process.env.NODE_ENV === "production";
  const apiOrigin = process.env.API_ORIGIN ??
    (isProduction ? undefined : new URL(request.url).origin);
  const webOrigin = process.env.WEB_ORIGIN ??
    (isProduction ? undefined : "http://localhost:3000");

  return origin === apiOrigin || origin === webOrigin ? origin : null;
}

export function originRejected(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (origin) return allowedOrigin(request) === null;

  return request.headers.get("sec-fetch-site") === "cross-site";
}

export function withCors(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const origin = allowedOrigin(request);

  response.headers.set("Vary", "Origin");
  response.headers.set("Cache-Control", "no-store");

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export function preflight(request: NextRequest): NextResponse {
  if (originRejected(request)) {
    return apiError(request, 403, "FORBIDDEN_ORIGIN", "Origen no autorizado.");
  }

  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "600");

  return withCors(request, response);
}

export function apiJson(
  request: NextRequest,
  body: unknown,
  status = 200,
): NextResponse {
  return withCors(request, NextResponse.json(body, { status }));
}

export function apiError(
  request: NextRequest,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return apiJson(request, { code, message }, status);
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function readCredentials(request: NextRequest) {
  try {
    return credentialsSchema.safeParse(await request.json());
  } catch {
    return credentialsSchema.safeParse(null);
  }
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
