import { StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './app/AppV2';
import { CalibrationDashboard } from './features/analysis/CalibrationDashboard';
import { SkillGraphDashboard } from './features/analysis/SkillGraphDashboard';
import { CompanionPanel } from './features/companion/CompanionPanel';
import { EquityWorkbench } from './features/learning/EquityWorkbench';
import { RangeReadingTrainer } from './features/range/RangeReadingTrainer';
import { ExploitWorkbench } from './features/strategy/ExploitWorkbench';
import { SolverSurfaceLab } from './features/strategy/SolverSurfaceLab';
import { BenchmarkTrainer } from './features/training/BenchmarkTrainer';
import { ContrastiveTrainer } from './features/training/ContrastiveTrainer';
import { CounterfactualTrainer } from './features/training/CounterfactualTrainer';
import { DecisionBoundaryMap } from './features/training/DecisionBoundaryMap';
import { PokerBenchTrainer } from './features/training/PokerBenchTrainer';
import { SizingTrainer } from './features/training/SizingTrainer';
import { VariantTrainer } from './features/training/VariantTrainer';
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
  if (route === '#companion') return <CompanionPanel onExit={exitLab} />;
  if (route === '#range-reading') return <RangeReadingTrainer onExit={exitLab} />;
  if (route === '#decision-boundary') return <CounterfactualTrainer onExit={exitLab} />;
  if (route === '#boundary-map') return <DecisionBoundaryMap onExit={exitLab} />;
  if (route === '#contrastive-trainer') return <ContrastiveTrainer onExit={exitLab} />;
  if (route === '#sizing-trainer') return <SizingTrainer onExit={exitLab} />;
  if (route === '#variant-trainer') return <VariantTrainer onExit={exitLab} />;
  if (route === '#solver-corpus') return <PokerBenchTrainer onExit={exitLab} />;
  if (route === '#solver-benchmark') return <PokerBenchTrainer onExit={exitLab} mode="benchmark" />;
  if (route === '#strategy-surface') return <SolverSurfaceLab onExit={exitLab} />;
  if (route === '#hidden-benchmark') return <BenchmarkTrainer onExit={exitLab} />;
  if (route === '#equity-workbench') return <EquityWorkbench onExit={exitLab} />;
  if (route === '#exploit-workbench') return <ExploitWorkbench onExit={exitLab} />;
  if (route === '#icm-workbench') return <IcmWorkbench onExit={exitLab} />;
  if (route === '#skill-graph') return <SkillGraphDashboard onExit={exitLab} />;
  if (route === '#calibration') return <CalibrationDashboard onExit={exitLab} />;
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
