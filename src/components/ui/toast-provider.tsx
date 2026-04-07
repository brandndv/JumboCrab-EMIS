"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
};

type ToastRecord = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastOptions = {
  description?: string;
  duration?: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
  success: (title: string, options?: ToastOptions) => void;
  error: (title: string, options?: ToastOptions) => void;
  info: (title: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<
  ToastVariant,
  {
    container: string;
    iconWrap: string;
    iconColor: string;
  }
> = {
  success: {
    container: "border-success/20 bg-card/95",
    iconWrap: "bg-success/15",
    iconColor: "text-success",
  },
  error: {
    container: "border-destructive/25 bg-card/95",
    iconWrap: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  info: {
    container: "border-primary/20 bg-card/95",
    iconWrap: "bg-primary/10",
    iconColor: "text-primary",
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: () => void;
}) {
  const Icon =
    toast.variant === "success"
      ? CheckCircle2
      : toast.variant === "error"
        ? CircleAlert
        : Info;
  const styles = toastStyles[toast.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto animate-in slide-in-from-top-3 fade-in-0 relative overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur",
        styles.container,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            styles.iconWrap,
          )}
        >
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{toast.title}</p>
          {toast.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timeoutId = timersRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      for (const timeoutId of timers.values()) {
        window.clearTimeout(timeoutId);
      }
      timers.clear();
    };
  }, []);

  const showToast = useCallback(
    ({
      title,
      description,
      duration = 4000,
      variant = "info",
    }: ToastInput) => {
      const id = nextIdRef.current++;

      setToasts((current) => [
        ...current,
        {
          id,
          title,
          description,
          variant,
        },
      ]);

      const timeoutId = window.setTimeout(() => {
        dismissToast(id);
      }, duration);
      timersRef.current.set(id, timeoutId);
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (title, options) =>
        showToast({
          title,
          description: options?.description,
          duration: options?.duration,
          variant: "success",
        }),
      error: (title, options) =>
        showToast({
          title,
          description: options?.description,
          duration: options?.duration,
          variant: "error",
        }),
      info: (title, options) =>
        showToast({
          title,
          description: options?.description,
          duration: options?.duration,
          variant: "info",
        }),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4 sm:justify-end">
        <div className="flex w-full max-w-sm flex-col gap-3">
          {toasts.map((toast) => (
            <ToastCard
              key={toast.id}
              toast={toast}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
