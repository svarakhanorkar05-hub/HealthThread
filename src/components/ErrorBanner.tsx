import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onClose?: () => void;
}

export function ErrorBanner({ message, onClose }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm animate-fade-in">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="p-0.5 hover:bg-rose-100 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
