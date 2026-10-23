import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { JobPipeline } from '../lib/types';
import { Accordion } from '../components/Accordion';
import { Modal } from '../components/Modal';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn, dataHora, soHora } from '../lib/format';

const ETAPA_ICONES: Record<string, string> = {
  roteiro: 'fas fa-file-lines',
  thumbnail: 'fas fa-image',
  wide: 'fas fa-film',
  shorts: 'fas fa-mobile-screen',
  upload: 'fab fa-youtube',
};

const CORES_ETAPA: Record<string, string> = {
  pendente: 'bg-gray-100 text-gray-400 border-gray-200',
  em_andamento: 'bg-blue-50 text-blue-600 border-blue-300 animate-pulse',
  concluida: 'bg-green-50 text-green-600 border-green-300',
  erro: 'bg-red-50 text-red-600 border-red-300',
  pulada: 'bg-gray-50 text-gray-400 border-gray-200 border-dashed',
};

export function Pipeline() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobPipeline[]>([]);
  const [integracoes, setIntegracoes] = useState<Record<string, boolean>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Formulário
  const [tema, setTema] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tom, setTom] = useState('informativo');
  const [duracaoMin, setDuracaoMin] = useState(8);
  const [keyword, setKeyword] = useState('');
  const [formatos, setFormatos] = useState<Set<string>>(new Set(['wide', 'shorts']));

  const carregar = useCallback(async () => {
    try {
      const [js, ints] = await Promise.all([api.pipeline.listar(), api.integracoes()]);
      setJobs(js);
      setIntegracoes(ints);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao carregar pipeline.');
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Zeigarnik: sonda enquanto houver job ativo
  const temAtivo = jobs.some((j) => j.status === 'em_andamento');
  useEffect(() => {
    if (!temAtivo) return;
    const intervalo = setInterval(() => {
      api.pipeline.listar().then(setJobs).catch(() => undefined);
    }, 3000);
    return () => clearInterval(intervalo);
  }, [temAtivo]);

  const alternarFormato = (f: string) =>
    setFormatos((atual) => {
      const novo = new Set(atual);
      if (novo.has(f)) novo.delete(f);
      else novo.add(f);
      return novo;
    });

  const criarJob = async () => {
    if (tema.trim().length < 3) {
      toast('erro', 'Descreva o tema do vídeo (mínimo 3 caracteres).');
      return;
    }
    if (formatos.size === 0) {
      toast('erro', 'Selecione ao menos um formato (Wide e/ou Shorts).');
      return;
    }
    try {
      await api.pipeline.criar({
        tema: tema.trim(),
        titulo: titulo.trim(),
        tom,
        duracao_min: duracaoMin,
        keyword_seo: keyword.trim(),
        formatos: [...formatos],
      });
      toast('sucesso', 'Vídeo criado — clique em Iniciar para rodar o pipeline.');
      setModalAberto(false);
      setTema('');
      setTitulo('');
      setKeyword('');
      setFormatos(new Set(['wide', 'shorts']));
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao criar job.');
    }
  };

  const agir = async (job: JobPipeline, acao: 'iniciar' | 'pausar' | 'parar' | 'repetir') => {
    try {
      const r = await api.pipeline.agir(job.id, acao);
      toast('sucesso', r.mensagem);
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Ação não permitida.');
    }
  };

  const alternarExpandido = (id: string) =>
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <div className="space-y-6">
      {/* Status das integrações (Lei de Miller: agrupadas em um bloco) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          {[
            { chave: 'llm', rotulo: 'LLM', icone: 'fas fa-brain' },
            { chave: 'moneyprinter', rotulo: 'MoneyPrinterTurbo', icone: 'fas fa-film' },
            { chave: 'short_video_maker', rotulo: 'Short-Video-Maker', icone: 'fas fa-mobile-screen' },
            { chave: 'uploader_youtube', rotulo: 'Uploader YouTube', icone: 'fab fa-youtube' },
          ].map((item) => (
            <span key={item.chave} className="flex items-center gap-1.5 text-gray-500">
              <span
                className={cn('w-2 h-2 rounded-full', integracoes[item.chave] ? 'bg-green-500' : 'bg-gray-300')}
                title={integracoes[item.chave] ? 'Configurado' : 'Não configurado — veja Ferramentas'}
              />
              <i className={cn(item.icone, integracoes[item.chave] ? 'text-gray-500' : 'text-gray-300')} /> {item.rotulo}
            </span>
          ))}
        </div>
        {/* CTA principal (Fitts + von Restorff) */}
        <button
          onClick={() => setModalAberto(true)}
          className="px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
        >
          <i className="fas fa-circle-play mr-2 text-base" /> Iniciar Novo Vídeo
        </button>
      </div>

      {jobs.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          <i className="fas fa-video text-3xl text-gray-200 block mb-3" />
          Nenhum vídeo no pipeline. Clique em <strong className="text-indigo-500">Iniciar Novo Vídeo</strong> para começar.
        </div>
      )}

      <div className="space-y-4">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            expandido={expandidos.has(job.id)}
            onAlternarExpandido={() => alternarExpandido(job.id)}
            onAgir={(acao) => agir(job, acao)}
          />
        ))}
      </div>

      {/* Modal: novo vídeo */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo vídeo faceless" icone="fas fa-circle-play" largura="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tema do vídeo *</label>
            <textarea
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              rows={2}
              placeholder="Ex.: Como automatizar prospecção de leads com IA em 2026"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              O roteiro terá 7.000–9.000 caracteres (gerado por LLM ou modelo local).
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Título (opcional)</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Se vazio, o LLM sugere um título"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Palavra-chave SEO</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ex.: prospecção com IA"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tom</label>
              <select
                value={tom}
                onChange={(e) => setTom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="informativo">Informativo</option>
                <option value="educativo">Educativo</option>
                <option value="inspirador">Inspirador</option>
                <option value="provocativo">Provocativo</option>
                <option value="storytelling">Storytelling</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Duração estimada</label>
              <select
                value={duracaoMin}
                onChange={(e) => setDuracaoMin(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {[3, 5, 8, 10, 15].map((min) => (
                  <option key={min} value={min}>
                    {min} minutos
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Formatos *</label>
            <div className="flex gap-3">
              {[
                { id: 'wide', rotulo: 'Wide 16:9 (YouTube)', icone: 'fas fa-film' },
                { id: 'shorts', rotulo: 'Shorts 9:16', icone: 'fas fa-mobile-screen' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => alternarFormato(f.id)}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2',
                    formatos.has(f.id)
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  <i className={f.icone} /> {f.rotulo}
                  {formatos.has(f.id) && <i className="fas fa-circle-check" />}
                </button>
              ))}
            </div>
          </div>

          <Accordion titulo="Como o pipeline funciona" icone="fas fa-circle-question">
            <ol className="text-xs text-gray-500 space-y-1 list-decimal pl-4">
              <li><strong>Roteiro</strong> — gerado por LLM (7k–9k caracteres) ou modelo local.</li>
              <li><strong>Thumbnail/Título</strong> — título otimizado + prompt de imagem.</li>
              <li><strong>Produção Wide</strong> — MoneyPrinterTurbo (localhost:8080) com fallback OpenMontage.</li>
              <li><strong>Produção Shorts</strong> — Short-Video-Maker (localhost:3123).</li>
              <li><strong>Upload</strong> — não listado, aguarda 1h e publica (até 50/dia).</li>
            </ol>
          </Accordion>

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setModalAberto(false)}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={criarJob}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
            >
              <i className="fas fa-plus mr-2" /> Criar vídeo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card do job
// ---------------------------------------------------------------------------

function JobCard({
  job,
  expandido,
  onAlternarExpandido,
  onAgir,
}: {
  job: JobPipeline;
  expandido: boolean;
  onAlternarExpandido: () => void;
  onAgir: (acao: 'iniciar' | 'pausar' | 'parar' | 'repetir') => void;
}) {
  const rodando = job.status === 'em_andamento';
  const temErro = job.status === 'erro';
  const retomavel = job.status === 'rascunho' || job.status === 'pausado' || job.status === 'cancelado';
  const concluidas = job.etapas.filter((e) => e.status === 'concluida' || e.status === 'pulada').length;
  const faltam = job.etapas.filter((e) => e.status !== 'concluida' && e.status !== 'pulada').length;

  const motivacao = useMemo(() => {
    if (job.status === 'concluido') return '🎉 Vídeo concluído do início ao fim!';
    if (temErro) return 'Uma etapa falhou — corrija a integração e clique em Repetir.';
    if (faltam === 0) return 'Finalizando...';
    return `Faltam ${faltam} etapa${faltam > 1 ? 's' : ''} para o upload 🚀`; // Gradiente de Meta
  }, [job.status, temErro, faltam]);

  const tituloJob = job.dados.titulo_gerado || job.titulo || job.tema;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
            <i className="fas fa-video text-indigo-400" /> {tituloJob}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            criado em {dataHora(job.criado_em)} · tom {job.tom} · {job.duracao_min} min ·{' '}
            {job.formatos.join(' + ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {job.status === 'em_andamento' && <i className="fas fa-spinner fa-spin text-indigo-500" />}
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Progresso (Zeigarnik) + meta (Gradiente de Meta) */}
      <div>
        <ProgressBar valor={job.progresso ?? 0} mostrarLabel />
        <p className="text-xs text-indigo-600 font-medium mt-2">{motivacao}</p>
      </div>

      {/* Etapas */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {job.etapas.map((etapa, i) => (
          <div key={etapa.id} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium',
                CORES_ETAPA[etapa.status],
              )}
              title={etapa.mensagem || etapa.nome}
            >
              <i className={ETAPA_ICONES[etapa.id]} />
              <span className="hidden sm:inline">{etapa.nome}</span>
              {etapa.status === 'erro' && <i className="fas fa-circle-exclamation" />}
              {etapa.status === 'pulada' && <span className="hidden sm:inline">(pulada)</span>}
            </div>
            {i < job.etapas.length - 1 && <i className="fas fa-chevron-right text-gray-200 mx-0.5" />}
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 flex-wrap">
        {(retomavel || temErro) && (
          <button
            onClick={() => onAgir(temErro ? 'repetir' : 'iniciar')}
            className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
          >
            <i className="fas fa-play mr-2" />
            {temErro ? 'Repetir' : job.status === 'pausado' || job.status === 'cancelado' ? 'Retomar' : 'Iniciar'}
          </button>
        )}
        {rodando && (
          <>
            <button
              onClick={() => onAgir('pausar')}
              className="px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
            >
              <i className="fas fa-pause mr-2" /> Pausar
            </button>
            <button
              onClick={() => onAgir('parar')}
              className="px-5 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <i className="fas fa-stop mr-2" /> Parar
            </button>
          </>
        )}
        <button
          onClick={onAlternarExpandido}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-auto"
        >
          <i className={cn('fas fa-chevron-down mr-1 transition-transform', expandido && 'rotate-180')} />
          {expandido ? 'Ocultar detalhes' : 'Ver detalhes'}
        </button>
      </div>

      {/* Upload info */}
      {job.upload?.url && (
        <div className="text-xs bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-indigo-700 flex items-center gap-2 flex-wrap">
          <i className="fab fa-youtube" />
          {job.upload.publicado_em ? (
            <span>Vídeo público desde {soHora(job.upload.publicado_em)} — </span>
          ) : job.upload.agenda_publicacao ? (
            <span>Não listado; publicação automática às {soHora(job.upload.agenda_publicacao)} — </span>
          ) : (
            <span>Enviado — </span>
          )}
          {job.upload.url}
          {job.upload.ultimo_erro && <span className="text-red-600">· último erro: {job.upload.ultimo_erro}</span>}
        </div>
      )}

      {/* Detalhes (Lei de Hick: escondidos até o usuário pedir) */}
      {expandido && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          {job.etapas.map((etapa) => (
            <div key={etapa.id} className="text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-700 flex items-center gap-2">
                  <i className={ETAPA_ICONES[etapa.id]} /> {etapa.nome}
                </p>
                <StatusBadge status={etapa.status} />
              </div>
              {etapa.mensagem && <p className="text-gray-500 mt-1 ml-5">{etapa.mensagem}</p>}
              {etapa.logs.length > 0 && (
                <pre className="ml-5 mt-1 bg-gray-50 border border-gray-100 rounded-lg p-2 text-[11px] text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {etapa.logs.join('\n')}
                </pre>
              )}
            </div>
          ))}
          {job.dados.roteiro && (
            <Accordion titulo={`Roteiro (${job.dados.roteiro_chars?.toLocaleString('pt-BR')} caracteres)`} icone="fas fa-file-lines">
              <pre className="text-[11px] text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-3">
                {job.dados.roteiro.slice(0, 2500)}
                {job.dados.roteiro_chars && job.dados.roteiro_chars > 2500 ? '\n\n[...]' : ''}
              </pre>
              <p className="text-[11px] text-gray-400">Arquivo local: {job.dados.arquivo_roteiro}</p>
            </Accordion>
          )}
          {(job.dados.thumbnail_prompt || job.dados.titulo_alternativo) && (
            <Accordion titulo="Título e thumbnail gerados" icone="fas fa-image">
              <p className="text-gray-600">
                <strong>Título alternativo:</strong> {job.dados.titulo_alternativo}
              </p>
              <p className="text-gray-600">
                <strong>Prompt da thumbnail:</strong> {job.dados.thumbnail_prompt}
              </p>
            </Accordion>
          )}
          {job.dados.videos_wide && job.dados.videos_wide.length > 0 && (
            <p className="text-xs text-gray-500">
              <i className="fas fa-film text-gray-400 mr-1" /> Vídeo(s) wide: {job.dados.videos_wide.join(', ')}
            </p>
          )}
          {concluidas === job.etapas.length && job.status === 'concluido' && (
            <p className="text-xs text-green-600 font-medium">
              <i className="fas fa-circle-check mr-1" /> Todas as {job.etapas.length} etapas finalizadas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
