import { useState, useCallback } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const success = useCallback((message: string) => show('success', message), [show]);
  const error = useCallback((message: string) => show('error', message), [show]);

  return { toasts, success, error, dismiss };
}

export function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-2 p-3.5 rounded-xl shadow-elevated animate-slide-up border ${
            toast.type === 'success'
              ? 'bg-white border-sage-100 text-sage-700'
              : 'bg-white border-rose-100 text-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-sage-600 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm flex-1">{toast.message}</span>
          <button onClick={() => dismiss(toast.id)} className="p-0.5 hover:bg-slate-100 rounded">
            <XCircle className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      ))}
    </div>
  );
}
