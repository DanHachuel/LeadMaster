import { useState } from 'react';
import { Modal } from './Modal';
import { primeiraLetra } from '../lib/format';
import { useTheme } from '../hooks/useTheme';

interface Props {
  titulo: string;
  nomeUsuario: string;
}

const PASSOS_TUTORIAL = [
  { icone: 'fas fa-users', texto: 'Cadastre leads manualmente ou importe pelos Extratores (Maps, Instagram, CNPJ).' },
  { icone: 'fas fa-columns', texto: 'Arraste os cards no CRM conforme avança no funil (Leads → Em contato → Proposta → Fechado).' },
  { icone: 'fas fa-bullhorn', texto: 'Monte campanhas de disparo com seus templates e acompanhe as taxas no Painel.' },
  { icone: 'fas fa-robot', texto: 'Use os Agentes (disparo e atendimento) e configure o LLM em Ferramentas para turbiná-los.' },
];

/** Header do protótipo: título da página, tutorial, tema, avatar e nome. */
export function Header({ titulo, nomeUsuario }: Props) {
  const [tutorialAberto, setTutorialAberto] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const escuro = theme === 'dark';

  return (
    <header className="bg-[var(--bg-secondary)] shadow-sm px-8 py-4 flex items-center justify-between shrink-0 border-b border-[var(--border-color)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{titulo}</h2>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setTutorialAberto(true)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <i className="fas fa-play-circle mr-1" /> Ver tutorial
        </button>
        {/* Alternância de tema (lua = escurecer quando claro; sol = clarear quando escuro) */}
        <button
          onClick={toggleTheme}
          aria-label={escuro ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          title={escuro ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-indigo-600 transition"
        >
          <i className={escuro ? 'fas fa-sun' : 'fas fa-moon'} />
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
          {primeiraLetra(nomeUsuario)}
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">{nomeUsuario}</span>
      </div>

      <Modal aberto={tutorialAberto} onFechar={() => setTutorialAberto(false)} titulo="Tutorial rápido" icone="fas fa-graduation-cap">
        <ol className="space-y-4">
          {PASSOS_TUTORIAL.map((passo, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <i className={passo.icone} />
              </span>
              <p className="text-sm text-gray-600 pt-1.5">{passo.texto}</p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-gray-400 mt-5">
          Dica: o LLM (para enriquecimento e agentes) é configurado em Ferramentas.
        </p>
      </Modal>
    </header>
  );
}
