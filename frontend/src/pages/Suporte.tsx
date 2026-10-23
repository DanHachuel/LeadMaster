import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Accordion } from '../components/Accordion';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';

type Doutor = Awaited<ReturnType<typeof api.doctor>>;

export function Suporte() {
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
    // Executa automaticamente ao abrir a página (dados locais, custo zero).
    executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
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
            <Linha rotulo="Uploads hoje" valor={String(doutor.uploads_hoje)} />
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          <i className="fas fa-circle-question text-indigo-400 mr-2" /> Perguntas frequentes
        </h3>
        <div className="space-y-2">
          <Accordion titulo="Meus dados ficam na nuvem?" icone="fas fa-cloud">
            Não. O LeadMaster é 100% local: todos os dados (leads, campanhas, pipeline, configuração) ficam em
            arquivos JSON na sua pasta de dados.
          </Accordion>
          <Accordion titulo="Preciso de servidor para os vídeos?" icone="fas fa-video">
            Sim, localmente: o MoneyPrinterTurbo (porta 8080) produz os vídeos wide e o Short-Video-Maker (porta
            3123) os Shorts. Configure as URLs em Ferramentas.
          </Accordion>
          <Accordion titulo="Como publico no YouTube?" icone="fab fa-youtube">
            Configure o uploader em Ferramentas → Upload YouTube (ou o fallback youtube-uploader-mcp). O pipeline
            publica como <strong>não listado</strong> e vira <strong>público</strong> automaticamente após 1 hora —
            até 50 uploads por dia.
          </Accordion>
          <Accordion titulo="Onde reporto problemas?" icone="fas fa-bug">
            Abra uma issue em github.com/DanHachuel/LeadMaster ou use a página de diagnóstico acima ao pedir ajuda —
            ela resume todo o ambiente.
          </Accordion>
        </div>
      </div>

      <div className="bg-[#1e1b4b] text-white rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm font-semibold">LeadMaster — SaaS local de prospecção e automação de conteúdo</p>
          <p className="text-xs text-gray-300 mt-1">Instalável via npx · dados 100% locais · sem mensalidade de nuvem</p>
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
    moneyprinter: 'MoneyPrinterTurbo',
    short_video_maker: 'Short-Video-Maker',
    uploader_youtube: 'Uploader YouTube',
    llm_configurado: 'LLM',
    openmontage: 'OpenMontage',
    openoutreach: 'OpenOutreach',
  };
  return mapa[chave] ?? chave;
}
