import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gestor de Presupuestos",
    template: "%s | Gestor de Presupuestos",
  },
  description:
    "Administra tus cuentas, ingresos, gastos y presupuestos desde un solo lugar.",
  applicationName: "Gestor de Presupuestos",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
