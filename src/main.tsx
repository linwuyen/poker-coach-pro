import { StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './app/AppV2';
import { SkillGraphDashboard } from './features/analysis/SkillGraphDashboard';
import { EquityWorkbench } from './features/learning/EquityWorkbench';
import { RangeReadingTrainer } from './features/range/RangeReadingTrainer';
import { ExploitWorkbench } from './features/strategy/ExploitWorkbench';
import { BenchmarkTrainer } from './features/training/BenchmarkTrainer';
import { CounterfactualTrainer } from './features/training/CounterfactualTrainer';
import { PokerBenchTrainer } from './features/training/PokerBenchTrainer';
import { SizingTrainer } from './features/training/SizingTrainer';
import { IcmWorkbench } from './features/tournament/IcmWorkbench';
import './index.css';

function RootRouter() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const exitLab = () => { window.location.hash = ''; };
  if (route === '#range-reading') return <RangeReadingTrainer onExit={exitLab} />;
  if (route === '#decision-boundary') return <CounterfactualTrainer onExit={exitLab} />;
  if (route === '#sizing-trainer') return <SizingTrainer onExit={exitLab} />;
  if (route === '#solver-corpus') return <PokerBenchTrainer onExit={exitLab} />;
  if (route === '#hidden-benchmark') return <BenchmarkTrainer onExit={exitLab} />;
  if (route === '#equity-workbench') return <EquityWorkbench onExit={exitLab} />;
  if (route === '#exploit-workbench') return <ExploitWorkbench onExit={exitLab} />;
  if (route === '#icm-workbench') return <IcmWorkbench onExit={exitLab} />;
  if (route === '#skill-graph') return <SkillGraphDashboard onExit={exitLab} />;
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