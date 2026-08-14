import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3200);
  }, [removeToast]);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast]);
  const info = useCallback((msg: string) => toast(msg, 'info'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-fade-up"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              border: t.type === 'success'
                ? '1px solid var(--success-border)'
                : t.type === 'error'
                ? '1px solid var(--critical-border)'
                : '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow-elevated)',
              color: 'var(--primary)',
              fontSize: '12.5px',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {t.type === 'success' && <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink: 0 }} />}
            {t.type === 'error' && <AlertTriangle size={15} color="var(--critical)" style={{ flexShrink: 0 }} />}
            {t.type === 'info' && <Info size={15} color="var(--accent)" style={{ flexShrink: 0 }} />}

            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>

            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
};
