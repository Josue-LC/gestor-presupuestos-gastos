
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAlert } from "@/context/AlertContext";

const alertStyles = {
  success: {
    icon: CheckCircle2,
    color: "text-emerald-700",
    background: "bg-emerald-100",
    border: "border-emerald-200",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-700",
    background: "bg-red-100",
    border: "border-red-200",
  },
  warning: {
    icon: TriangleAlert,
    color: "text-amber-700",
    background: "bg-amber-100",
    border: "border-amber-200",
  },
  info: {
    icon: Info,
    color: "text-blue-700",
    background: "bg-blue-100",
    border: "border-blue-200",
  },
};

export default function AlertContainer() {
  const {
    toastMessage,
    confirmDialog,
    closeToast,
    closeConfirm,
    executeConfirm,
  } = useAlert();

  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;

    const timeout = window.setTimeout(() => {
      closeToast();
    }, toastMessage.duration ?? 4000);

    return () => window.clearTimeout(timeout);
  }, [toastMessage, closeToast]);

  useEffect(() => {
    if (!confirmDialog) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isConfirming) {
        closeConfirm();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [confirmDialog, closeConfirm, isConfirming]);

  const handleConfirm = async () => {
    if (isConfirming) return;

    setIsConfirming(true);

    try {
      await executeConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const toastType = toastMessage?.type ?? "info";
  const toastStyle = alertStyles[toastType];
  const ToastIcon: LucideIcon = toastStyle.icon;

  const confirmType = confirmDialog?.type ?? "warning";
  const confirmStyle = alertStyles[confirmType];
  const ConfirmIcon: LucideIcon = confirmStyle.icon;

  return (
    <>
      {/* Notificación Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-top-2 fade-in duration-200"
        >
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toastStyle.background}`}
            >
              <ToastIcon
                size={20}
                className={toastStyle.color}
              />
            </div>

            <div className="min-w-0 flex-1">
              {toastMessage.title && (
                <p className="text-sm font-semibold text-gray-900">
                  {toastMessage.title}
                </p>
              )}

              <p className="text-sm text-gray-600">
                {toastMessage.message}
              </p>
            </div>

            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={closeToast}
              className="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isConfirming
            ) {
              closeConfirm();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            className="w-full max-w-md animate-in zoom-in-95 fade-in duration-150 rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${confirmStyle.background}`}
              >
                <ConfirmIcon
                  size={22}
                  className={confirmStyle.color}
                />
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  id="alert-dialog-title"
                  className="text-base font-semibold text-gray-900"
                >
                  {confirmDialog.title}
                </h2>

                <p
                  id="alert-dialog-description"
                  className="mt-2 text-sm leading-relaxed text-gray-600"
                >
                  {confirmDialog.description}
                </p>
              </div>

              <button
                type="button"
                aria-label="Cerrar diálogo"
                disabled={isConfirming}
                onClick={closeConfirm}
                className="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isConfirming}
                onClick={closeConfirm}
                className="rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmDialog.cancelText ?? "Volver"}
              </button>

              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirm}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  confirmType === "error"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmType === "warning"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isConfirming
                  ? "Procesando..."
                  : confirmDialog.confirmText ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
