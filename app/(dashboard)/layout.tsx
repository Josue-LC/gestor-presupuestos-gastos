
"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { AlertProvider } from "@/context/AlertContext";
import AlertContainer from "@/components/ui/AlertContainer";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileMenuOpen]);

  return (
    <AlertProvider>
      <div className="min-h-screen bg-background md:flex">
        {/* Sidebar escritorio */}
        <div className="hidden md:block">
          <div className="fixed inset-y-0 left-0 z-40">
            <Sidebar />
          </div>
        </div>

        {/* Menú móvil */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />

            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-in slide-in-from-left duration-200">
              <Sidebar
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Contenido principal */}
        <div className="min-w-0 flex-1 md:ml-72">
          <Header
            onMenuClick={() => setIsMobileMenuOpen(true)}
          />

          <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            {children}
          </main>
        </div>
      </div>

      {/* Alertas globales */}
      <AlertContainer />
    </AlertProvider>
  );
}
