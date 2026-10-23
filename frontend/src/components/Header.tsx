import { useState } from 'react';
import { Modal } from './Modal';
import { primeiraLetra } from '../lib/format';

interface Props {
  titulo: string;
  nomeUsuario: string;
}

const PASSOS_TUTORIAL = [
  { icone: 'fas fa-users', texto: 'Cadastre leads manualmente ou importe pelos Extratores (Maps, Instagram, CNPJ).' },
  { icone: 'fas fa-columns', texto: 'Arraste os cards no CRM conforme o avança no funil (Leads → Em contato → Proposta → Fechado).' },
  { icone: 'fas fa-video', texto: 'Crie um vídeo no Pipeline, inicie e acompanhe as 5 etapas até o upload no YouTube.' },
  { icone: 'fas fa-bullhorn', texto: 'Monte campanhas de disparo com seus templates e acompanhe as taxas no Painel.' },
];

/** Header do protótipo: título da página, tutorial, avatar e nome do usuário. */
export function Header({ titulo, nomeUsuario }: Props) {
  const [tutorialAberto, setTutorialAberto] = useState(false);

  return (
    <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{titulo}</h2>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setTutorialAberto(true)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <i className="fas fa-play-circle mr-1" /> Ver tutorial
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
          {primeiraLetra(nomeUsuario)}
        </div>
        <span className="text-sm font-medium text-gray-700">{nomeUsuario}</span>
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
          Dica: as integrações externas (MoneyPrinterTurbo, Short-Video-Maker, uploader) são configuráveis em Ferramentas.
        </p>
      </Modal>
    </header>
  );
}
