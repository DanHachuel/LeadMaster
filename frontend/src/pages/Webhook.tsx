import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

const TODOS_EVENTOS = [
  { id: 'lead.criado', rotulo: 'Lead criado' },
  { id: 'lead.etapa', rotulo: 'Lead mudou de etapa' },
  { id: 'campanha.concluida', rotulo: 'Campanha concluída' },
  { id: 'video.publicado', rotulo: 'Vídeo publicado' },
];

export function Webhook() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<string>('');
  const [resultadoAberto, setResultadoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const wb = await api.webhook.obter();
    setUrl(wb.url);
    setEventos(new Set(wb.eventos));
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
    setSalvando(true);
    try {
      await api.webhook.salvar({ url: url.trim(), eventos: [...eventos] });
      toast('sucesso', 'Webhook salvo.');
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
    try {
      const r = await api.webhook.testar(url.trim());
      if (r.ok) {
        setResultado(`✅ HTTP ${r.status_http} — o endpoint recebeu o evento de teste.\n\n${r.resposta ?? ''}`);
      } else {
        setResultado(`❌ ${r.mensagem ?? 'Falha no teste.'}`);
      }
      setResultadoAberto(true);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha no teste.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <p className="text-sm text-gray-500">
          Receba eventos do LeadMaster (lead criado, mudança de etapa, campanha concluída, vídeo publicado) em
          qualquer endpoint local ou externo — útil para integrar com automações (n8n, Make, Zapier etc.).
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">URL do webhook</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://seu-endpoint.com/webhook"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Eventos enviados</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {TODOS_EVENTOS.map((evento) => (
              <label
                key={evento.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm cursor-pointer transition',
                  eventos.has(evento.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={eventos.has(evento.id)}
                  onChange={() => alternar(evento.id)}
                  className="w-4 h-4 accent-indigo-500"
                />
                {evento.rotulo}
                <code className="text-[10px] text-gray-400 ml-auto">{evento.id}</code>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            <i className="fas fa-save mr-2" /> Salvar
          </button>
          <button
            onClick={testar}
            className="px-4 py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
          >
            <i className="fas fa-paper-plane mr-2" /> Enviar evento de teste
          </button>
        </div>
      </div>

      <Modal aberto={resultadoAberto} onFechar={() => setResultadoAberto(false)} titulo="Resultado do teste" icone="fas fa-satellite-dish">
        <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">{resultado}</pre>
      </Modal>
    </div>
  );
}
