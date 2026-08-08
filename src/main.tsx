import { StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
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

  return <AppV2 />;
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
