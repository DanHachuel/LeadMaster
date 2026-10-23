import { useState, type ReactNode } from 'react';
import { cn } from '../lib/format';

interface Props {
  titulo: string;
  icone?: string;
  children: ReactNode;
  abertoInicial?: boolean;
}

/**
 * Accordion (Lei de Hick): esconde configurações avançadas e detalhes para
 * não sobrecarregar a escolha do usuário.
 */
export function Accordion({ titulo, icone = 'fas fa-sliders', children, abertoInicial = false }: Props) {
  const [aberto, setAberto] = useState(abertoInicial);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition"
      >
        <span className="flex items-center gap-2">
          <i className={cn(icone, 'text-gray-400')} /> {titulo}
        </span>
        <i className={cn('fas fa-chevron-down text-xs text-gray-400 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && <div className="px-4 py-4 bg-white space-y-3">{children}</div>}
    </div>
  );
}
