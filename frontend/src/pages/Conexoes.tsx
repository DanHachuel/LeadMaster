import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Accordion } from '../components/Accordion';
import { Modal } from '../components/Modal';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

const QR_REFRESH_SEGUNDOS = 10; // polling do QR enquanto o modal está aberto
const QR_EXPIRA_SEGUNDOS = 60; // referência visual de validade do código

/**
 * Conexões — gateways de mensageria. Card do WhatsApp via gateway local
 * (OpenWA/WAHA): instruções em accordion (Hick), polling de status 5s, botão
 * grande "Conectar WhatsApp" (Fitts), modal do QR com fundo branco e contador
 * de validade (Zeigarnik), botão verde "Enviar Mensagem de Teste" (von
 * Restorff) e toast acionável quando o gateway está offline.
 */
export function Conexoes() {
  const { toast } = useToast();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [modalQr, setModalQr] = useState(false);
  const [qrSegundos, setQrSegundos] = useState(QR_EXPIRA_SEGUNDOS);
  const [modalTeste, setModalTeste] = useState(false);
  const [testeTelefone, setTesteTelefone] = useState('');
  const [testeMensagem, setTesteMensagem] = useState('Olá! Mensagem de teste do LeadMaster 🚀');
  const [enviandoTeste, setEnviandoTeste] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.whatsapp.status(),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const estado = statusQuery.data?.estado ?? 'desconectado';
  const conectado = estado === 'conectado';
  const aguardando = estado === 'aguardando_qr';

  // Conectou (QR lido)? Fecha o modal automaticamente.
  useEffect(() => {
    if (conectado && modalQr) {
      setModalQr(false);
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
        setQrUrl(null);
      }
      toast('sucesso', 'WhatsApp conectado!');
    }
  }, [conectado, modalQr, qrUrl, toast]);

  // Contador regressivo de validade do QR + refresh da imagem (Zeigarnik).
  useEffect(() => {
    if (!modalQr) return;
    setQrSegundos(QR_EXPIRA_SEGUNDOS);
    const contador = setInterval(() => setQrSegundos((s) => Math.max(0, s - 1)), 1000);
    const refresh = setInterval(() => { carregarQr(true); }, QR_REFRESH_SEGUNDOS * 1000);
    return () => { clearInterval(contador); clearInterval(refresh); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalQr]);

  const conectar = async () => {
    try {
      await api.whatsapp.conectar();
      setModalQr(true);
      await carregarQr();
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        toast('erro', 'Gateway do WhatsApp não encontrado. Verifique se o OpenWA está rodando.');
      } else {
        toast('erro', e instanceof Error ? e.message : 'Falha ao iniciar sessão.');
      }
    }
  };

  const carregarQr = useCallback(async (silencioso = false) => {
    try {
      const resp = await fetch(api.whatsapp.qrUrl());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      setQrUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return URL.createObjectURL(blob);
      });
      setQrSegundos(QR_EXPIRA_SEGUNDOS);
    } catch (e) {
      if (!silencioso) {
        toast('erro', e instanceof Error ? e.message : 'Falha ao obter QR Code.');
        setModalQr(false);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps -- funções auxiliares estáveis o suficiente para a UI

  useEffect(() => {
    if (!statusQuery.error) return;
    if (statusQuery.error instanceof ApiError) return; // card já mostra o aviso
  }, [statusQuery.error]);

  const enviarTeste = async () => {
    if (!testeTelefone.trim()) {
      toast('erro', 'Informe o número do celular (com DDD).');
      return;
    }
    setEnviandoTeste(true);
    try {
      const r = await api.whatsapp.testeEnvio(testeTelefone.trim(), testeMensagem);
      if (r.ok) {
        toast('sucesso', 'Mensagem de teste enviada! Confira o WhatsApp.');
        setModalTeste(false);
        setTesteTelefone('');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        toast('erro', `Gateway do WhatsApp não encontrado. Verifique se o OpenWA está rodando. (${e.message})`);
      } else {
        toast('erro', e instanceof Error ? e.message : 'Falha ao enviar mensagem de teste.');
      }
    } finally {
      setEnviandoTeste(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
              <i className="fab fa-whatsapp text-green-600 text-xl" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-gray-800">WhatsApp</h3>
              <p className="text-xs text-gray-400">Gateway local (OpenWA / WAHA) · disparos reais</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conectado && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
            <StatusBadge
              status={conectado ? 'ativo' : aguardando ? 'pausada' : 'inativo'}
              rotulo={conectado ? 'Conectado' : aguardando ? 'Aguardando QR Code' : 'Desconectado'}
            />
          </div>
        </div>

        {statusQuery.data?.numero && conectado && (
          <p className="text-xs text-gray-500">
            <i className="fas fa-phone mr-1" /> Conta: <strong>{statusQuery.data.numero}</strong>
          </p>
        )}

        {statusQuery.error && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <i className="fas fa-triangle-exclamation mr-1" />
            Gateway do WhatsApp não encontrado. Verifique se o OpenWA está rodando e configurado em Ferramentas.
          </p>
        )}

        {/* Instruções passo a passo (Lei de Hick) — só quando ainda não conectado */}
        {!conectado && (
          <Accordion titulo="Como conectar — passo a passo" icone="fas fa-list-ol">
            <ol className="text-sm text-gray-600 space-y-2 list-decimal pl-5">
              <li>
                Certifique-se de que o <strong>OpenWA</strong> (ou WAHA) está rodando localmente. Exemplo com
                Docker: <code className="bg-gray-100 px-1 rounded text-xs">docker run -p 2785:2785 openwa</code>
              </li>
              <li>
                Vá em <strong>Ferramentas</strong>, informe a URL do Gateway (ex.:{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">http://127.0.0.1:2785</code>) e a API Key.
              </li>
              <li>
                Clique em <strong>“Conectar WhatsApp”</strong> abaixo para gerar o QR Code.
              </li>
              <li>
                Escaneie o QR Code com o celular: <strong>WhatsApp → Dispositivos Conectados → Conectar
                aparelho</strong>.
              </li>
            </ol>
          </Accordion>
        )}

        {/* Botão grande (Lei de Fitts) + teste quando conectado (von Restorff) */}
        <div className="flex flex-wrap items-center gap-3">
          {!conectado && (
            <button
              onClick={conectar}
              className="px-8 py-3.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
            >
              <i className="fas fa-qrcode mr-2" /> Conectar WhatsApp
            </button>
          )}
          {conectado && (
            <>
              <p className="text-sm text-emerald-600 font-medium">
                <i className="fas fa-circle-check mr-1" /> Pronto para disparar.
              </p>
              <button
                onClick={() => setModalTeste(true)}
                className="px-6 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition shadow-sm"
              >
                <i className="fas fa-paper-plane mr-2" /> Enviar Mensagem de Teste
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal do QR Code */}
      <Modal aberto={modalQr} onFechar={() => setModalQr(false)} titulo="Conectar WhatsApp" icone="fas fa-qrcode">
        <div className="space-y-4 text-center">
          {/* QR em moldura branca com margem (leitura pela câmera) */}
          <div className="mx-auto bg-white border-2 border-gray-100 rounded-xl p-4 inline-block">
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code do WhatsApp" width={240} height={240} className="block" />
            ) : (
              <div className="text-gray-300 flex items-center justify-center" style={{ width: 240, height: 240 }}>
                <i className="fas fa-spinner fa-spin text-3xl" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
            </span>
            <p className="text-sm text-gray-600 font-medium">Aguardando leitura do celular...</p>
          </div>
          {/* Zeigarnik: validade do código + progresso do refresh */}
          <div className="max-w-xs mx-auto space-y-1">
            <ProgressBar valor={((QR_EXPIRA_SEGUNDOS - qrSegundos) / QR_EXPIRA_SEGUNDOS) * 100} />
            <p className="text-xs text-gray-400">
              O código é renovado automaticamente · expira em ~{qrSegundos}s
            </p>
          </div>
          <p className="text-xs text-gray-400">
            No WhatsApp do celular: <strong>Aparelhos conectados → Conectar aparelho</strong> e aponte para
            o código. A tela atualiza sozinha (verificação a cada {QR_REFRESH_SEGUNDOS}s).
          </p>
        </div>
      </Modal>

      {/* Modal: mensagem de teste */}
      <Modal aberto={modalTeste} onFechar={() => setModalTeste(false)} titulo="Enviar Mensagem de Teste" icone="fas fa-paper-plane">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Número do celular (com DDD)</label>
            <input
              value={testeTelefone}
              onChange={(e) => setTesteTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mensagem</label>
            <textarea
              value={testeMensagem}
              onChange={(e) => setTesteMensagem(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModalTeste(false)}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={enviarTeste}
              disabled={enviandoTeste}
              className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
            >
              <i className={cn('fas fa-paper-plane mr-2', enviandoTeste && 'fa-spin')} />
              {enviandoTeste ? 'Enviando...' : 'Enviar Teste'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
