
import type { Bank } from "@/types/account";

export const banksData: Bank[] = [
  {
    id: "bbva",
    name: "BBVA",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "nu",
    name: "NU",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "klar",
    name: "Klar",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "santander",
    name: "Santander",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "banorte",
    name: "Banorte",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "citibanamex",
    name: "Citibanamex",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "hsbc",
    name: "HSBC",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "scotiabank",
    name: "Scotiabank",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "banco-azteca",
    name: "Banco Azteca",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "banregio",
    name: "Banregio",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "hey-banco",
    name: "Hey Banco",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mercado-pago",
    name: "Mercado Pago",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "nu-financiera",
    name: "Nu Financiera",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "inbursa",
    name: "Inbursa",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "banco-del-bajio",
    name: "Banco del Bajío",
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export function getBankById(bankId: string): Bank | undefined {
  return banksData.find((bank) => bank.id === bankId);
}

export function getBankName(bankId: string | null): string {
  if (!bankId) return "Sin institución bancaria";

  return getBankById(bankId)?.name ?? "Banco no identificado";
}
