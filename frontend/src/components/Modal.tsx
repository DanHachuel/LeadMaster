import { useEffect, type ReactNode } from 'react';
import { cn } from '../lib/format';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
  icone?: string;
  largura?: 'md' | 'lg' | 'xl';
}

const LARGURAS = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/** Modal do LeadMaster: overlay + card branco, fiel ao tema do protótipo. */
export function Modal({ aberto, onFechar, titulo, children, icone = 'fas fa-circle-info', largura = 'md' }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    if (aberto) window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className={cn('bg-white rounded-2xl shadow-xl w-full', LARGURAS[largura])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <i className={cn(icone, 'text-indigo-500')} /> {titulo}
          </h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
