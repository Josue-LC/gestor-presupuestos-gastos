import { Prisma, type Account, type Institution } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

const moneySchema = z.string().regex(
  /^-?(?:0|[1-9]\d{0,15})\.\d{2}$/,
  "El importe debe tener dos decimales y caber en DECIMAL(18,2).",
);

const accountFields = {
  name: z.string().trim().min(1).max(120),
  institutionId: z.uuid().nullable().optional(),
  type: z.enum(["checking", "savings", "cash", "investment", "other"]),
  openingBalance: moneySchema,
  openingDate: z.iso.date(),
};

export const accountInputSchema = z.strictObject(accountFields);

export const accountPatchSchema = z.strictObject({
  name: accountFields.name.optional(),
  institutionId: accountFields.institutionId,
  type: accountFields.type.optional(),
  openingBalance: accountFields.openingBalance.optional(),
  openingDate: accountFields.openingDate.optional(),
}).refine((data) => Object.keys(data).length > 0);

export const institutionInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
});

export const accountStatusSchema = z.enum(["active", "archived"]);

export function accountData(account: Account) {
  return {
    id: account.id,
    institutionId: account.institutionId,
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalance: account.openingBalance.toFixed(2),
    openingDate: account.openingDate.toISOString().slice(0, 10),
    status: account.status,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    archivedAt: account.archivedAt?.toISOString() ?? null,
  };
}

export function institutionData(institution: Institution) {
  return {
    id: institution.id,
    name: institution.name,
    createdAt: institution.createdAt.toISOString(),
  };
}

export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function ownsInstitution(
  userId: string,
  institutionId: string | null | undefined,
): Promise<boolean> {
  if (!institutionId) return true;

  const institution = await prisma.institution.findFirst({
    where: { id: institutionId, userId },
    select: { id: true },
  });

  return institution !== null;
}

export async function hasActiveMovements(userId: string, accountId: string) {
  return (await prisma.transaction.count({
    where: {
      userId,
      status: "active",
      OR: [
        { sourceAccountId: accountId },
        { destinationAccountId: accountId },
      ],
    },
  })) > 0;
}
