import type { ReactNode } from 'react';

interface Props {
  rotulo: string;
  valor?: ReactNode;
  subtitulo?: string;
  children?: ReactNode;
  icone?: string;
}

/**
 * Card de métrica (Lei de Miller): agrupa uma métrica relacionada em um único
 * bloco visual, fiel ao protótipo (bg-white rounded-xl shadow-sm p-5).
 */
export function MetricCard({ rotulo, valor, subtitulo, children, icone }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">{rotulo}</p>
        {icone && <i className={`${icone} text-indigo-300`} />}
      </div>
      {children ?? (
        <>
          <p className="text-2xl font-bold text-gray-800 mt-1">{valor}</p>
          {subtitulo && <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>}
        </>
      )}
    </div>
  );
}
