import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AppConfig } from '../lib/types';
import { Accordion } from '../components/Accordion';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

/**
 * Ferramentas = configuração central (config.json). Lei de Miller: seções em
 * cards agrupados. Lei de Hick: detalhes avançados em accordions.
 * Segredos: backend devolve vazios + flag "_configurado" — aqui mostramos
 * "configurado" e enviamos vazio para NÃO apagar (regra do backend).
 */
export function Ferramentas({ onConfigSalva }: { onConfigSalva?: (config: AppConfig) => void }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState('');

  const carregar = useCallback(async () => {
    const c = await api.config.obter();
    setConfig(c);
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  if (!config) {
    return (
      <div className="text-center text-gray-400 py-16">
        <i className="fas fa-spinner fa-spin text-2xl" />
      </div>
    );
  }

  const atualizar = (patch: (c: AppConfig) => void) => {
    setConfig((atual) => {
      if (!atual) return atual;
      const copia: AppConfig = JSON.parse(JSON.stringify(atual));
      patch(copia);
      return copia;
    });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const novo = await api.config.salvar(config);
      setConfig(novo);
      onConfigSalva?.(novo);
      toast('sucesso', 'Configurações salvas localmente (config.json).');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar configurações.');
    } finally {
      setSalvando(false);
    }
  };

  const testarLlm = async () => {
    setTestando('llm');
    try {
      const r = await api.config.testarLlm();
      toast(r.ok ? 'sucesso' : 'erro', r.ok ? `LLM respondeu: ${r.resposta}` : r.mensagem ?? 'Falha no teste.');
    } finally {
      setTestando('');
    }
  };

  const testarUrl = async (rotulo: string, url: string) => {
    if (!url) {
      toast('erro', 'Informe a URL antes de testar.');
      return;
    }
    setTestando(rotulo);
    try {
      const r = await api.config.testarIntegracao(url);
      toast(r.ok ? 'sucesso' : 'erro', r.ok ? `${rotulo} respondeu (HTTP ${r.status_http}).` : r.mensagem ?? 'Sem resposta.');
    } finally {
      setTestando('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* LLM */}
      <Cartao titulo="LLM (roteiros e agentes)" icone="fas fa-brain">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo rotulo="Base URL" valor={config.llm.base_url} onChange={(v) => atualizar((c) => { c.llm.base_url = v; })} placeholder="https://api.openai.com/v1" />
          <Campo rotulo="Modelo" valor={config.llm.modelo} onChange={(v) => atualizar((c) => { c.llm.modelo = v; })} placeholder="gpt-4o-mini" />
          <CampoSecreto
            rotulo="API Key"
            configurado={!!config.llm.api_key_configurado}
            onChange={(v) => atualizar((c) => { c.llm.api_key = v; })}
          />
        </div>
        <AcaoTestar rotulo="Testar conexão LLM" carregando={testando === 'llm'} onClick={testarLlm} />
      </Cartao>

      {/* Integrações de vídeo */}
      <Cartao titulo="Produção de vídeos" icone="fas fa-film">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo
            rotulo="MoneyPrinterTurbo — URL"
            valor={config.integracoes.moneyprinter.url}
            onChange={(v) => atualizar((c) => { c.integracoes.moneyprinter.url = v; })}
            placeholder="http://localhost:8080"
          />
          <Campo
            rotulo="Short-Video-Maker — URL"
            valor={config.integracoes.short_video_maker.url}
            onChange={(v) => atualizar((c) => { c.integracoes.short_video_maker.url = v; })}
            placeholder="http://localhost:3123"
          />
        </div>
        <div className="flex gap-3">
          <AcaoTestar rotulo="Testar MoneyPrinterTurbo" carregando={testando === 'mp'} onClick={() => testarUrl('MoneyPrinterTurbo', config.integracoes.moneyprinter.url)} />
          <AcaoTestar rotulo="Testar Short-Video-Maker" carregando={testando === 'svm'} onClick={() => testarUrl('Short-Video-Maker', config.integracoes.short_video_maker.url)} />
        </div>
        <Accordion titulo="OpenMontage (fallback de produção)" icone="fas fa-clapperboard">
          <Campo
            rotulo="Caminho do CLI OpenMontage"
            valor={config.integracoes.openmontage.cli_path}
            onChange={(v) => atualizar((c) => { c.integracoes.openmontage.cli_path = v; })}
            placeholder="C:\ferramentas\openmontage\openmontage.exe"
          />
        </Accordion>
      </Cartao>

      {/* Upload YouTube */}
      <Cartao titulo="Upload YouTube" icone="fab fa-youtube">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo
            rotulo="Uploader — URL (YouTube-Video-Upload-Frontend-Api)"
            valor={config.integracoes.youtube_upload.url}
            onChange={(v) => atualizar((c) => { c.integracoes.youtube_upload.url = v; })}
            placeholder="http://localhost:3000"
          />
          <CampoSecreto
            rotulo="Uploader — API Key"
            configurado={!!config.integracoes.youtube_upload.api_key_configurado}
            onChange={(v) => atualizar((c) => { c.integracoes.youtube_upload.api_key = v; })}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.integracoes.youtube_upload.modo === 'nao_listado_1h_publico'}
              onChange={(e) =>
                atualizar((c) => {
                  c.integracoes.youtube_upload.modo = e.target.checked ? 'nao_listado_1h_publico' : 'direto_publico';
                })
              }
              className="w-4 h-4 accent-indigo-500"
            />
            Não listado → 1h → público
          </label>
          <CampoNum
            rotulo="Limite diário"
            valor={config.integracoes.youtube_upload.limite_diario}
            onChange={(v) => atualizar((c) => { c.integracoes.youtube_upload.limite_diario = v; })}
          />
          <CampoNum
            rotulo="Espera p/ publicar (horas)"
            valor={config.integracoes.youtube_upload.espera_publicacao_horas}
            onChange={(v) => atualizar((c) => { c.integracoes.youtube_upload.espera_publicacao_horas = v; })}
          />
        </div>
        <AcaoTestar rotulo="Testar uploader" carregando={testando === 'up'} onClick={() => testarUrl('Uploader', config.integracoes.youtube_upload.url)} />
        <Accordion titulo="Fallback: youtube-uploader-mcp" icone="fas fa-shuffle">
          <Campo
            rotulo="Caminho do youtube-uploader-mcp"
            valor={config.integracoes.youtube_upload.uploader_mcp_path}
            onChange={(v) => atualizar((c) => { c.integracoes.youtube_upload.uploader_mcp_path = v; })}
            placeholder="Caminho do CLI (fallback)"
          />
        </Accordion>
      </Cartao>

      {/* Extratores */}
      <Cartao titulo="Extratores de leads" icone="fas fa-magnifying-glass-location">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo
            rotulo="Google Maps Scraper — binário"
            valor={config.extratores.google_maps_cli}
            onChange={(v) => atualizar((c) => { c.extratores.google_maps_cli = v; })}
            placeholder="C:\ferramentas\google-maps-scraper.exe"
          />
          <Campo
            rotulo="igmapper — binário"
            valor={config.extratores.igmapper_cli}
            onChange={(v) => atualizar((c) => { c.extratores.igmapper_cli = v; })}
            placeholder="Caminho do CLI igmapper"
          />
        </div>
        <Accordion titulo="Argumentos dos scrapers (templates)" icone="fas fa-terminal">
          <AreaTexto
            rotulo="Google Maps — template de argumentos"
            valor={config.extratores.google_maps_args}
            onChange={(v) => atualizar((c) => { c.extratores.google_maps_args = v; })}
            linhas={2}
          />
          <AreaTexto
            rotulo="igmapper — template de argumentos"
            valor={config.extratores.igmapper_args}
            onChange={(v) => atualizar((c) => { c.extratores.igmapper_args = v; })}
            linhas={2}
          />
        </Accordion>
        <Accordion titulo="CNPJ e Scrapling" icone="fas fa-building">
          <Campo
            rotulo="Provedor de busca CNAE/UF — URL"
            valor={config.extratores.cnpj_provedor_busca}
            onChange={(v) => atualizar((c) => { c.extratores.cnpj_provedor_busca = v; })}
            placeholder="https://api.opencnpj.org"
          />
          <Campo
            rotulo="Scrapling — binário (scraping profundo)"
            valor={config.extratores.scrapling_cli}
            onChange={(v) => atualizar((c) => { c.extratores.scrapling_cli = v; })}
            placeholder="Caminho do CLI Scrapling"
          />
        </Accordion>
      </Cartao>

      {/* OpenOutreach + pipecat */}
      <Cartao titulo="Agentes — integrações" icone="fas fa-robot">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo
            rotulo="OpenOutreach — URL"
            valor={config.integracoes.openoutreach.url}
            onChange={(v) => atualizar((c) => { c.integracoes.openoutreach.url = v; })}
            placeholder="http://localhost:9090"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 cursor-pointer h-fit mt-5">
            <input
              type="checkbox"
              checked={config.integracoes.openoutreach.enabled}
              onChange={(e) => atualizar((c) => { c.integracoes.openoutreach.enabled = e.target.checked; })}
              className="w-4 h-4 accent-indigo-500"
            />
            OpenOutreach ativo
          </label>
        </div>
        <Campo
          rotulo="pipecat — URL (atendimento por voz)"
          valor={config.integracoes.pipecat.url}
          onChange={(v) => atualizar((c) => { c.integracoes.pipecat.url = v; })}
          placeholder="http://localhost:5000"
        />
      </Cartao>

      {/* Perfil */}
      <Cartao titulo="Perfil e licença" icone="fas fa-user">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo rotulo="Seu nome" valor={config.perfil.nome} onChange={(v) => atualizar((c) => { c.perfil.nome = v; })} />
          <Campo rotulo="Expira em" valor={config.perfil.licenca.expira_em} onChange={(v) => atualizar((c) => { c.perfil.licenca.expira_em = v; })} />
          <CampoNum
            rotulo="Dias restantes (vazio = infinito)"
            valor={config.perfil.licenca.restam_dias ?? 0}
            onChange={(v) => atualizar((c) => { c.perfil.licenca.restam_dias = v > 0 ? v : null; })}
          />
        </div>
      </Cartao>

      {/* Salvar — botão grande (Fitts) */}
      <div className="flex justify-end">
        <button
          onClick={salvar}
          disabled={salvando}
          className="px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition disabled:opacity-60 shadow-sm"
        >
          <i className={cn('fas fa-save mr-2', salvando && 'fa-spin')} />
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Cartao({ titulo, icone, children }: { titulo: string; icone: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <i className={cn(icone, 'text-indigo-400')} /> {titulo}
      </h3>
      {children}
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  placeholder,
  tipo = 'text',
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{rotulo}</label>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
      />
    </div>
  );
}

function CampoNum({ rotulo, valor, onChange }: { rotulo: string; valor: number; onChange: (valor: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{rotulo}</label>
      <input
        type="number"
        value={valor ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
      />
    </div>
  );
}

function CampoSecreto({
  rotulo,
  configurado,
  onChange,
}: {
  rotulo: string;
  configurado: boolean;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {rotulo} {configurado && <span className="text-green-600">• configurado</span>}
      </label>
      <input
        type="password"
        onChange={(e) => onChange(e.target.value)}
        placeholder={configurado ? '•••••••• (deixe vazio para manter)' : 'cole a chave aqui'}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
      />
    </div>
  );
}

function AreaTexto({
  rotulo,
  valor,
  onChange,
  linhas = 3,
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  linhas?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{rotulo}</label>
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={linhas}
        className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
      />
    </div>
  );
}

function AcaoTestar({ rotulo, onClick, carregando }: { rotulo: string; onClick: () => void; carregando: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={carregando}
      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
    >
      <i className={cn('fas fa-vial-circle-check mr-1', carregando && 'fa-spin')} /> {rotulo}
    </button>
  );
}
