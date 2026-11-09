import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { cn, dataHora } from '../lib/format';

const EVENTOS = [
  { id: 'lead.criado', rotulo: 'Lead Criado', descricao: 'Um novo lead foi extraído ou cadastrado' },
  { id: 'campanha.iniciada', rotulo: 'Campanha Iniciada', descricao: 'Uma campanha de disparo começou a rodar' },
  { id: 'campanha.concluida', rotulo: 'Campanha Finalizada', descricao: 'Uma campanha terminou os envios' },
];

function urlValida(url: string): boolean {
  const u = (url || '').trim();
  return u === '' || u.startsWith('http://') || u.startsWith('https://');
}

/**
 * Webhooks (integrações externas): URL + eventos selecionados, "Salvar
 * Configurações" em gradiente (Fitts) e "Testar Webhook" em outline (von
 * Restorff). Prevenção de erros (Nielsen): URL fora do padrão http(s) bloqueia
 * o salvamento e marca o input em vermelho.
 */
export function Webhook() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<Set<string>>(new Set());
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);
  const [resultado, setResultado] = useState('');
  const [resultadoAberto, setResultadoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);

  const carregar = useCallback(async () => {
    const wb = await api.webhook.obter();
    setUrl(wb.url);
    setEventos(new Set(wb.eventos));
    setUltimoTeste(wb.ultimo_teste);
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  const alternar = (id: string) =>
    setEventos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const salvar = async () => {
    if (!urlValida(url)) {
      toast('erro', 'A URL deve começar com http:// ou https://.');
      return;
    }
    setSalvando(true);
    try {
      await api.webhook.salvar({ url: url.trim(), eventos: [...eventos] });
      toast('sucesso', 'Configurações de webhook salvas.');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar webhook.');
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    if (!url.trim()) {
      toast('erro', 'Informe a URL do webhook antes de testar.');
      return;
    }
    if (!urlValida(url)) {
      toast('erro', 'A URL deve começar com http:// ou https://.');
      return;
    }
    setTestando(true);
    try {
      const r = await api.webhook.testar(url.trim());
      if (r.ok) {
        setUltimoTeste(r.ultimo_teste ?? new Date().toISOString());
        setResultado(`✅ HTTP ${r.status_http} — o endpoint recebeu o evento de teste.\n\n${r.resposta ?? ''}`);
        toast('sucesso', 'Webhook respondeu com sucesso!');
      } else {
        setResultado(`❌ ${r.mensagem ?? 'Falha no teste.'}`);
        toast('erro', r.mensagem ?? 'Falha no teste do webhook.');
      }
      setResultadoAberto(true);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha no teste.');
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-gray-500">
            Receba eventos do LeadMaster em automações externas (n8n, Make, Zapier etc.).
          </p>
          {/* Histórico (bônus) */}
          <span className="text-xs text-gray-400">
            <i className="fas fa-clock-rotate-left mr-1" />
            {ultimoTeste ? `Último teste: ${dataHora(ultimoTeste)}` : 'Nenhum teste realizado ainda'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">URL do Webhook</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://n8n.seu-site.com/webhook/leadmaster"
            className={cn(
              'w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:ring-2',
              urlValida(url) ? 'border-gray-200 focus:ring-indigo-400' : 'border-red-400 focus:ring-red-400',
            )}
          />
          {!urlValida(url) && (
            <p className="text-xs text-red-600 mt-1">
              <i className="fas fa-circle-exclamation mr-1" /> A URL deve começar com http:// ou https://.
            </p>
          )}
        </div>

        {/* Lei de Hick: poucos eventos, exibidos diretamente e limpos */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Eventos a disparar</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {EVENTOS.map((evento) => (
              <label
                key={evento.id}
                className={cn(
                  'flex flex-col gap-1 px-4 py-3 rounded-lg border text-sm cursor-pointer transition',
                  eventos.has(evento.id)
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={eventos.has(evento.id)}
                    onChange={() => alternar(evento.id)}
                    className="w-4 h-4 accent-indigo-500"
                  />
                  {evento.rotulo}
                </span>
                <span className="text-[11px] text-gray-400 pl-6">{evento.descricao}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Primário em gradiente */}
          <button
            onClick={salvar}
            disabled={salvando || !urlValida(url)}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 disabled:opacity-50 transition shadow-sm"
          >
            <i className="fas fa-save mr-2" /> {salvando ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          {/* Secundário em outline (von Restorff) */}
          <button
            onClick={testar}
            disabled={testando}
            className="px-6 py-2.5 text-sm font-medium text-indigo-600 bg-white border-2 border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition"
          >
            <i className="fas fa-paper-plane mr-2" /> {testando ? 'Testando...' : 'Testar Webhook'}
          </button>
        </div>
      </div>

      <Modal aberto={resultadoAberto} onFechar={() => setResultadoAberto(false)} titulo="Resultado do teste" icone="fas fa-satellite-dish">
        <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">{resultado}</pre>
      </Modal>
    </div>
  );
}
