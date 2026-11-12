import { useMemo } from 'react';
import { buildSituationCoverage } from '../../learning-engine/coverageMatrix';
import type { HistoryItem, Scenario } from '../../types';

export function SituationCoverageMatrix({ history, scenarioBank }: { history: HistoryItem[]; scenarioBank: Scenario[] }) {
  const coverage = useMemo(() => buildSituationCoverage(scenarioBank, history), [scenarioBank, history]);
  const visible = coverage.slice(0, 14);
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5" data-testid="situation-coverage-matrix">
    <div className="mb-4">
      <h3 className="font-semibold text-slate-100">Poker State-Space Coverage</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">供給只計目前賽制、桌型、有效籌碼與學習重點下可用的教材和測驗；對照你的本賽制歷史證據。0 evidence 不會被隱藏。現金桌算術測驗以代表題組顯示；可再產生未見變式。</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-xs">
        <thead className="text-slate-500"><tr><th className="pb-3">Context</th><th>Training bank</th><th>Holdout</th><th>Attempts</th><th>Accuracy</th><th>Transfer</th><th>Verified EV</th><th>Priority</th></tr></thead>
        <tbody className="divide-y divide-slate-800">
          {visible.map(row => <tr key={row.situationId}>
            <td className="py-3 pr-4"><div className="font-medium text-slate-200">{row.label}</div><div className="mt-1 font-mono text-[10px] text-slate-600">{row.situationId}</div>{row.dataGap && <span className="mt-1 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">DATA GAP</span>}</td>
            <td>{row.trainingScenarios}</td>
            <td>{row.holdoutScenarios}</td>
            <td>{row.attempts}</td>
            <td>{row.accuracy === undefined ? '—' : `${row.accuracy}%`}</td>
            <td>{row.transferAccuracy === undefined ? `— (n=${row.transferAttempts})` : `${row.transferAccuracy}% (n=${row.transferAttempts})`}</td>
            <td>{row.averageVerifiedEvLossBB === undefined ? '—' : `${row.averageVerifiedEvLossBB.toFixed(2)} BB`}</td>
            <td className="font-mono text-cyan-300">{row.priority}%</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
