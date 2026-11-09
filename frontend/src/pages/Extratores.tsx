import { useNavigate } from 'react-router-dom';

/**
 * Hub dos extratores de leads. Cada fonte tem página dedicada (mesmo padrão
 * desde a 0.1.10) — este hub apenas organiza os atalhos em um único lugar
 * (Lei de Miller: opções agrupadas em um bloco visual).
 */
const FONTES: { para: string; icone: string; titulo: string; descricao: string }[] = [
  {
    para: '/extrator-maps',
    icone: 'fas fa-map-marked-alt',
    titulo: 'Google Maps',
    descricao: 'Empresas por palavra-chave e localização. Sem scraper configurado, gera mock de 5–10 leads.',
  },
  {
    para: '/extrator-instagram',
    icone: 'fab fa-instagram',
    titulo: 'Instagram',
    descricao: 'Seguidores de um perfil público. Sem igmapper configurado, gera mock de 5–10 leads.',
  },
  {
    para: '/extrator-cnpj',
    icone: 'fas fa-building',
    titulo: 'CNPJ (B2B)',
    descricao: 'Empresas por CNAE + UF. Sem provedor configurado, gera mock de 5–10 empresas.',
  },
];

export function Extratores() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Selecione uma fonte de leads. Todas salvam diretamente em <strong>leads.json</strong>, na coluna{' '}
        <strong>"Novos Leads"</strong> do CRM — dados 100% locais.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FONTES.map((fonte) => (
          <button
            key={fonte.para}
            onClick={() => navigate(fonte.para)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-left space-y-3 hover:border-indigo-200 hover:shadow-md transition group"
          >
            <span className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg group-hover:bg-indigo-100">
              <i className={fonte.icone} />
            </span>
            <p className="text-sm font-semibold text-gray-800">{fonte.titulo}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{fonte.descricao}</p>
            <span className="text-xs font-medium text-indigo-600 group-hover:text-indigo-800">
              Abrir extrator <i className="fas fa-arrow-right ml-1" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
