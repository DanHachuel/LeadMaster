import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

type Aba = 'disparo' | 'atendimento';

export function Agentes() {
  const [params, setParams] = useSearchParams();
  const aba = (params.get('tab') as Aba) || 'disparo';

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[
          { id: 'disparo' as Aba, rotulo: 'Agente de Disparo', icone: 'fas fa-paper-plane' },
          { id: 'atendimento' as Aba, rotulo: 'Agente de Atendimento', icone: 'fas fa-headset' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setParams({ tab: item.id })}
            className={cn(
              'px-5 py-2.5 text-sm font-medium rounded-lg transition',
              aba === item.id ? 'bg-[#1e1b4b] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
            )}
          >
            <i className={cn(item.icone, 'mr-2')} />
            {item.rotulo}
          </button>
        ))}
      </div>
      {aba === 'disparo' ? <AgenteDisparo /> : <AgenteAtendimento />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agente de Disparo (templates + OpenOutreach)
// ---------------------------------------------------------------------------

function AgenteDisparo() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<{ texto: string; audio: string }>({ texto: '', audio: '' });
  const [empresa, setEmpresa] = useState('LeadMaster');
  const [preview, setPreview] = useState('');
  const [previewAberto, setPreviewAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [openoutreach, setOpenoutreach] = useState<{ url: string; enabled: boolean } | null>(null);

  const carregar = useCallback(async () => {
    const [ts, config] = await Promise.all([api.agentes.templates(), api.config.obter()]);
    setTemplates({ texto: ts.texto ?? '', audio: ts.audio ?? '' });
    setEmpresa(config.agentes.disparo.minha_empresa ?? 'LeadMaster');
    setOpenoutreach(config.integracoes.openoutreach);
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.agentes.salvarTemplates(templates);
      await api.config.salvar({ agentes: { disparo: { templates, minha_empresa: empresa } } } as never);
      toast('sucesso', 'Templates do agente de disparo salvos.');
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar templates.');
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    try {
      const r = await api.agentes.testarTemplate(templates.texto);
      setPreview(r.renderizado);
      setPreviewAberto(true);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao renderizar template.');
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Templates de mensagem</h3>
          <StatusBadge
            status={openoutreach?.url && openoutreach.enabled !== false ? 'ativo' : 'inativo'}
            rotulo={openoutreach?.url && openoutreach.enabled !== false ? 'OpenOutreach configurado' : 'OpenOutreach não configurado'}
          />
        </div>
        <p className="text-xs text-gray-500">
          Variáveis disponíveis: <code className="bg-gray-100 px-1 rounded">{'{{nome}}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{primeiro_nome}}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{empresa}}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{cidade}}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{minha_empresa}}'}</code>.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Template — texto</label>
          <textarea
            value={templates.texto}
            onChange={(e) => setTemplates({ ...templates, texto: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Template — áudio (texto para gravação)</label>
          <textarea
            value={templates.audio}
            onChange={(e) => setTemplates({ ...templates, audio: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nome da sua empresa</label>
          <input
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            <i className="fas fa-save mr-2" /> Salvar templates
          </button>
          <button onClick={testar} className="px-4 py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
            <i className="fas fa-vial mr-2" /> Testar com lead de exemplo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm text-gray-500 space-y-2">
        <p className="font-medium text-gray-700 text-xs uppercase tracking-wide">Como funciona</p>
        <p>
          O envio em massa é executado pelo <strong>OpenOutreach</strong> (eracle/OpenOutreach). As campanhas
          ficam na página <strong>Disparos</strong>; a validação da integração acontece na hora de iniciar a
          campanha — sem travas de pré-registro.
        </p>
      </div>

      <Modal aberto={previewAberto} onFechar={() => setPreviewAberto(false)} titulo="Pré-visualização do template" icone="fas fa-comment-dots">
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
          {preview}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agente de Atendimento (texto via LLM / voz via pipecat)
// ---------------------------------------------------------------------------

function AgenteAtendimento() {
  const { toast } = useToast();
  const [modo, setModo] = useState<'texto' | 'voz'>('texto');
  const [pipecatUrl, setPipecatUrl] = useState('');
  const [mensagens, setMensagens] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente de atendimento do LeadMaster. Como posso ajudar?' },
  ]);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const config = await api.config.obter();
    setModo(config.agentes.atendimento.modo === 'voz' ? 'voz' : 'texto');
    setPipecatUrl(config.integracoes.pipecat.url || '');
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  const salvarModo = async (novoModo: 'texto' | 'voz') => {
    setModo(novoModo);
    try {
      await api.config.salvar({
        agentes: { atendimento: { modo: novoModo } },
        integracoes: { pipecat: { url: pipecatUrl } },
      } as never);
      toast('sucesso', `Modo de atendimento: ${novoModo === 'voz' ? 'voz (pipecat)' : 'texto (LLM)'}.`);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar modo.');
    }
  };

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto) return;
    const proximas = [...mensagens, { role: 'user' as const, content: texto }];
    setMensagens(proximas);
    setEntrada('');
    setEnviando(true);
    try {
      const r = await api.agentes.chat(
        proximas.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      );
      if (r.ok && r.resposta) {
        setMensagens([...proximas, { role: 'assistant', content: r.resposta }]);
      } else {
        setMensagens([...proximas, { role: 'assistant', content: `⚠ ${r.mensagem ?? 'Sem resposta.'}` }]);
        toast('erro', r.mensagem ?? 'Sem resposta do agente.');
      }
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha no chat.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Modo do agente de atendimento</h3>
        <div className="flex gap-3">
          {[
            { id: 'texto' as const, rotulo: 'Texto (LLM)', icone: 'fas fa-keyboard', descricao: 'Chat via LLM configurado' },
            { id: 'voz' as const, rotulo: 'Voz (pipecat)', icone: 'fas fa-microphone', descricao: 'Atendimento por voz' },
          ].map((opcao) => (
            <button
              key={opcao.id}
              onClick={() => salvarModo(opcao.id)}
              className={cn(
                'flex-1 px-4 py-3 rounded-lg border text-left transition',
                modo === opcao.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200 hover:bg-gray-50',
              )}
            >
              <p className={cn('text-sm font-medium flex items-center gap-2', modo === opcao.id ? 'text-indigo-700' : 'text-gray-600')}>
                <i className={opcao.icone} /> {opcao.rotulo}
              </p>
              <p className="text-xs text-gray-400 mt-1">{opcao.descricao}</p>
            </button>
          ))}
        </div>
        {modo === 'voz' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">URL do serviço pipecat</label>
            <input
              value={pipecatUrl}
              onChange={(e) => setPipecatUrl(e.target.value)}
              onBlur={() => salvarModo('voz')}
              placeholder="http://localhost:5000"
              className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
        )}
      </div>

      {/* Teste de conversa */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Testar conversa</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
          {mensagens.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm',
                  m.role === 'user' ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-700 rounded-bl-sm',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {enviando && (
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <i className="fas fa-spinner fa-spin" /> pensando...
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
            placeholder="Digite uma mensagem do cliente para testar..."
            className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
          />
          <button
            onClick={enviar}
            disabled={enviando}
            className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            <i className="fas fa-paper-plane" />
          </button>
        </div>
      </div>
    </div>
  );
}
