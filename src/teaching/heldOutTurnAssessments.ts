import { calculateEquity, parseCardsText } from '../poker/equityEngine';
import type { ActionType, Feedback, Scenario } from '../types';

/** Held out as whole semantic families; never copied into the teaching bank.
 * These are terminal Turn calls, not a solver policy for a live river game.
 * Every opponent combo and every legal river is enumerated (ties split).
 */
export const TURN_ASSESSMENT_CONTEXTS = [
  { key:'hearts', hero:'7h 6h', board:'Qh Jh 2c 3d', range:['AsAd', 'AcAd'] },
  { key:'spades', hero:'Ts 9s', board:'As Ks 4h 5d', range:['AhAc', 'AdAc'] },
  { key:'diamonds', hero:'Ad 8d', board:'Kd Qd 3c 2s', range:['KhKc', 'KsKc'] },
  { key:'clubs', hero:'Jc Tc', board:'Ac 8c 4d 2h', range:['AsAh', 'AdAh'] },
] as const;

export function buildHeldOutTurnAssessments(): Scenario[] {
  return (['cash','tournament'] as const).flatMap(format => (['6max','9max'] as const).flatMap(tableSize =>
    [18,30,70,120].flatMap((stack, depth) => [false,true].map(goodPrice => {
      const context = TURN_ASSESSMENT_CONTEXTS[depth];
      const holeCards = parseCardsText(context.hero);
      const communityCards = parseCardsText(context.board);
      const result = calculateEquity({hero:holeCards, board:communityCards, villainRange:context.range.map(hand => ({hand})), exactStateLimit:10000});
      if (result.method !== 'exact') throw new Error('Held-out Turn assessment requires exhaustive equity.');
      // Existing pot + villain's all-in; Hero has exactly C left. No later action.
      const existingPot = stack * (goodPrice ? 6 : .5);
      const pot = existingPot + stack;
      const callEv = result.equity / 100 * (pot + stack) - stack;
      const best: ActionType = callEv > 0 ? 'Call' : 'Fold';
      const bestEv = Math.max(0,callEv);
      const id = `heldout-turn-${format}-${tableSize}-${stack}-${goodPrice?'a':'b'}`;
      const assumption = '對手列出的每個精確組合等權；已知牌排除後，每張合法 River 等機率。對手已全下，Hero 跟注也全下，沒有後續下注、抽水、其他活躍玩家或邊池；平手各分一半。';
      const utility = format === 'cash' ? '最大化本題籌碼 BB EV。' : '只比較 Chip-EV；不建模 ICM、賞金或晉級席位，不能推論賽事 $EV。';
      function feedback(action: 'Call'|'Fold'): Feedback {
        const value = action === 'Call' ? callEv : 0;
        return {judgment:action === best?'正確':'錯誤',score:action === best?10:2,bestAction:best,
          why:`完整列舉 ${result.samples} 個組合／River 狀態（含平手均分），equity=${result.equity.toFixed(4)}%。Call EV=equity×(${pot}+${stack})−${stack}=${callEv.toFixed(4)}BB；Fold=0BB。${utility}`,
          conceptualError:action === best?'無':'沒有同時比較阻擋牌、全部合法 River 與跟注價格。',
          remember:'範圍、死牌與底池價格共同決定這個終局跟注；改變條件必須重算。',nextStepId:'next_hand',
          evidence:{sourceConfidence:'exact-math',objective:`Exhaustive Turn range equity and terminal all-in call arithmetic. ${assumption} ${utility}`,
            villainRange:context.range.join(', '),actionUtility:value,bestUtility:bestEv,utilityLoss:bestEv-value,utilityUnit:'bb',
            utilityModel:format === 'cash'?'cash-chip-ev':'tournament-chip-ev',
            ...(format === 'cash'?{actionEvBB:value,bestEvBB:bestEv,evLossBB:bestEv-value}:{}),
            reversals:['保持牌與範圍不變，既有底池或跟注價格改變可使偏好反轉；這不是完整範圍的 solver 策略。']}};
      }
      // Cash/MTT chip utility and table aliases do not change the terminal math.
      // Share exposure identity so a format switch cannot manufacture unseen evidence.
      return {id,decisionFamilyId:`heldout-turn-${context.key}-${goodPrice?'wide-pot':'narrow-pot'}`,title:`Turn · ${tableSize} 牌局 ${depth+1}`,
        type:format === 'cash'?'Cash Game':'Tournament',difficulty:'進階',category:['Turn range equity','terminal all-in','math.equity'],
        blinds:'0.5/1 BB',ante:false,userStack:`${stack}BB`,userBB:stack,effectiveStack:`${stack}BB`,position:'BB',tableSize,
        benchmarkRole:'holdout',holeCards,preAction:'其他玩家均已棄牌。面對最後一位對手的 Turn 全下，剩餘有效籌碼與跟注額相等。',
        ...(format === 'tournament'?{tourneyInfo:'Chip-EV 模型；不使用獎金或 ICM。'}:{}),
        steps:[{id:'turn-terminal',street:'Turn',communityCards,potSize:pot,
          potAccounting:{contributionsBB:[existingPot/2,existingPot/2,stack],callCostBB:stack},
          description:`下注前底池 ${existingPot}BB；對手全下 ${stack}BB，目前底池 ${pot}BB。Hero 尚餘 ${stack}BB，跟注需 ${stack}BB。對手精確範圍：${context.range.join('、')}（各等權）。${assumption} ${utility} 請選擇。`,
          options:['Fold','Call'],assumptions:[assumption,utility],strategySource:'Exact exhaustive one-card range equity, terminal all-in utility; not solver strategy.',
          skillIds:['math.equity','math.pot-odds'],conceptIds:['math.equity','math.pot-odds','turn.all-in'],feedbacks:{Fold:feedback('Fold'),Call:feedback('Call')}}]};
    }))));
}

export const heldOutTurnAssessments = buildHeldOutTurnAssessments();
