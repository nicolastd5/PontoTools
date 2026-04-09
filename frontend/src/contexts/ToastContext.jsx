import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((msg) => show(msg, 'success'), [show]);
  const error   = useCallback((msg) => show(msg, 'error', 6000), [show]);
  const warning = useCallback((msg) => show(msg, 'warning'), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, warning }}>
      {children}

      {/* Container de toasts — canto inferior direito */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxWidth: 360,
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding:      '12px 16px',
            borderRadius: 8,
            color:        '#fff',
            fontSize:     14,
            fontWeight:   500,
            boxShadow:    '0 4px 12px rgba(0,0,0,0.15)',
            background:
              t.type === 'success' ? '#16a34a' :
              t.type === 'error'   ? '#dc2626' :
              t.type === 'warning' ? '#d97706' : '#2563eb',
            animation: 'slideIn 0.2s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
