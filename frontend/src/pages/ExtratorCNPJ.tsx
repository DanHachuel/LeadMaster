import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Lead } from '../lib/types';
import { Accordion } from '../components/Accordion';
import { ProgressBar } from '../components/ProgressBar';
import { useToast } from '../components/Toast';
import { cn, mascararTelefone } from '../lib/format';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

/**
 * Extrator de Leads (CNPJ): mesmo padrão de UX do Extrator Maps/Instagram —
 * formulário limpo (Lei de Hick), botão primário em gradiente (von Restorff),
 * barra de progresso durante a extração (Zeigarnik) e tabela de resultados
 * com atalho para o CRM Kanban. Sem provedor configurado, o backend gera mock
 * de 5–10 empresas fictícias (anti-bloqueio e estabilidade).
 */
export function ExtratorCNPJ() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cnae, setCnae] = useState('');
  const [uf, setUf] = useState('SP');
  const [limit, setLimit] = useState(10);
  const [porte, setPorte] = useState('');
  const [capitalMinimo, setCapitalMinimo] = useState(0);
  const [extraindo, setExtraindo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<Lead[] | null>(null);
  const [origem, setOrigem] = useState('');

  // Consulta avulsa (BrasilAPI): importa 1 lead por CNPJ completo.
  const [cnpjAvulso, setCnpjAvulso] = useState('');
  const [importandoAvulso, setImportandoAvulso] = useState(false);

  const extrair = async () => {
    if (cnae.trim().length < 2) {
      toast('erro', 'Informe o CNAE (ex.: 6201-5/01 — desenvolvimento de software).');
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
      const r = await api.extrair.cnpjExtract({ cnae: cnae.trim(), uf, limit });
      clearInterval(animacao);
      setProgresso(100);
      setResultados(r.importados);
      setOrigem(r.origem === 'provedor' ? 'provedor real' : 'mock de teste');
      const aviso = r.duplicados > 0 ? ` · ${r.duplicados} duplicados ignorados` : '';
      const obs = r.aviso ? ` · ${r.aviso}` : '';
      toast('sucesso', `${r.importados.length} empresas extraídas (${r.origem === 'provedor' ? 'provedor real' : 'mock'})${aviso}${obs}`);
    } catch (e) {
      clearInterval(animacao);
      setProgresso(0);
      toast('erro', e instanceof Error ? e.message : 'Falha na extração.');
    } finally {
      setExtraindo(false);
    }
  };

  const consultarAvulso = async () => {
    const numero = cnpjAvulso.trim();
    if (numero.length < 8) {
      toast('erro', 'Informe um CNPJ completo (14 dígitos, com ou sem pontuação).');
      return;
    }
    setImportandoAvulso(true);
    try {
      const lead = await api.extrair.cnpj(numero);
      const r = await api.leads.importar([lead]);
      toast('sucesso', `${r.importados.length} lead(s) importado(s) para "Novos Leads"${r.duplicados.length ? ` · ${r.duplicados.length} duplicado(s)` : ''}.`);
      setCnpjAvulso('');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao consultar o CNPJ.');
    } finally {
      setImportandoAvulso(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-gray-500">
            Busque empresas por CNAE e estado. Sem provedor configurado, o LeadMaster gera
            <strong> dados mockados (5–10 empresas)</strong> para teste — sem risco de bloqueio.
          </p>
          <span className="text-xs shrink-0 text-gray-400">
            <i className="fas fa-shield-halved mr-1" /> dados B2B
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CNAE *</label>
            <input
              value={cnae}
              onChange={(e) => setCnae(e.target.value)}
              placeholder="Ex.: 6201-5/01 (desenvolvimento de software)"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">UF *</label>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
            >
              {UFS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
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
          <i className={cn('fas fa-building mr-2', extraindo && 'fa-spin')} />
          {extraindo ? 'Buscando empresas...' : 'Iniciar Extração'}
        </button>

        {/* Zeigarnik: progresso visível durante a extração */}
        {(extraindo || progresso > 0) && (
          <div className="space-y-1">
            <ProgressBar valor={progresso} />
            <p className="text-xs text-indigo-600 font-medium">
              {progresso < 100 ? 'Buscando empresas por CNAE...' : 'Extração concluída ✓'}
            </p>
          </div>
        )}

        {/* Lei de Hick: opções avançadas escondidas */}
        <Accordion titulo="Configurações avançadas" icone="fas fa-sliders">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Porte da empresa</label>
              <select
                value={porte}
                onChange={(e) => setPorte(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
              >
                <option value="">Todos</option>
                <option value="ME">ME (Microempresa)</option>
                <option value="EPP">EPP (Pequeno porte)</option>
                <option value="medio">Médio porte</option>
                <option value="grande">Grande porte</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Capital social mínimo: {capitalMinimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </label>
              <input
                type="range"
                min={0}
                max={5000000}
                step={100000}
                value={capitalMinimo}
                onChange={(e) => setCapitalMinimo(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            Os filtros de porte e capital social aplicam-se ao provedor real de busca, quando configurado
            em Ferramentas → Extratores. No modo mock eles são ignorados.
          </p>
        </Accordion>

        {/* Consulta avulsa por CNPJ completo (BrasilAPI) — enriquece 1 lead */}
        <div className="pt-1 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">
            <i className="fas fa-magnifying-glass mr-1" /> Consulta avulsa por CNPJ (BrasilAPI) — importa uma empresa específica
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              value={cnpjAvulso}
              onChange={(e) => setCnpjAvulso(e.target.value)}
              placeholder="00.000.000/0000-00"
              className="flex-1 min-w-[220px] px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <button
              onClick={consultarAvulso}
              disabled={importandoAvulso}
              className="px-5 py-2.5 text-xs font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-60"
            >
              <i className={cn('fas fa-file-import mr-1', importandoAvulso && 'fa-spin')} />
              {importandoAvulso ? 'Importando...' : 'Consultar e importar'}
            </button>
          </div>
        </div>
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
                  <th className="px-5 py-2 font-semibold">Nome Fantasia</th>
                  <th className="px-5 py-2 font-semibold">CNPJ</th>
                  <th className="px-5 py-2 font-semibold">Cidade / UF</th>
                  <th className="px-5 py-2 font-semibold">Telefone</th>
                  <th className="px-5 py-2 font-semibold">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((lead, i) => (
                  <tr key={lead.id || i} className="border-b border-gray-50 hover:bg-indigo-50/40">
                    <td className="px-5 py-2.5 text-gray-800">{lead.nome}</td>
                    <td className="px-5 py-2.5 text-gray-600 font-mono text-xs">{lead.cnpj || '—'}</td>
                    <td className="px-5 py-2.5 text-gray-500 text-xs">{lead.cidade || '—'}</td>
                    <td className="px-5 py-2.5 text-gray-600">{mascararTelefone(lead.telefone)}</td>
                    <td className="px-5 py-2.5">
                      <span className="text-[10px] uppercase tracking-wide bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                        {lead.fonte}
                      </span>
                    </td>
                  </tr>
                ))}
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
