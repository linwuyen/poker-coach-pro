import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './app/AppV2';
import './index.css';

const CalibrationDashboard = lazy(() => import('./features/analysis/CalibrationDashboard').then(module => ({ default: module.CalibrationDashboard })));
const EffectivenessDashboard = lazy(() => import('./features/analysis/EffectivenessDashboard').then(module => ({ default: module.EffectivenessDashboard })));
const ExperimentDashboard = lazy(() => import('./features/analysis/ExperimentDashboard').then(module => ({ default: module.ExperimentDashboard })));
const HandHistoryImporter = lazy(() => import('./features/analysis/HandHistoryImporter').then(module => ({ default: module.HandHistoryImporter })));
const PostflopTruthLab = lazy(() => import('./features/analysis/PostflopTruthLab').then(module => ({ default: module.PostflopTruthLab })));
const SkillGraphDashboard = lazy(() => import('./features/analysis/SkillGraphDashboard').then(module => ({ default: module.SkillGraphDashboard })));
const TruthOpsDashboard = lazy(() => import('./features/analysis/TruthOpsDashboard').then(module => ({ default: module.TruthOpsDashboard })));
const CompanionPanel = lazy(() => import('./features/companion/CompanionPanel').then(module => ({ default: module.CompanionPanel })));
const EquityWorkbench = lazy(() => import('./features/learning/EquityWorkbench').then(module => ({ default: module.EquityWorkbench })));
const RangeReadingTrainer = lazy(() => import('./features/range/RangeReadingTrainer').then(module => ({ default: module.RangeReadingTrainer })));
const ExploitWorkbench = lazy(() => import('./features/strategy/ExploitWorkbench').then(module => ({ default: module.ExploitWorkbench })));
const SolverSurfaceLab = lazy(() => import('./features/strategy/SolverSurfaceLab').then(module => ({ default: module.SolverSurfaceLab })));
const BenchmarkTrainer = lazy(() => import('./features/training/BenchmarkTrainer').then(module => ({ default: module.BenchmarkTrainer })));
const ContrastiveTrainer = lazy(() => import('./features/training/ContrastiveTrainer').then(module => ({ default: module.ContrastiveTrainer })));
const CounterfactualTrainer = lazy(() => import('./features/training/CounterfactualTrainer').then(module => ({ default: module.CounterfactualTrainer })));
const DecisionBoundaryMap = lazy(() => import('./features/training/DecisionBoundaryMap').then(module => ({ default: module.DecisionBoundaryMap })));
const PokerBenchTrainer = lazy(() => import('./features/training/PokerBenchTrainer').then(module => ({ default: module.PokerBenchTrainer })));
const SemanticCounterfactualTrainer = lazy(() => import('./features/training/SemanticCounterfactualTrainer').then(module => ({ default: module.SemanticCounterfactualTrainer })));
const SizingTrainer = lazy(() => import('./features/training/SizingTrainer').then(module => ({ default: module.SizingTrainer })));
const VariantTrainer = lazy(() => import('./features/training/VariantTrainer').then(module => ({ default: module.VariantTrainer })));
const FgsWorkbench = lazy(() => import('./features/tournament/FgsWorkbench').then(module => ({ default: module.FgsWorkbench })));
const IcmWorkbench = lazy(() => import('./features/tournament/IcmWorkbench').then(module => ({ default: module.IcmWorkbench })));
const TournamentContextLab = lazy(() => import('./features/tournament/TournamentContextLab').then(module => ({ default: module.TournamentContextLab })));

function RootRouter() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const exitLab = () => { window.location.hash = ''; };
  if (route === '#hand-history') return <HandHistoryImporter onExit={exitLab} />;
  if (route === '#postflop-truth') return <PostflopTruthLab onExit={exitLab} />;
  if (route === '#effectiveness') return <EffectivenessDashboard onExit={exitLab} />;
  if (route === '#experiment') return <ExperimentDashboard onExit={exitLab} />;
  if (route === '#truth-ops') return <TruthOpsDashboard onExit={exitLab} />;
  if (route === '#tournament-context') return <TournamentContextLab onExit={exitLab} />;
  if (route === '#companion') return <CompanionPanel onExit={exitLab} />;
  if (route === '#range-reading') return <RangeReadingTrainer onExit={exitLab} />;
  if (route === '#decision-boundary') return <CounterfactualTrainer onExit={exitLab} />;
  if (route === '#boundary-map') return <DecisionBoundaryMap onExit={exitLab} />;
  if (route === '#contrastive-trainer') return <ContrastiveTrainer onExit={exitLab} />;
  if (route === '#semantic-counterfactual') return <SemanticCounterfactualTrainer onExit={exitLab} />;
  if (route === '#sizing-trainer') return <SizingTrainer onExit={exitLab} />;
  if (route === '#variant-trainer') return <VariantTrainer onExit={exitLab} />;
  if (route === '#solver-corpus') return <PokerBenchTrainer onExit={exitLab} />;
  if (route === '#solver-benchmark') return <PokerBenchTrainer onExit={exitLab} mode="benchmark" />;
  if (route === '#strategy-surface') return <SolverSurfaceLab onExit={exitLab} />;
  if (route === '#hidden-benchmark') return <BenchmarkTrainer onExit={exitLab} />;
  if (route === '#equity-workbench') return <EquityWorkbench onExit={exitLab} />;
  if (route === '#exploit-workbench') return <ExploitWorkbench onExit={exitLab} />;
  if (route === '#icm-workbench') return <IcmWorkbench onExit={exitLab} />;
  if (route === '#fgs-workbench') return <FgsWorkbench onExit={exitLab} />;
  if (route === '#skill-graph') return <SkillGraphDashboard onExit={exitLab} />;
  if (route === '#calibration') return <CalibrationDashboard onExit={exitLab} />;
  return <AppV2 />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div data-testid="route-loading" className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">載入「想高龍了 德撲訓練機」…</div>}>
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
