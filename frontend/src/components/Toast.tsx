import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/format';

type TipoToast = 'sucesso' | 'erro' | 'info';

interface Toast {
  id: number;
  tipo: TipoToast;
  mensagem: string;
}

interface ContextoToast {
  toast: (tipo: TipoToast, mensagem: string) => void;
}

const ToastContext = createContext<ContextoToast>({ toast: () => undefined });

export function useToast(): ContextoToast {
  return useContext(ToastContext);
}

const CORES: Record<TipoToast, string> = {
  sucesso: 'bg-green-600',
  erro: 'bg-red-600',
  info: 'bg-indigo-600',
};

const ICONES: Record<TipoToast, string> = {
  sucesso: 'fas fa-check-circle',
  erro: 'fas fa-exclamation-circle',
  info: 'fas fa-info-circle',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contador = useRef(0);

  const toast = useCallback((tipo: TipoToast, mensagem: string) => {
    const id = ++contador.current;
    setToasts((atuais) => [...atuais, { id, tipo, mensagem }]);
    setTimeout(() => setToasts((atuais) => atuais.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              CORES[t.tipo],
              'text-white text-sm rounded-lg shadow-lg px-4 py-3 flex items-start gap-2 animate-pulse-once',
            )}
            role="status"
          >
            <i className={cn(ICONES[t.tipo], 'mt-0.5')} />
            <span className="flex-1">{t.mensagem}</span>
            <button
              className="opacity-70 hover:opacity-100"
              onClick={() => setToasts((atuais) => atuais.filter((x) => x.id !== t.id))}
              aria-label="Fechar"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
