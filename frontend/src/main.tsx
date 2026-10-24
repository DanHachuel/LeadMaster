import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css';
import App from './App';

// TanStack Query: gerencia ciclo de vida e cleanup do polling automaticamente
// (pausa quando a aba está oculta, dedupe, retry único, foco atualiza).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
