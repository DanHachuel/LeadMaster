import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Modal } from '../components/Modal';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

/**
 * Conexões — gateways de mensageria. Card do WhatsApp via gateway local
 * (OpenWA/WAHA): status com polling de 5s, botão grande "Conectar WhatsApp"
 * (Fitts), QR Code em modal com spinner "Aguardando leitura do celular..."
 * (Zeigarnik) e badge verde esmeralda quando conectado (von Restorff).
 */
export function Conexoes() {
  const { toast } = useToast();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [modalQr, setModalQr] = useState(false);

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

  const conectar = async () => {
    try {
      await api.whatsapp.conectar();
      setModalQr(true);
      await carregarQr();
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        toast('erro', `${e.message} Configure o gateway em Ferramentas → WhatsApp.`);
      } else {
        toast('erro', e instanceof Error ? e.message : 'Falha ao iniciar sessão.');
      }
    }
  };

  const carregarQr = async () => {
    try {
      const resp = await fetch(api.whatsapp.qrUrl());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      if (qrUrl) URL.revokeObjectURL(qrUrl);
      setQrUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao obter QR Code.');
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
            {/* Pulso verde quando conectado (Zeigarnik/von Restorff) */}
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
            {(statusQuery.error as Error).message} — configure o gateway em Ferramentas → WhatsApp.
          </p>
        )}

        {/* Botão grande (Lei de Fitts) */}
        {!conectado && (
          <button
            onClick={conectar}
            className="w-full md:w-auto px-8 py-3.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            <i className="fas fa-qrcode mr-2" /> Conectar WhatsApp
          </button>
        )}
        {conectado && (
          <p className="text-sm text-emerald-600 font-medium">
            <i className="fas fa-circle-check mr-1" /> Pronto para disparar. As campanhas ativas enviam
            mensagens reais por este gateway.
          </p>
        )}
      </div>

      {/* Modal do QR Code */}
      <Modal aberto={modalQr} onFechar={() => setModalQr(false)} titulo="Conectar WhatsApp" icone="fas fa-qrcode">
        <div className="space-y-4 text-center">
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code do WhatsApp" className="mx-auto rounded-lg border border-gray-100" style={{ width: 260 }} />
          ) : (
            <div className="py-10 text-gray-300">
              <i className="fas fa-spinner fa-spin text-3xl" />
            </div>
          )}
          <p className="text-sm text-gray-600 font-medium">Aguardando leitura do celular...</p>
          <ProgressBar valor={aguardando ? 60 : 100} />
          <p className="text-xs text-gray-400">
            No WhatsApp do celular: <strong>Aparelhos conectados → Conectar aparelho</strong> e aponte para
            o código. A tela atualiza sozinha (verificação a cada 5s).
          </p>
        </div>
      </Modal>
    </div>
  );
}
