import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { AppConfig, Lead, ResultadoExtracao } from '../lib/types';
import { Accordion } from '../components/Accordion';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn, mascararTelefone } from '../lib/format';

type Aba = 'maps' | 'instagram' | 'cnpj';

const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: 'maps', rotulo: 'Google Maps', icone: 'fas fa-map-marked-alt' },
  { id: 'instagram', rotulo: 'Instagram', icone: 'fab fa-instagram' },
  { id: 'cnpj', rotulo: 'CNPJ', icone: 'fas fa-building' },
];

export function Extratores() {
  const [params, setParams] = useSearchParams();
  const aba = (params.get('tab') as Aba) || 'maps';
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {ABAS.map((item) => (
          <button
            key={item.id}
            onClick={() => setParams({ tab: item.id })}
            className={cn(
              'px-5 py-2.5 text-sm font-medium rounded-lg transition',
              aba === item.id
                ? 'bg-[#1e1b4b] text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
            )}
          >
            <i className={cn(item.icone, 'mr-2')} />
            {item.rotulo}
          </button>
        ))}
      </div>
      {aba === 'maps' && <ExtratorMaps />}
      {aba === 'instagram' && <ExtratorInstagram />}
      {aba === 'cnpj' && <ExtratorCnpj />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultados + importação (compartilhado)
// ---------------------------------------------------------------------------

function Resultados({
  resultados,
  onImportar,
  importando,
}: {
  resultados: ResultadoExtracao;
  onImportar: (selecionados: Partial<Lead>[]) => void;
  importando: boolean;
}) {
  const [selecionados, setSelecionados] = useState<Set<number>>(() => new Set(resultados.leads.map((_, i) => i)));

  const alternar = (i: number) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(i)) novo.delete(i);
      else novo.add(i);
      return novo;
    });

  const todos = selecionados.size === resultados.leads.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <p className="text-sm font-medium text-gray-700">
          {resultados.leads.length} resultado(s) — {selecionados.size} selecionado(s)
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              setSelecionados(todos ? new Set() : new Set(resultados.leads.map((_, i) => i)))
            }
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {todos ? 'Limpar seleção' : 'Selecionar todos'}
          </button>
          <button
            onClick={() => onImportar(resultados.leads.filter((_, i) => selecionados.has(i)))}
            disabled={selecionados.size === 0 || importando}
            className="px-5 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <i className="fas fa-file-import mr-1" /> {importando ? 'Importando...' : `Importar ${selecionados.size}`}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-white">
              <th className="px-4 py-2 w-8" />
              <th className="px-4 py-2 font-semibold">Nome / Empresa</th>
              <th className="px-4 py-2 font-semibold">Contato</th>
              <th className="px-4 py-2 font-semibold">Cidade</th>
              <th className="px-4 py-2 font-semibold">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {resultados.leads.map((lead, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/40">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selecionados.has(i)}
                    onChange={() => alternar(i)}
                    className="w-4 h-4 accent-indigo-500"
                  />
                </td>
                <td className="px-4 py-2 text-gray-800">{lead.nome || lead.empresa || '—'}</td>
                <td className="px-4 py-2 text-gray-600">
                  <p>{mascararTelefone(lead.telefone)}</p>
                  <p className="text-xs text-gray-400">{lead.email || 'sem e-mail'}</p>
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">{lead.cidade || '—'}</td>
                <td className="px-4 py-2 text-xs text-gray-400">
                  {detalhes(lead)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function detalhes(lead: Partial<Lead>): string {
  const extras = lead.extras as Record<string, unknown> | undefined;
  if (!extras) return '—';
  const partes: string[] = [];
  if (extras.seguidores !== undefined) partes.push(`${extras.seguidores} seguidores`);
  if (extras.avaliacao !== undefined) partes.push(`★ ${extras.avaliacao}`);
  if (extras.qtd_avaliacoes !== undefined) partes.push(`(${extras.qtd_avaliacoes} avaliações)`);
  return partes.join(' · ') || '—';
}

// ---------------------------------------------------------------------------
// Google Maps
// ---------------------------------------------------------------------------

function ExtratorMaps() {
  const { toast } = useToast();
  const [palavra, setPalavra] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [maxResultados, setMaxResultados] = useState(100);
  const [resultados, setResultados] = useState<ResultadoExtracao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    api.config.obter().then(setConfig).catch(() => undefined);
  }, []);

  const extrair = async () => {
    if (palavra.trim().length < 2 || localizacao.trim().length < 2) {
      toast('erro', 'Preencha a palavra-chave e a localização (ex.: "dentista", "São Paulo").');
      return;
    }
    setCarregando(true);
    setResultados(null);
    try {
      const r = await api.extrair.googleMaps({ palavra_chave: palavra.trim(), localizacao: localizacao.trim(), max_resultados: maxResultados });
      setResultados(r);
      toast('sucesso', `${r.leads.length} leads extraídos — revise e importe.`);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha na extração.');
    } finally {
      setCarregando(false);
    }
  };

  const importar = async (leads: Partial<Lead>[]) => {
    setImportando(true);
    try {
      const r = await api.leads.importar(leads);
      toast('sucesso', `${r.importados.length} importados, ${r.duplicados.length} duplicados ignorados.`);
      setResultados(null);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setImportando(false);
    }
  };

  const cliOk = !!config?.extratores.google_maps_cli;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Busque empresas por palavra-chave e localização (dados públicos do Google Maps).</p>
          <StatusBadge status={cliOk ? 'ativo' : 'inativo'} rotulo={cliOk ? 'Scraper configurado' : 'Scraper não configurado'} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Palavra-chave *</label>
            <input
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              placeholder="Ex.: dentista, barbearia, academia..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Localização *</label>
            <input
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Ex.: São Paulo, SP"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Máx. resultados</label>
            <input
              type="number"
              min={1}
              max={500}
              value={maxResultados}
              onChange={(e) => setMaxResultados(Number(e.target.value) || 100)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
        </div>
        {/* CTA grande (Fitts + von Restorff) */}
        <button
          onClick={extrair}
          disabled={carregando}
          className="w-full md:w-auto px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition disabled:opacity-60"
        >
          <i className={cn('fas fa-magnifying-glass mr-2', carregando && 'fa-spin')} />
          {carregando ? 'Extraindo leads...' : 'Extrair Leads'}
        </button>
        <Accordion titulo="Como instalar o Google Maps Scraper" icone="fas fa-circle-question">
          <ol className="text-xs text-gray-500 space-y-1 list-decimal pl-4">
            <li>
              Instale o scraper:{' '}
              <code className="bg-gray-100 px-1 rounded">github.com/gosom/google-maps-scraper</code>
            </li>
            <li>
              Compile (Go) e informe o caminho do binário em <strong>Ferramentas → Extratores</strong>.
            </li>
            <li>As flags do comando são ajustáveis no template de argumentos em Ferramentas.</li>
          </ol>
        </Accordion>
      </div>
      {resultados && <Resultados resultados={resultados} onImportar={importar} importando={importando} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------

function ExtratorInstagram() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [resultados, setResultados] = useState<ResultadoExtracao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    api.config.obter().then(setConfig).catch(() => undefined);
  }, []);

  const extrair = async () => {
    if (!url.includes('instagram.com')) {
      toast('erro', 'Informe a URL do perfil (ex.: https://instagram.com/perfil).');
      return;
    }
    setCarregando(true);
    setResultados(null);
    try {
      const r = await api.extrair.instagram(url.trim());
      setResultados(r);
      toast('sucesso', 'Dados extraídos — revise e importe.');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha na extração.');
    } finally {
      setCarregando(false);
    }
  };

  const importar = async (leads: Partial<Lead>[]) => {
    setImportando(true);
    try {
      const r = await api.leads.importar(leads);
      toast('sucesso', `${r.importados.length} importados, ${r.duplicados.length} duplicados ignorados.`);
      setResultados(null);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setImportando(false);
    }
  };

  const cliOk = !!config?.extratores.igmapper_cli;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Extraia contatos públicos de um perfil do Instagram.</p>
          <StatusBadge status={cliOk ? 'ativo' : 'inativo'} rotulo={cliOk ? 'igmapper configurado' : 'igmapper não configurado'} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">URL do perfil *</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/perfil_do_negocio/"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
        </div>
        <button
          onClick={extrair}
          disabled={carregando}
          className="w-full md:w-auto px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition disabled:opacity-60"
        >
          <i className={cn('fab fa-instagram mr-2', carregando && 'fa-spin')} />
          {carregando ? 'Extraindo...' : 'Extrair do Instagram'}
        </button>
        <Accordion titulo="Como instalar o igmapper" icone="fas fa-circle-question">
          <ol className="text-xs text-gray-500 space-y-1 list-decimal pl-4">
            <li>
              Instale: <code className="bg-gray-100 px-1 rounded">github.com/lucasoal/igmapper</code>
            </li>
            <li>
              Informe o caminho do CLI em <strong>Ferramentas → Extratores</strong>.
            </li>
          </ol>
        </Accordion>
      </div>
      {resultados && <Resultados resultados={resultados} onImportar={importar} importando={importando} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CNPJ
// ---------------------------------------------------------------------------

function ExtratorCnpj() {
  const { toast } = useToast();
  const [modo, setModo] = useState<'cnpj' | 'cnae'>('cnpj');
  const [cnpj, setCnpj] = useState('');
  const [cnae, setCnae] = useState('');
  const [uf, setUf] = useState('SP');
  const [quantidade, setQuantidade] = useState(20);
  const [resultados, setResultados] = useState<ResultadoExtracao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);

  const extrair = useCallback(async () => {
    setCarregando(true);
    setResultados(null);
    try {
      if (modo === 'cnpj') {
        const lead = await api.extrair.cnpj(cnpj.trim());
        setResultados({ leads: [lead] });
        toast('sucesso', 'CNPJ localizado — revise e importe.');
      } else {
        const r = await api.extrair.cnpjBusca({ cnae: cnae.trim(), uf: uf.trim(), quantidade });
        setResultados(r);
        toast('sucesso', `${r.leads.length} empresas encontradas via ${r.provedor}.`);
      }
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha na consulta.');
    } finally {
      setCarregando(false);
    }
  }, [modo, cnpj, cnae, uf, quantidade, toast]);

  const importar = async (leads: Partial<Lead>[]) => {
    setImportando(true);
    try {
      const r = await api.leads.importar(leads);
      toast('sucesso', `${r.importados.length} importados, ${r.duplicados.length} duplicados ignorados.`);
      setResultados(null);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setImportando(false);
    }
  };

  const ufs = useMemo(
    () => ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'],
    [],
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setModo('cnpj')}
            className={cn(
              'px-4 py-2 text-xs font-medium rounded-lg transition',
              modo === 'cnpj' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50',
            )}
          >
            Consulta por CNPJ
          </button>
          <button
            onClick={() => setModo('cnae')}
            className={cn(
              'px-4 py-2 text-xs font-medium rounded-lg transition',
              modo === 'cnae' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50',
            )}
          >
            Busca por CNAE + UF
          </button>
        </div>

        {modo === 'cnpj' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ *</label>
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00 (a BrasilAPI aceita com ou sem pontuação)"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CNAE (código) *</label>
              <input
                value={cnae}
                onChange={(e) => setCnae(e.target.value)}
                placeholder="Ex.: 6202-3/01 (desenvolvimento de software)"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">UF *</label>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {ufs.map((estado) => (
                  <option key={estado}>{estado}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade</label>
              <input
                type="number"
                min={1}
                max={100}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value) || 20)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
          </div>
        )}

        <button
          onClick={extrair}
          disabled={carregando}
          className="w-full md:w-auto px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition disabled:opacity-60"
        >
          <i className={cn('fas fa-building mr-2', carregando && 'fa-spin')} />
          {carregando ? 'Consultando...' : modo === 'cnpj' ? 'Consultar CNPJ' : 'Buscar empresas'}
        </button>

        <Accordion titulo="Fontes e scraping profundo" icone="fas fa-circle-question">
          <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
            <li>Consulta direta usa a <strong>BrasilAPI</strong> (brasilapi.com.br) — sem chave.</li>
            <li>
              A busca por CNAE/UF usa um <strong>provedor configurável</strong> (padrão: OpenCNPJ) — ajuste a URL em{' '}
              <strong>Ferramentas → Extratores</strong> conforme o provedor que você usa.
            </li>
            <li>
              Scraping profundo de contatos no site da empresa via <strong>Scrapling</strong> (D4Vinci/Scrapling), se
              configurado.
            </li>
          </ul>
        </Accordion>
      </div>
      {resultados && <Resultados resultados={resultados} onImportar={importar} importando={importando} />}
    </div>
  );
}
