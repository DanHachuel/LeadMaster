import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { Accordion } from '../components/Accordion';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

interface AgenteEstado {
  status: 'ativo' | 'inativo';
  prompt: string;
}

/**
 * Agentes de IA — controle e configuração. Dois cards lado a lado (Disparo e
 * Atendimento): toggle grande (Fitts), badge "Ativo" em verde esmeralda com
 * pulso animado (von Restorff + Zeigarnik), prompt do sistema editável e
 * configurações avançadas em accordion (Lei de Hick).
 */
export function Agentes() {
  const { toast } = useToast();

  const [agentes, setAgentes] = useState<{ disparo: AgenteEstado; atendimento: AgenteEstado } | null>(null);
  const [llmOk, setLlmOk] = useState(false);
  const [modelo, setModelo] = useState('');
  const [modo, setModo] = useState<'texto' | 'voz'>('texto');
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');
  const [previewAberto, setPreviewAberto] = useState(false);
  const [alternando, setAlternando] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente de atendimento do LeadMaster. Como posso ajudar?' },
  ]);
  const [entrada, setEntrada] = useState('');

  const carregar = useCallback(async () => {
    const [r, config] = await Promise.all([api.agentes.listar(), api.config.obter()]);
    setAgentes(r.agentes as { disparo: AgenteEstado; atendimento: AgenteEstado });
    setLlmOk(r.llm_configurado);
    setModelo(config.llm.modelo || '');
    setModo(config.agentes.atendimento.modo === 'voz' ? 'voz' : 'texto');
  }, []);

  useEffect(() => {
    api.agentes.templates().then(setTemplates).catch(() => undefined);
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  const alternar = async (agentId: string, novo: 'ativo' | 'inativo') => {
    setAlternando(agentId);
    try {
      await api.agentes.status(agentId, novo);
      await carregar();
      toast('sucesso', `Agente ${novo === 'ativo' ? 'ativado' : 'desativado'}.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        toast('erro', 'Configure a API Key na aba Ferramentas primeiro.');
      } else {
        toast('erro', e instanceof Error ? e.message : 'Falha ao alterar status.');
      }
    } finally {
      setAlternando(null);
    }
  };

  const salvarPrompt = async (agentId: string, prompt: string) => {
    try {
      await api.agentes.salvarPrompt(agentId, prompt);
      toast('sucesso', 'Prompt do sistema salvo.');
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar prompt.');
    }
  };

  const salvarModo = async (novo: 'texto' | 'voz') => {
    setModo(novo);
    try {
      await api.config.salvar({ agentes: { atendimento: { modo: novo } } });
      toast('sucesso', `Modo de atendimento: ${novo === 'voz' ? 'voz (pipecat)' : 'texto (LLM)'}.`);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar modo.');
    }
  };

  const testar = async () => {
    try {
      const r = await api.agentes.testarTemplate(templates.texto ?? '');
      setPreview(r.renderizado);
      setPreviewAberto(true);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao renderizar template.');
    }
  };

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto) return;
    const proximas = [...mensagens, { role: 'user' as const, content: texto }];
    setMensagens(proximas);
    setEntrada('');
    try {
      const r = await api.agentes.chat(proximas.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })));
      setMensagens([...proximas, { role: 'assistant', content: r.ok && r.resposta ? r.resposta : `⚠ ${r.mensagem ?? 'Sem resposta.'}` }]);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha no chat.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AgenteCard
        titulo="Agente de Disparo"
        integracao="OpenOutreach"
        icone="fas fa-paper-plane"
        agentId="disparo"
        estado={agentes?.disparo}
        alternando={alternando}
        onAlternar={alternar}
        onSalvarPrompt={salvarPrompt}
        llmNecessaria
        llmOk={llmOk}
        avisoLlm="O Agente de Disparo usa o LLM para redigir mensagens. Configure a API Key em Ferramentas para ativá-lo."
      >
        <Accordion titulo="Configurações avançadas (LLM)" icone="fas fa-microchip">
          <p className="text-xs text-gray-500">
            Modelo atual: <strong className="text-gray-700">{modelo || '—'}</strong> · temperatura padrão:{' '}
            <strong className="text-gray-700">0.7</strong>
          </p>
          <p className="text-[11px] text-gray-400">
            Ajuste fino de modelo/temperatura é feito em Ferramentas → LLM.
          </p>
        </Accordion>
        <Accordion titulo="Templates de mensagem (texto e áudio)" icone="fas fa-comment-dots">
          <textarea
            value={templates.texto ?? ''}
            onChange={(e) => setTemplates({ ...templates, texto: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Template — texto"
          />
          <textarea
            value={templates.audio ?? ''}
            onChange={(e) => setTemplates({ ...templates, audio: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Template — áudio"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                try {
                  await api.agentes.salvarTemplates(templates);
                  toast('sucesso', 'Templates salvos.');
                } catch (e) {
                  toast('erro', e instanceof Error ? e.message : 'Falha ao salvar templates.');
                }
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
            >
              <i className="fas fa-save mr-1" /> Salvar templates
            </button>
            <button onClick={testar} className="px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
              <i className="fas fa-vial mr-1" /> Testar
            </button>
          </div>
        </Accordion>
      </AgenteCard>

      <AgenteCard
        titulo="Agente de Atendimento"
        integracao={modo === 'voz' ? 'pipecat' : 'LLM (texto)'}
        icone="fas fa-headset"
        agentId="atendimento"
        estado={agentes?.atendimento}
        alternando={alternando}
        onAlternar={alternar}
        onSalvarPrompt={salvarPrompt}
      >
        <Accordion titulo="Configurações avançadas" icone="fas fa-sliders">
          <div className="flex gap-3">
            {([
              { id: 'texto' as const, rotulo: 'Texto (LLM)', icone: 'fas fa-keyboard' },
              { id: 'voz' as const, rotulo: 'Voz (pipecat)', icone: 'fas fa-microphone' },
            ]).map((opcao) => (
              <button
                key={opcao.id}
                onClick={() => salvarModo(opcao.id)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg border text-xs font-medium transition',
                  modo === opcao.id ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                )}
              >
                <i className={cn(opcao.icone, 'mr-1')} /> {opcao.rotulo}
              </button>
            ))}
          </div>
        </Accordion>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Testar conversa</p>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
            {mensagens.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] px-3 py-2 rounded-2xl text-xs', m.role === 'user' ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-700 rounded-bl-sm')}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="Mensagem do cliente..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <button onClick={enviar} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90">
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </div>
      </AgenteCard>

      <Modal aberto={previewAberto} onFechar={() => setPreviewAberto(false)} titulo="Pré-visualização do template" icone="fas fa-comment-dots">
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{preview}</div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card do agente
// ---------------------------------------------------------------------------

function AgenteCard({
  titulo,
  integracao,
  icone,
  agentId,
  estado,
  alternando,
  onAlternar,
  onSalvarPrompt,
  llmNecessaria,
  llmOk,
  avisoLlm,
  children,
}: {
  titulo: string;
  integracao: string;
  icone: string;
  agentId: string;
  estado: AgenteEstado | undefined;
  alternando: string | null;
  onAlternar: (agentId: string, novo: 'ativo' | 'inativo') => void;
  onSalvarPrompt: (agentId: string, prompt: string) => void;
  llmNecessaria?: boolean;
  llmOk?: boolean;
  avisoLlm?: string;
  children: ReactNode;
}) {
  const [prompt, setPrompt] = useState(estado?.prompt ?? '');
  useEffect(() => {
    setPrompt(estado?.prompt ?? '');
  }, [estado?.prompt]);

  const ativo = estado?.status === 'ativo';
  const bloqueado = Boolean(llmNecessaria && !llmOk);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <i className={cn(icone, 'text-indigo-500')} /> {titulo}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {integracao} · <code className="bg-gray-100 px-1 rounded">{agentId}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Pulso animado enquanto ativo */}
          {ativo && <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>}
          {/* Badge verde esmeralda (von Restorff) */}
          <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', ativo ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-500')}>
            {ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {llmNecessaria && bloqueado && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <i className="fas fa-triangle-exclamation mr-1" /> {avisoLlm}
        </p>
      )}

      {/* Toggle grande (Lei de Fitts) */}
      <button
        onClick={() => onAlternar(agentId, ativo ? 'inativo' : 'ativo')}
        disabled={alternando === agentId}
        aria-label={ativo ? `Desativar ${titulo}` : `Ativar ${titulo}`}
        className={cn(
          'relative w-16 h-9 rounded-full transition-colors shrink-0 disabled:opacity-50',
          ativo ? 'bg-emerald-500' : 'bg-gray-300',
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow transition-transform',
            ativo && 'translate-x-7',
          )}
        />
        <span className="sr-only">{ativo ? 'Desligar' : 'Ligar'}</span>
      </button>

      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Prompt do Sistema</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Instruções de comportamento do agente..."
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={() => onSalvarPrompt(agentId, prompt)}
              className="px-5 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
            >
              <i className="fas fa-save mr-1" /> Salvar Prompt
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
