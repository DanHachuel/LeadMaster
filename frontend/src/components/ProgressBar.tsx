import { cn } from '../lib/format';

interface Props {
  valor: number; // 0-100
  altura?: 'sm' | 'md';
  mostrarLabel?: boolean;
  className?: string;
}

/**
 * Barra de progresso com gradiente indigo/purple (Efeito Zeigarnik + Gradiente
 * de Meta): torna as tarefas incompletas visíveis e motiva a conclusão.
 */
export function ProgressBar({ valor, altura = 'md', mostrarLabel = false, className }: Props) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  const alturas = { sm: 'h-1.5', md: 'h-2.5' } as const;
  return (
    <div className={cn('w-full', className)}>
      {mostrarLabel && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progresso</span>
          <span className="font-semibold text-gray-700">{v}%</span>
        </div>
      )}
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', alturas[altura])}>
        <div
          className={cn('h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500')}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
