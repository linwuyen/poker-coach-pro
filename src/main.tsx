import { ReactNode, StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './app/AppV2';
import { AnalysisContextBanner } from './features/analysis/AnalysisContextBanner';
import { analysisRouteFromHash, readAnalysisContextFromHash } from './features/analysis/analysisContext';
import './index.css';

const CalibrationDashboard = lazy(() => import('./features/analysis/CalibrationDashboard').then(module => ({ default: module.CalibrationDashboard })));
const CurrentHandAnalysis = lazy(() => import('./features/analysis/CurrentHandAnalysis').then(module => ({ default: module.CurrentHandAnalysis })));
const EffectivenessDashboard = lazy(() => import('./features/analysis/EffectivenessDashboard').then(module => ({ default: module.EffectivenessDashboard })));
const ExperimentDashboard = lazy(() => import('./features/analysis/ExperimentDashboard').then(module => ({ default: module.ExperimentDashboard })));
const MinimalFlipAnalysis = lazy(() => import('./features/analysis/MinimalFlipAnalysis').then(module => ({ default: module.MinimalFlipAnalysis })));
const PostflopTruthLab = lazy(() => import('./features/analysis/PostflopTruthLab').then(module => ({ default: module.PostflopTruthLab })));
const SkillGraphDashboard = lazy(() => import('./features/analysis/SkillGraphDashboard').then(module => ({ default: module.SkillGraphDashboard })));
const TruthOpsDashboard = lazy(() => import('./features/analysis/TruthOpsDashboard').then(module => ({ default: module.TruthOpsDashboard })));
const EquityWorkbench = lazy(() => import('./features/learning/EquityWorkbench').then(module => ({ default: module.EquityWorkbench })));
const RangeReadingTrainer = lazy(() => import('./features/range/RangeReadingTrainer').then(module => ({ default: module.RangeReadingTrainer })));
const SolverSurfaceLab = lazy(() => import('./features/strategy/SolverSurfaceLab').then(module => ({ default: module.SolverSurfaceLab })));
const ContrastiveTrainer = lazy(() => import('./features/training/ContrastiveTrainer').then(module => ({ default: module.ContrastiveTrainer })));
const CounterfactualTrainer = lazy(() => import('./features/training/CounterfactualTrainer').then(module => ({ default: module.CounterfactualTrainer })));
const DecisionBoundaryMap = lazy(() => import('./features/training/DecisionBoundaryMap').then(module => ({ default: module.DecisionBoundaryMap })));
const ExamMode = lazy(() => import('./features/training/ExamMode').then(module => ({ default: module.ExamMode })));
const PokerBenchTrainer = lazy(() => import('./features/training/PokerBenchTrainer').then(module => ({ default: module.PokerBenchTrainer })));
const SemanticCounterfactualTrainer = lazy(() => import('./features/training/SemanticCounterfactualTrainer').then(module => ({ default: module.SemanticCounterfactualTrainer })));
const SizingTrainer = lazy(() => import('./features/training/SizingTrainer').then(module => ({ default: module.SizingTrainer })));
const VariantTrainer = lazy(() => import('./features/training/VariantTrainer').then(module => ({ default: module.VariantTrainer })));
const FgsWorkbench = lazy(() => import('./features/tournament/FgsWorkbench').then(module => ({ default: module.FgsWorkbench })));
const IcmWorkbench = lazy(() => import('./features/tournament/IcmWorkbench').then(module => ({ default: module.IcmWorkbench })));

function ContextualRoute({ children }: { children: ReactNode }) {
  const context = readAnalysisContextFromHash();
  return <div className="bg-slate-950"><div className="mx-auto max-w-6xl px-4 pt-4 md:px-8"><AnalysisContextBanner context={context} compact /></div>{children}</div>;
}

function RootRouter() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => { const handleHashChange = () => setRoute(window.location.hash); window.addEventListener('hashchange', handleHashChange); return () => window.removeEventListener('hashchange', handleHashChange); }, []);
  const exitLab = () => { window.location.hash = ''; };
  const routeKey = analysisRouteFromHash(route);

  // Player flow is the infinite table. Context-aware training/analysis routes may carry ?ctx=... in the hash.
  if (routeKey === '#current-analysis') return <CurrentHandAnalysis onExit={exitLab} />;
  if (routeKey === '#minimal-flip') return <MinimalFlipAnalysis onExit={exitLab} />;
  if (routeKey === '#postflop-truth') return <PostflopTruthLab onExit={exitLab} />;
  if (routeKey === '#effectiveness') return <EffectivenessDashboard onExit={exitLab} />;
  if (routeKey === '#experiment') return <ExperimentDashboard onExit={exitLab} />;
  if (routeKey === '#truth-ops') return <TruthOpsDashboard onExit={exitLab} />;
  if (routeKey === '#range-reading') return <ContextualRoute><RangeReadingTrainer onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#decision-boundary') return <ContextualRoute><CounterfactualTrainer onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#boundary-map') return <DecisionBoundaryMap onExit={exitLab} />;
  if (routeKey === '#contrastive-trainer') return <ContextualRoute><ContrastiveTrainer onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#semantic-counterfactual') return <ContextualRoute><SemanticCounterfactualTrainer onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#sizing-trainer') return <ContextualRoute><SizingTrainer onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#variant-trainer') return <ContextualRoute><VariantTrainer onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#solver-corpus') return <ContextualRoute><PokerBenchTrainer onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#solver-benchmark' || routeKey === '#hidden-benchmark' || routeKey === '#exam-mode') return <ExamMode onExit={exitLab} />;
  if (routeKey === '#strategy-surface') return <SolverSurfaceLab onExit={exitLab} />;
  if (routeKey === '#equity-workbench') return <EquityWorkbench onExit={exitLab} />;
  if (routeKey === '#icm-workbench') return <ContextualRoute><IcmWorkbench onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#fgs-workbench') return <ContextualRoute><FgsWorkbench onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#skill-graph') return <ContextualRoute><SkillGraphDashboard onExit={exitLab} /></ContextualRoute>;
  if (routeKey === '#calibration') return <ContextualRoute><CalibrationDashboard onExit={exitLab} /></ContextualRoute>;
  return <AppV2 />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={<div data-testid="route-loading" className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">載入「想高龍了 德撲訓練機」…</div>}><RootRouter /></Suspense></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => registration.update()).catch(console.error); });
