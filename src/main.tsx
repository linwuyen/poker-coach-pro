import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './app/AppV2';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">載入 Poker Coach Pro…</div>}>
      <AppV2 />
    </Suspense>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error));
}
