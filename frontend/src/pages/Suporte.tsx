import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Accordion } from '../components/Accordion';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

type Doutor = Awaited<ReturnType<typeof api.doctor>>;

interface Mensagem {
  papel: 'user' | 'assistant';
  conteudo: string;
}

/**
 * Suporte: chat de teste do Agente de Atendimento (LLM) + diagnóstico do
 * ambiente e FAQ. Balões do usuário em gradiente à direita (von Restorff),
 * respostas do agente em cinza à esquerda; indicador "digitando..." (três
 * pontinhos animados) e auto-scroll durante a espera (Efeito Zeigarnik).
 */
export function Suporte() {
  const { toast } = useToast();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  // Restaura a conversa salva em chat_history.json (não perde contexto ao recarregar).
  useEffect(() => {
    api.agentes
      .chatHistorico()
      .then((hist) => setMensagens(hist.map((m) => ({ papel: m.papel, conteudo: m.conteudo }))))
      .catch(() => {
        /* histórico é conveniência — falhar aqui não pode travar a página */
      });
  }, []);

  // Auto-scroll para a última mensagem (ou para o indicador de digitação).
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mensagens, enviando]);

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto || enviando) return; // Nielsen: mensagens vazias não são enviadas
    setEntrada('');
    setMensagens((atual) => [...atual, { papel: 'user', conteudo: texto }]);
    setEnviando(true);
    try {
      const r = await api.agentes.chatSimples(texto);
      if (r.ok && r.resposta) {
        setMensagens((atual) => [...atual, { papel: 'assistant', conteudo: r.resposta! }]);
      } else {
        setMensagens((atual) => [
          ...atual,
          { papel: 'assistant', conteudo: r.mensagem ?? 'Não consegui responder agora. Tente novamente.' },
        ]);
      }
    } catch (e) {
      setMensagens((atual) => [
        ...atual,
        { papel: 'assistant', conteudo: e instanceof Error ? e.message : 'Falha ao falar com o agente.' },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  const limpar = async () => {
    try {
      await api.agentes.chatLimpar();
      setMensagens([]);
      toast('sucesso', 'Conversa apagada.');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao limpar a conversa.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Chat de teste do agente */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-robot text-indigo-400" /> Agente de Atendimento — chat de teste
          </h3>
          {mensagens.length > 0 && (
            <button
              onClick={limpar}
              className="text-xs text-gray-500 hover:text-red-600 font-medium"
              title="Apagar a conversa salva"
            >
              <i className="fas fa-trash-can mr-1" /> Limpar
            </button>
          )}
        </div>

        {/* Histórico (balões) */}
        <div className="p-5 space-y-4 h-[52vh] overflow-y-auto bg-gray-50/40">
          {mensagens.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-gray-400">
              <i className="fas fa-comments text-3xl text-gray-200" />
              <p className="text-sm">Nenhuma mensagem ainda.</p>
              <p className="text-xs text-gray-300">
                Teste o Agente de Atendimento abaixo — configure a LLM em Ferramentas para respostas reais.
              </p>
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} className={cn('flex', m.papel === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm',
                  m.papel === 'user'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-br-md'
                    : 'bg-white text-gray-700 border border-gray-100 rounded-bl-md',
                )}
              >
                {m.conteudo}
              </div>
            </div>
          ))}
          {/* Zeigarnik: três pontinhos animados enquanto a LLM pensa */}
          {enviando && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs text-gray-400 ml-1">digitando...</span>
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Campo de envio largo (Fitts) — Enter envia */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100 bg-white">
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            disabled={enviando}
            placeholder="Escreva sua mensagem para o agente..."
            className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none disabled:opacity-60"
          />
          <button
            onClick={enviar}
            disabled={enviando || !entrada.trim()}
            className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition disabled:opacity-60 shadow-sm"
          >
            <i className={cn('fas fa-paper-plane mr-2', enviando && 'fa-spin')} />
            {enviando ? 'Enviando' : 'Enviar'}
          </button>
        </div>
      </div>

      <Diagnostico />
      <Faq />
      <Rodape />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnóstico do ambiente (dados locais, custo zero)
// ---------------------------------------------------------------------------

function Diagnostico() {
  const { toast } = useToast();
  const [doutor, setDoutor] = useState<Doutor | null>(null);
  const [rodando, setRodando] = useState(false);

  const executar = async () => {
    setRodando(true);
    try {
      setDoutor(await api.doctor());
      toast('sucesso', 'Diagnóstico concluído.');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha no diagnóstico.');
    } finally {
      setRodando(false);
    }
  };

  useEffect(() => {
    executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <i className="fas fa-heart-pulse text-indigo-400" /> Diagnóstico do ambiente
        </h3>
        <button
          onClick={executar}
          disabled={rodando}
          className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 disabled:opacity-60"
        >
          <i className={cn('fas fa-rotate mr-1', rodando && 'fa-spin')} /> Executar novamente
        </button>
      </div>
      {doutor && (
        <div className="mt-4 space-y-2 text-sm">
          <Linha rotulo="Versão do LeadMaster" valor={doutor.versao} />
          <Linha rotulo="Python" valor={doutor.python} />
          <Linha rotulo="Sistema" valor={doutor.sistema} />
          <Linha rotulo="Interface construída (dist)" valor={doutor.dist_frontend ? 'presente' : 'ausente (modo dev)'} />
          <Linha rotulo="Pasta de dados" valor={doutor.storage} />
          <div className="pt-2 flex flex-wrap gap-2">
            {Object.entries(doutor.integracoes).map(([chave, ok]) => (
              <StatusBadge
                key={chave}
                status={ok ? 'ativo' : 'inativo'}
                rotulo={`${rotuloIntegracao(chave)}: ${ok ? 'ativo' : 'inativo'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Faq() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        <i className="fas fa-circle-question text-indigo-400 mr-2" /> Perguntas frequentes
      </h3>
      <div className="space-y-2">
        <Accordion titulo="Como o agente de atendimento usa a LLM?" icone="fas fa-brain">
          O chat acima envia sua mensagem para a API configurada em <strong>Ferramentas → LLM</strong> com o
          prompt do sistema do agente (editável em Agentes). Sem chave configurada, o chat avisa o que fazer —
          nunca fingimos uma resposta de IA.
        </Accordion>
        <Accordion titulo="Minhas conversas ficam salvas?" icone="fas fa-floppy-disk">
          Sim, apenas localmente: o histórico fica em <strong>chat_history.json</strong> na sua pasta de dados e
          é restaurado ao recarregar a página. Use <strong>Limpar</strong> para apagar tudo.
        </Accordion>
        <Accordion titulo="Meus dados ficam na nuvem?" icone="fas fa-cloud">
          Não. O LeadMaster é 100% local: todos os dados (leads, campanhas, configuração e conversas) ficam em
          arquivos JSON na sua pasta de dados.
        </Accordion>
        <Accordion titulo="Onde reporto problemas?" icone="fas fa-bug">
          Abra uma issue em github.com/DanHachuel/LeadMaster ou use o diagnóstico acima ao pedir ajuda — ele
          resume todo o ambiente.
        </Accordion>
      </div>
    </div>
  );
}

function Rodape() {
  return (
    <div className="bg-[#1e1b4b] text-white rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
      <div>
        <p className="text-sm font-semibold">LeadMaster — SaaS local de prospecção e automação de conteúdo</p>
        <p className="text-xs text-indigo-200 mt-1">Instalável via npx · dados 100% locais · sem mensalidade de nuvem</p>
      </div>
      <a
        href="https://github.com/DanHachuel/LeadMaster"
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition"
      >
        <i className="fab fa-github mr-2" /> Repositório
      </a>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
      <span className="text-xs text-gray-500">{rotulo}</span>
      <span className="text-xs font-medium text-gray-700 text-right break-all max-w-[60%]">{valor}</span>
    </div>
  );
}

function rotuloIntegracao(chave: string): string {
  const mapa: Record<string, string> = {
    llm_configurado: 'LLM',
    openoutreach: 'OpenOutreach',
    pipecat: 'pipecat',
  };
  return mapa[chave] ?? chave;
}
