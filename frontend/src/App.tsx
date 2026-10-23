import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AppConfig } from './lib/types';
import { api } from './lib/api';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Modal } from './components/Modal';
import { ToastProvider } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { CRM } from './pages/CRM';
import { Disparos } from './pages/Disparos';
import { Extratores } from './pages/Extratores';
import { Pipeline } from './pages/Pipeline';
import { Agentes } from './pages/Agentes';
import { Ferramentas } from './pages/Ferramentas';
import { Webhook } from './pages/Webhook';
import { Suporte } from './pages/Suporte';

const TITULOS: Record<string, string> = {
  '/': 'Painel',
  '/leads': 'Leads',
  '/agentes': 'Agentes',
  '/ferramentas': 'Ferramentas',
  '/extratores': 'Extratores de Leads',
  '/disparos': 'Disparos',
  '/crm': 'CRM — Kanban',
  '/pipeline': 'Pipeline de Vídeos Faceless',
  '/webhook': 'Webhook',
  '/suporte': 'Suporte',
};

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [confirmarSair, setConfirmarSair] = useState(false);
  const [encerrado, setEncerrado] = useState(false);

  const carregarConfig = useCallback(async () => {
    try {
      setConfig(await api.config.obter());
    } catch {
      /* backend ainda subindo — páginas mostram seus próprios erros */
    }
  }, []);

  useEffect(() => {
    carregarConfig();
  }, [carregarConfig]);

  if (encerrado) {
    return (
      <div className="min-h-screen bg-[#1e1b4b] text-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <i className="fas fa-power-off text-4xl text-indigo-300 mb-4 block" />
          <h1 className="text-xl font-bold">LeadMaster encerrado</h1>
          <p className="text-sm text-gray-300 mt-3">
            O servidor local foi desligado com sucesso. Seus dados estão salvos na pasta de dados.
          </p>
          <p className="text-xs text-gray-400 mt-6">
            Para voltar, execute: <code className="bg-white/10 px-2 py-1 rounded">npx --yes @danhachuel/leadmaster</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout
          nomeUsuario={config?.perfil.nome ?? '...'}
          onSair={() => setConfirmarSair(true)}
          onConfigSalva={(novo) => setConfig(novo)}
        />

        {/* Confirmação de saída */}
        <Modal aberto={confirmarSair} onFechar={() => setConfirmarSair(false)} titulo="Encerrar o LeadMaster" icone="fas fa-power-off">
          <p className="text-sm text-gray-600">
            Isso encerra o servidor local (os processos do terminal também fecham). Seus dados permanecem salvos
            nos arquivos JSON da pasta de dados. Deseja continuar?
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setConfirmarSair(false)}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                setConfirmarSair(false);
                try {
                  await api.shutdown();
                } catch {
                  /* servidor já pode ter desligado */
                }
                setTimeout(() => setEncerrado(true), 400);
              }}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
            >
              <i className="fas fa-power-off mr-2" /> Encerrar
            </button>
          </div>
        </Modal>
      </BrowserRouter>
    </ToastProvider>
  );
}

function Layout({
  nomeUsuario,
  onSair,
  onConfigSalva,
}: {
  nomeUsuario: string;
  onSair: () => void;
  onConfigSalva: (config: AppConfig) => void;
}) {
  const local = useLocation();
  const titulo = TITULOS[local.pathname] ?? 'LeadMaster';

  return (
    <div className="bg-gray-100 min-h-screen flex">
      <Sidebar onSair={onSair} />
      <main className="flex-1 flex flex-col min-w-0">
        <Header titulo={titulo} nomeUsuario={nomeUsuario} />
        <div className="p-8 space-y-6 overflow-y-auto flex-1">
          <Routes>
            <Route path="/" element={<Dashboard nomeUsuario={nomeUsuario} />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/disparos" element={<Disparos />} />
            <Route path="/extratores" element={<Extratores />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/agentes" element={<Agentes />} />
            <Route path="/ferramentas" element={<Ferramentas onConfigSalva={onConfigSalva} />} />
            <Route path="/webhook" element={<Webhook />} />
            <Route path="/suporte" element={<Suporte />} />
          </Routes>
          <footer className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-200">
            <span>© 2026 LeadMaster. Todos os direitos reservados.</span>
            <span>Dados 100% locais — sem nuvem</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
