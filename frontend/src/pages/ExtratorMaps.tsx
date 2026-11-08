import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Lead } from '../lib/types';
import { Accordion } from '../components/Accordion';
import { ProgressBar } from '../components/ProgressBar';
import { useToast } from '../components/Toast';
import { cn, mascararTelefone } from '../lib/format';

/**
 * Extrator de Leads (Google Maps): formulário limpo (Lei de Hick), botão
 * primário em gradiente (von Restorff), barra de progresso durante a extração
 * (Zeigarnik) e tabela de resultados com atalho para o CRM Kanban.
 */
export function ExtratorMaps() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(10);
  const [raio, setRaio] = useState(5);
  const [apenasAvaliados, setApenasAvaliados] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<Lead[] | null>(null);
  const [origem, setOrigem] = useState('');

  const extrair = async () => {
    if (keyword.trim().length < 2 || location.trim().length < 2) {
      toast('erro', 'Preencha a palavra-chave e a localização (ex.: "Dentista", "Rio de Janeiro").');
      return;
    }
    setExtraindo(true);
    setResultados(null);
    setProgresso(8);

    // Animação de progresso enquanto a extração ocorre (Zeigarnik).
    const animacao = setInterval(() => {
      setProgresso((p) => (p < 85 ? p + Math.ceil((90 - p) / 6) : 85));
    }, 90);

    try {
      const r = await api.extrair.maps({ keyword: keyword.trim(), location: location.trim(), limit });
      clearInterval(animacao);
      setProgresso(100);
      setResultados(r.importados);
      setOrigem(r.origem === 'cli' ? 'scraper real' : 'mock de teste');
      const aviso = r.duplicados > 0 ? ` · ${r.duplicados} duplicados ignorados` : '';
      const obs = r.aviso ? ` · ${r.aviso}` : '';
      toast('sucesso', `${r.importados.length} leads extraídos (${r.origem === 'cli' ? 'scraper real' : 'mock'})${aviso}${obs}`);
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
            Busque empresas por palavra-chave e localização. Sem scraper configurado, o LeadMaster gera
            <strong> dados mockados (5–10 leads)</strong> para teste — sem risco de bloqueio de IP.
          </p>
          <span className="text-xs shrink-0 text-gray-400">
            <i className="fas fa-shield-halved mr-1" /> dados públicos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Palavra-chave *</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Ex.: Dentista, pizzaria, academia..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Localização *</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex.: Rio de Janeiro, RJ"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade: {limit}</label>
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
          <i className={cn('fas fa-magnifying-glass mr-2', extraindo && 'fa-spin')} />
          {extraindo ? 'Buscando leads...' : 'Iniciar Extração'}
        </button>

        {/* Zeigarnik: progresso visível durante a extração */}
        {(extraindo || progresso > 0) && (
          <div className="space-y-1">
            <ProgressBar valor={progresso} />
            <p className="text-xs text-indigo-600 font-medium">
              {progresso < 100 ? 'Buscando leads no Google Maps...' : 'Extração concluída ✓'}
            </p>
          </div>
        )}

        {/* Lei de Hick: opções avançadas escondidas */}
        <Accordion titulo="Configurações avançadas" icone="fas fa-sliders">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Raio de busca: {raio} km</label>
              <input
                type="range"
                min={1}
                max={50}
                value={raio}
                onChange={(e) => setRaio(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 cursor-pointer h-fit">
              <input
                type="checkbox"
                checked={apenasAvaliados}
                onChange={(e) => setApenasAvaliados(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
              Apenas com nota ≥ 4,5
            </label>
          </div>
          <p className="text-[11px] text-gray-400">
            As opções avançadas aplicam-se ao scraper real (gosom/google-maps-scraper), quando configurado
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
                  <th className="px-5 py-2 font-semibold">Nome</th>
                  <th className="px-5 py-2 font-semibold">Telefone</th>
                  <th className="px-5 py-2 font-semibold">Localização</th>
                  <th className="px-5 py-2 font-semibold">Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((lead, i) => {
                  const nota = lead.extras?.avaliacao as number | undefined;
                  return (
                  <tr key={lead.id || i} className="border-b border-gray-50 hover:bg-indigo-50/40">
                    <td className="px-5 py-2.5 text-gray-800">{lead.nome}</td>
                    <td className="px-5 py-2.5 text-gray-600">{mascararTelefone(lead.telefone)}</td>
                    <td className="px-5 py-2.5 text-gray-500 text-xs">
                      {lead.cidade || '—'}
                      {lead.endereco ? ` · ${lead.endereco}` : ''}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-400">
                      {nota !== undefined ? (
                        <>
                          <i className="fas fa-star text-amber-400 mr-1" />
                          {nota}
                        </>
                      ) : (
                        '—'
                      )}
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
