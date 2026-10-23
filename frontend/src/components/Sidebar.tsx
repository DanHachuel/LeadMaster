import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { cn } from '../lib/format';

interface Props {
  onSair: () => void;
}

interface ItemNav {
  para: string;
  icone: string;
  rotulo: string;
  fim?: boolean;
}

const NAVEGACAO: { secao?: string; itens: ItemNav[] }[] = [
  { itens: [{ para: '/', icone: 'fas fa-chart-pie text-indigo-300', rotulo: 'Painel', fim: true }] },
  {
    secao: 'Conexões',
    itens: [
      { para: '/leads', icone: 'fas fa-users', rotulo: 'Leads' },
      { para: '/agentes', icone: 'fas fa-robot', rotulo: 'Agentes' },
      { para: '/ferramentas', icone: 'fas fa-tools', rotulo: 'Ferramentas' },
    ],
  },
  {
    itens: [
      { para: '/extratores?tab=maps', icone: 'fas fa-map-marked-alt', rotulo: 'Extrator Maps' },
      { para: '/extratores?tab=instagram', icone: 'fab fa-instagram', rotulo: 'Extrator Instagram' },
      { para: '/extratores?tab=cnpj', icone: 'fas fa-building', rotulo: 'Extrator CNPJ' },
    ],
  },
  {
    secao: 'Gestão',
    itens: [
      { para: '/disparos', icone: 'fas fa-bullhorn', rotulo: 'Disparos' },
      { para: '/crm', icone: 'fas fa-columns', rotulo: 'CRM' },
      { para: '/pipeline', icone: 'fas fa-video', rotulo: 'Pipeline de Vídeos' },
    ],
  },
  {
    secao: 'Integrações',
    itens: [
      { para: '/webhook', icone: 'fas fa-link', rotulo: 'Webhook' },
      { para: '/suporte', icone: 'fas fa-headset', rotulo: 'Suporte' },
    ],
  },
];

/** Sidebar fixa escura (#1e1b4b) — réplica fiel do protótipo LeadMaster v1.0. */
export function Sidebar({ onSair }: Props) {
  const local = useLocation();
  const [agentesAberto, setAgentesAbertos] = useState(false);

  useEffect(() => {
    if (local.pathname === '/agentes') setAgentesAbertos(true);
  }, [local.pathname]);

  const ehAtivo = (item: ItemNav): boolean => {
    if (item.rotulo === 'Agentes') return local.pathname === '/agentes';
    const [pathname, search] = item.para.split('?');
    if (search) return local.pathname === pathname && local.search.includes(search);
    return item.fim ? local.pathname === pathname : local.pathname.startsWith(pathname);
  };

  return (
    <aside className="w-64 bg-[#1e1b4b] text-white flex flex-col shrink-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <span className="text-2xl">⚡</span>LeadMaster
        </h1>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1">
          {NAVEGACAO.map((grupo, gi) => (
            <li key={gi}>
              <ul>
                {grupo.secao && (
                  <li className="px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider list-none">
                    {grupo.secao}
                  </li>
                )}
                {grupo.itens.map((item) =>
                  item.rotulo === 'Agentes' ? (
                    <li key="agentes">
                      <button
                        type="button"
                        onClick={() => setAgentesAbertos((a) => !a)}
                        className={cn('sidebar-link w-full flex items-center px-6 py-2.5 text-sm', ehAtivo(item) && 'active')}
                      >
                        <i className={cn(item.icone, 'w-5 text-gray-400')} />
                        <span className="ml-3">{item.rotulo}</span>
                        <i
                          className={cn(
                            'fas fa-chevron-down ml-auto text-xs text-gray-400 transition-transform',
                            agentesAberto && 'rotate-180',
                          )}
                        />
                      </button>
                      {agentesAberto && (
                        <ul className="pl-12 space-y-1 mt-1">
                          <li>
                            <LinkSub
                              para="/agentes?tab=disparo"
                              rotulo="Agente de Disparo"
                              ativo={local.pathname === '/agentes' && local.search.includes('disparo')}
                            />
                          </li>
                          <li>
                            <LinkSub
                              para="/agentes?tab=atendimento"
                              rotulo="Agente de Atendimento"
                              ativo={local.pathname === '/agentes' && local.search.includes('atendimento')}
                            />
                          </li>
                        </ul>
                      )}
                    </li>
                  ) : (
                    <li key={item.para}>
                      <NavLink to={item.para} className={cn('sidebar-link flex items-center px-6 py-2.5 text-sm', ehAtivo(item) && 'active')}>
                        <i className={cn(item.icone, 'w-5 text-gray-400')} />
                        <span className="ml-3">{item.rotulo}</span>
                      </NavLink>
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* Botão Sair */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onSair}
          className="w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <i className="fas fa-sign-out-alt mr-2" /> Sair
        </button>
      </div>
    </aside>
  );
}

function LinkSub({ para, rotulo, ativo }: { para: string; rotulo: string; ativo: boolean }) {
  return (
    <NavLink to={para} className={cn('sidebar-link block px-4 py-2 text-xs text-gray-300 rounded', ativo && 'active')}>
      {rotulo}
    </NavLink>
  );
}
