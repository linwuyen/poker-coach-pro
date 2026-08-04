import { StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Brain } from 'lucide-react';
import AppV2 from './app/AppV2';
import { RangeReadingTrainer } from './features/range/RangeReadingTrainer';
import './index.css';

function RootRouter() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === '#range-reading') {
    return <RangeReadingTrainer onExit={() => { window.location.hash = ''; }} />;
  }

  return <>
    <AppV2 />
    <button
      type="button"
      onClick={() => { window.location.hash = 'range-reading'; }}
      className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 shadow-2xl shadow-emerald-950/40 transition hover:-translate-y-0.5 lg:bottom-6 lg:right-6"
      aria-label="開啟對抗範圍訓練"
    >
      <Brain className="h-5 w-5" />
      <span>對抗範圍訓練</span>
    </button>
  </>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">載入「想高龍了 德撲訓練機」…</div>}>
      <RootRouter />
    </Suspense>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then(registration => registration.update())
      .catch(console.error);
  });
}
