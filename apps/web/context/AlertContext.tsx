
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import type { ReactNode } from "react";

export type AlertType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  message: string;
  type?: AlertType;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  type?: AlertType;
  onConfirm: () => void | Promise<void>;
}

interface AlertContextType {
  toastMessage: ToastOptions | null;
  confirmDialog: ConfirmOptions | null;

  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };

  confirm: (options: ConfirmOptions) => void;
  closeToast: () => void;
  closeConfirm: () => void;
  executeConfirm: () => Promise<void>;
}

const AlertContext = createContext<AlertContextType | undefined>(
  undefined,
);

export function AlertProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [toastMessage, setToastMessage] =
    useState<ToastOptions | null>(null);

  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmOptions | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    setToastMessage(options);
  }, []);

  const closeToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmDialog(options);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const executeConfirm = useCallback(async () => {
    if (!confirmDialog) return;

    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (error) {
      console.error("Error al ejecutar la confirmación:", error);
    }
  }, [confirmDialog]);

  const toast = {
    success: (message: string, title?: string) =>
      showToast({ message, title, type: "success" }),

    error: (message: string, title?: string) =>
      showToast({ message, title, type: "error" }),

    warning: (message: string, title?: string) =>
      showToast({ message, title, type: "warning" }),

    info: (message: string, title?: string) =>
      showToast({ message, title, type: "info" }),
  };

  const value: AlertContextType = {
    toastMessage,
    confirmDialog,
    toast,
    confirm,
    closeToast,
    closeConfirm,
    executeConfirm,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);

  if (!context) {
    throw new Error(
      "useAlert debe utilizarse dentro de un AlertProvider.",
    );
  }

  return context;
}
