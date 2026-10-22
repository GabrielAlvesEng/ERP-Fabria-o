import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/app/App';
import { AuthProvider } from '@/shared/auth/AuthProvider';
import { registrarServiceWorker } from '@/modules/comunicacao/push';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/600.css';
import './index.css';

// iPhone ignora o "sem zoom" da meta viewport no gesto de pinça: bloqueia aqui para o ERP se comportar como aplicativo.
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Serviço que recebe os comunicados no celular com o ERP fechado (public/sw.js).
void registrarServiceWorker();

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
