import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Lead } from '../lib/types';
import { Accordion } from '../components/Accordion';
import { ProgressBar } from '../components/ProgressBar';
import { useToast } from '../components/Toast';
import { cn, mascararTelefone } from '../lib/format';

/**
 * Extrator de Leads (Instagram): mesmo padrão de UX do Extrator Maps —
 * formulário limpo (Lei de Hick), botão primário em gradiente (von Restorff),
 * barra de progresso durante a extração (Zeigarnik) e tabela de resultados
 * com atalho para o CRM Kanban.
 */
export function ExtratorInstagram() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profileUrl, setProfileUrl] = useState('');
  const [limit, setLimit] = useState(10);
  const [apenasComerciais, setApenasComerciais] = useState(false);
  const [minSeguidores, setMinSeguidores] = useState(500);
  const [extraindo, setExtraindo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<Lead[] | null>(null);
  const [origem, setOrigem] = useState('');

  const extrair = async () => {
    if (!profileUrl.includes('instagram.com')) {
      toast('erro', 'Informe a URL do perfil (ex.: https://instagram.com/perfil).');
      return;
    }
    setExtraindo(true);
    setResultados(null);
    setProgresso(8);

    const animacao = setInterval(() => {
      setProgresso((p) => (p < 85 ? p + Math.ceil((90 - p) / 6) : 85));
    }, 90);

    try {
      const r = await api.extrair.instagram(profileUrl.trim(), limit);
      clearInterval(animacao);
      setProgresso(100);
      setResultados(r.importados);
      setOrigem(r.origem === 'cli' ? 'igmapper real' : 'mock de teste');
      const aviso = r.duplicados > 0 ? ` · ${r.duplicados} duplicados ignorados` : '';
      const obs = r.aviso ? ` · ${r.aviso}` : '';
      toast('sucesso', `${r.importados.length} leads extraídos (${r.origem === 'cli' ? 'igmapper real' : 'mock'})${aviso}${obs}`);
    } catch (e) {
      clearInterval(animacao);
      setProgresso(0);
      toast('erro', e instanceof Error ? e.message : 'Falha na extração.');
    } finally {
      setExtraindo(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-gray-500">
            Extraia seguidores de um perfil público do Instagram. Sem igmapper configurado, o LeadMaster gera
            <strong> dados mockados (5–10 leads)</strong> para teste — sem risco de bloqueio de conta.
          </p>
          <span className="text-xs shrink-0 text-gray-400">
            <i className="fas fa-shield-halved mr-1" /> perfis públicos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">URL do perfil *</label>
            <input
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://instagram.com/perfil_do_concorrente/"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade de seguidores: {limit}</label>
            <input
              type="range"
              min={5}
              max={10}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full accent-indigo-500 mt-2"
            />
          </div>
        </div>

        {/* Botão primário — maior destaque da tela (von Restorff + Fitts) */}
        <button
          onClick={extrair}
          disabled={extraindo}
          className="w-full md:w-auto px-8 py-3.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition disabled:opacity-60 shadow-sm"
        >
          <i className={cn('fab fa-instagram mr-2', extraindo && 'fa-spin')} />
          {extraindo ? 'Buscando seguidores...' : 'Iniciar Extração'}
        </button>

        {/* Zeigarnik: progresso visível durante a extração */}
        {(extraindo || progresso > 0) && (
          <div className="space-y-1">
            <ProgressBar valor={progresso} />
            <p className="text-xs text-indigo-600 font-medium">
              {progresso < 100 ? 'Buscando seguidores no Instagram...' : 'Extração concluída ✓'}
            </p>
          </div>
        )}

        {/* Lei de Hick: opções avançadas escondidas em accordion */}
        <Accordion titulo="Configurações avançadas" icone="fas fa-sliders">
          <label className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={apenasComerciais}
              onChange={(e) => setApenasComerciais(e.target.checked)}
              className="w-4 h-4 accent-indigo-500"
            />
            Extrair apenas contas comerciais
          </label>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mínimo de seguidores: {minSeguidores}</label>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={minSeguidores}
              onChange={(e) => setMinSeguidores(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            As opções avançadas aplicam-se ao igmapper real (lucasoal/igmapper), quando configurado
            em Ferramentas → Extratores. No modo mock elas são ignoradas.
          </p>
        </Accordion>
      </div>

      {/* Resultados */}
      {resultados && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-700">
              {resultados.length} lead(s) extraído(s) · origem: <span className="text-indigo-600">{origem}</span>
            </p>
            <button
              onClick={() => navigate('/crm')}
              className="px-5 py-2 text-xs font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50"
            >
              <i className="fas fa-columns mr-1" /> Ir para o CRM
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-5 py-2 font-semibold">Nome / Username</th>
                  <th className="px-5 py-2 font-semibold">Telefone</th>
                  <th className="px-5 py-2 font-semibold">Fonte</th>
                  <th className="px-5 py-2 font-semibold">Seguidores</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((lead, i) => {
                  const username = (lead.extras?.username as string | undefined) || '';
                  const seguidores = lead.extras?.seguidores as number | undefined;
                  return (
                    <tr key={lead.id || i} className="border-b border-gray-50 hover:bg-indigo-50/40">
                      <td className="px-5 py-2.5 text-gray-800">
                        {lead.nome}
                        {username && <span className="text-xs text-gray-400 ml-2">@{username}</span>}
                      </td>
                      <td className="px-5 py-2.5 text-gray-600">{mascararTelefone(lead.telefone)}</td>
                      <td className="px-5 py-2.5">
                        <span className="text-[10px] uppercase tracking-wide bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded font-medium">
                          {lead.fonte}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-400">
                        {seguidores !== undefined ? seguidores.toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => navigate('/crm')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <i className="fas fa-arrow-right mr-1" /> Ver todos os leads no CRM Kanban
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
