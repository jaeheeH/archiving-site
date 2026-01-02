"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<any>(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCountRef = useRef(0); // 🆕 고유 ID 생성용 카운터

  // 토스트 생성
  const addToast = useCallback((message: string, type: ToastType = "success") => {
    // 🆕 고유 ID 생성: timestamp + counter
    // 예: "1767351288447-1", "1767351288447-2", "1767351288448-1"
    const id = `${Date.now()}-${++toastCountRef.current}`;
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    // 자동 삭제 (3초 후)
    setTimeout(() => removeToast(id), 3000);
  }, []);

  // 즉시 삭제
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const icons = {
    success: "ri-checkbox-circle-line",
    error: "ri-close-circle-line",
    warning: "ri-alert-line",
    info: "ri-information-line",
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 flex flex-col-reverse gap-3 z-[9999]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              toast-ui relative flex items-center justify-between gap-3 
              px-4 py-4 rounded shadow-lg text-white animate-slide-in min-w-[260px]
              toast-${toast.type}
            `}
          >
            <div className="toast-contents">
              <div className="toast-title flex gap-2">
                <span className="toastIcon">
                  <i className={icons[toast.type]}></i>
                </span>
                <span>{toast.message}</span>
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-white/80 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}