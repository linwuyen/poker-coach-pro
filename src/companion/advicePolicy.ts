import { CompanionAdvicePolicy, CompanionHandState } from './types';

export function companionAdvicePolicy(state: CompanionHandState | null): CompanionAdvicePolicy {
  if (!state) {
    return {
      level: 'context-only',
      canShowStrategy: false,
      canOpenDecisionTools: false,
      canShowIntervention: false,
      reason: '尚未收到牌局狀態。',
    };
  }

  if (state.mode === 'live-real-money' && !state.handComplete) {
    return {
      level: 'context-only',
      canShowStrategy: false,
      canOpenDecisionTools: false,
      canShowIntervention: false,
      reason: '真金牌局進行中只同步情境，不顯示行動、頻率、EV 或決策工具；hand complete 後才解鎖分析。',
    };
  }

  if (state.decisionLocked && !state.handComplete) {
    return {
      level: 'context-only',
      canShowStrategy: false,
      canOpenDecisionTools: false,
      canShowIntervention: true,
      reason: '目前是未作答的訓練題。保留 retrieval，先顯示診斷方向，不提前揭露策略答案。',
    };
  }

  return {
    level: 'full',
    canShowStrategy: true,
    canOpenDecisionTools: true,
    canShowIntervention: true,
    reason: state.handComplete ? '牌局已完成，可顯示完整分析。' : '此模式允許即時學習輔助。',
  };
}
