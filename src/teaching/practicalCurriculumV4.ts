import { auditedLesson, type Lesson } from './practicalLesson';

/** Per-decision authoring metadata; category labels never assign learning evidence. */
export const practicalSkillIds: Record<string,string[]> = {
 'cash-rfi':['preflop.rfi'],'cash-ep':['preflop.rfi'],'cash-3bet-value':['preflop.3bet'],'cash-3bet-defense':['preflop.3bet'],
 'cash-bb-defense':['preflop.bb-defense','math.pot-odds'],'cash-srp':['postflop.value','postflop.bet-sizing'],
 'cash-3bet-pot':['postflop.value','math.spr'],'cash-thin-value':['postflop.value'],'cash-catch':['postflop.bluff-catch'],
 'cash-short':['preflop.3bet'],'mtt-10':['tournament.push-fold'],'mtt-15':['tournament.push-fold','preflop.3bet'],
 'mtt-20':['preflop.bb-defense'],'mtt-30':['preflop.rfi'],'mtt-40':['preflop.3bet'],'mtt-srp':['postflop.value','math.spr'],
 'mtt-catch':['postflop.bluff-catch','range.blockers'],'mtt-bubble':['tournament.icm'],'mtt-satellite':['tournament.icm'],'mtt-pko':['tournament.push-fold'],
 'mtt-turn-barrel':['postflop.bluff','math.equity'],'mtt-turn-flush':['postflop.board-texture','postflop.value'],
 'mtt-turn-low-spr':['postflop.value','math.spr'],'mtt-turn-missed-draw':['math.pot-odds','math.equity'],
 'cash-9max-value':['preflop.3bet'],'cash-9max-multiway':['postflop.multiway','postflop.board-texture'],
 'cash-short-value':['postflop.value','math.spr'],'cash-short-draw':['math.pot-odds','math.equity'],
 'cash-deep-pot-control':['postflop.value','math.spr'],'cash-deep-nuts':['postflop.value','postflop.bet-sizing'],
};
const common = {topic:'相同牌面與有效深度',format:'cash' as const,table:'6max' as const,position:'BTN',cards:'AhAd',board:'Kh8c3d2s',street:'Turn' as const,
 skillIds:['postflop.value','postflop.bet-sizing','math.spr'],remember:'同一牌面仍須依剩餘深度與各尺寸支付反應重新選擇。',
 assumptions:['無 ante、忽略抽水。','可靠讀牌：BB 此時的過牌範圍只有 KQ/KJ/KT；兩對以上已在翻牌加注，不在此範圍。這些 Kx 會跟 10BB 及 21BB，面對超過 21BB 的下注全部棄牌。兩個深度採相同範圍與支付規則，不提供 solver EV。'],
 line:'BTN 開至 3BB，BB 跟，SB 棄；翻牌底池 6.5BB，BB 過牌、BTN 下注 6BB、BB 跟；轉牌 BB 過牌，底池 18.5BB。',
 actions:[{street:'Preflop' as const,seat:'BTN',action:'Raise',amountBB:3},{street:'Preflop' as const,seat:'BB',action:'Call',amountBB:2},{street:'Flop' as const,seat:'BB',action:'Check'},{street:'Flop' as const,seat:'BTN',action:'Bet',amountBB:6},{street:'Flop' as const,seat:'BB',action:'Call',amountBB:6},{street:'Turn' as const,seat:'BB',action:'Check'}]};
export const curriculumV4Additions: Lesson[] = [
 auditedLesson({...common,key:'cash-depth-pair-short',title:'同牌面深度對照：30BB 起始',prompt:'雙方起始 30BB、現在各剩 21BB；依明示支付規則，AA 怎麼取值？',best:'All-in',answers:{'All-in':[10,'21BB 仍被較差 Kx 支付，可取完整短碼價值。'],'Bet half pot':[8,'約 9–10BB 仍從較差 Kx 取值，但留下河牌決策。'],Check:[4,'明示較差牌會支付，過牌放棄此街價值。']}},{heroStart:30,villainStart:30,heroPaid:[3,6],villainPaid:[3,6],otherPaid:[0.5]}),
 auditedLesson({...common,key:'cash-depth-pair-deep',title:'同牌面深度對照：200BB 起始',prompt:'雙方起始 200BB、現在各剩 191BB；其他支付規則相同，AA 怎麼取值？',best:'Bet half pot',answers:{'Bet half pot':[10,'約 9–10BB 留住 Kx；剩餘深度大，不需一次投入所有籌碼。'],'All-in':[3,'191BB 推讓此時全部 Kx 棄牌，無法取得題述較差牌的支付；不表示推牌已被證明負 EV。'],Check:[6,'保留攤牌，但本題仍有明示小尺寸價值。']}},{heroStart:200,villainStart:200,heroPaid:[3,6],villainPaid:[3,6],otherPaid:[0.5]}),
];

export function connectPracticalLessons(lessons: Lesson[]): Lesson[] {
 const flush = lessons.find(lesson=>lesson.key==='mtt-turn-flush')!;
 const changedFlush: Lesson = {...flush,key:'mtt-turn-flush-paying',title:'MTT Turn：支付範圍改變的對照',
  skillIds:['postflop.value','decision.boundary'],
  prompt:'相同牌面與籌碼，唯一讀牌改為：BB 過牌範圍中的弱 Qx 很多，且會用 QJ/QT 跟 2BB，面對大注則只留同花。AQ 應如何選小尺寸？',
  assumptions:[...flush.assumptions.slice(0,1),'這是獨立對照情境，不是原題的延續：弱 Qx 很多且願意支付 2BB；面對加注需另評估。Hero 25.8BB、BB 24.8BB。'],
  best:'Bet small',answers:{'Bet small':[10,'在本題新增的支付讀牌下，2BB 可取得較差 Qx 的薄價值。'],Check:[8,'仍保留頂對攤牌價值，避免同花範圍的加注風險；不是必須下注。'],'Bet big':[3,'更大尺度使弱 Qx 棄掉，未由本題支付規則支持。']}};
 const multiway = lessons.find(lesson=>lesson.key==='cash-9max-multiway')!;
 const smallMultiway = auditedLesson({...multiway,key:'cash-9max-button-response',title:'Cash 9-max：後位小注的獨立情境',
  skillIds:['postflop.multiway','math.pot-odds'],
  line:'獨立練習情境：相同翻前 3BB 三人底池，Flop BB 與 UTG 過牌，BTN 下注 2BB，輪到 BB；UTG 仍未回應。',
  prompt:'BTN 會用大量 9x、8x 與聽牌下注 2BB，UTG 幾乎不過牌加注且多會棄牌。QJ 面對小注如何防守？本題只問現在的決定，不預設 UTG 已棄牌。',
  assumptions:['Hero 與 UTG 97BB，BTN 95BB；當前底池 11.5BB，跟注需 2BB；UTG 仍有行動權。','無 ante、忽略抽水；條件式跟注基準，不聲稱多方精確勝率；若 UTG 加注須重新評估。'],
  best:'Call',answers:{Call:[10,'較弱下注牌與小價格支持保留頂對防守；仍須觀察 UTG 後續動作。'],Fold:[5,'在明示寬下注與少過牌加注的讀牌下，立即放棄頂對偏緊。'],Raise:[4,'沒有較好牌棄牌或大量較差牌跟加注的條件。']},
  actions:[...(multiway.actions||[]),{street:'Flop',seat:'BB',action:'Check'},{street:'Flop',seat:'UTG',action:'Check'},{street:'Flop',seat:'BTN',action:'Bet',amountBB:2}],
 },{heroStart:100,villainStart:100,heroPaid:[3],villainPaid:[3,2],otherPaid:[3,0.5],callCost:2});
 return [...lessons,changedFlush,smallMultiway].map(lesson=>{
  if(lesson.key==='mtt-turn-low-spr') return {...lesson,followup:auditedLesson({
   ...lesson,key:'mtt-value-river',followup:undefined,skillIds:['postflop.value','math.spr'],board:'Qc7h2s3d6c',street:'River',
   line:'接續：你轉牌下注 5BB，BB 跟；河牌 6♣，BB 過牌。',prompt:'你選擇的 5BB 已被跟注；河牌空白，BB 的 QJ/QT 仍會跟最後 9.8BB，兩對以上先前通常加注。KQ 現在如何取值？',
   assumptions:['chip EV、無 ICM 或賞金。','只在本題明示 QJ/QT 願意支付時成立；chip EV，無 ICM 或賞金。Hero 10.8BB、BB 9.8BB，有效全下 9.8BB，超額 1BB 退回。'],best:'All-in',answers:{'All-in':[10,'有效投入 9.8BB，由較弱 Qx 支付。'],Check:[5,'有明示較差支付牌，過牌放棄最後一街價值。']},
   actions:[...(lesson.actions||[]),{street:'Turn',seat:'BTN',action:'Bet',amountBB:5},{street:'Turn',seat:'BB',action:'Call',amountBB:5},{street:'River',seat:'BB',action:'Check'}],
  },{heroStart:20,villainStart:20,heroPaid:[2.2,2,5],villainPaid:[2.2,1,2,5],otherPaid:[0.5]})};
  if(lesson.key==='mtt-turn-barrel') return {...lesson,followup:auditedLesson({
   ...lesson,key:'mtt-draw-river',followup:undefined,skillIds:['postflop.bluff','postflop.board-texture'],board:'Qh7c2h4s9c',street:'River',
   line:'接續：你轉牌下注 5BB，BB 跟；河牌 9♣，BB 過牌。',prompt:'紅心未中。轉牌跟注後的 BB 已收緊為 Qx 與更強成牌；可靠新資訊是這些牌不會棄給河牌下注，也不會用更差 A 高跟。AK 如何結束？',
   assumptions:['chip EV、無 ICM。','河牌沒有下一張牌可改善。Hero 20.8BB、BB 19.8BB，底池 19.9BB。這個不棄牌條件僅適用轉牌跟注後的範圍。'],best:'Check',answers:{Check:[10,'保留殘餘攤牌機會；對不棄的成牌範圍沒有支持第三槍的理由。'],'All-in':[2,'轉牌有棄牌率不表示收緊後的河牌範圍也會棄。']},
   actions:[...(lesson.actions||[]),{street:'Turn',seat:'BTN',action:'Bet',amountBB:5},{street:'Turn',seat:'BB',action:'Call',amountBB:5},{street:'River',seat:'BB',action:'Check'}],
  },{heroStart:30,villainStart:30,heroPaid:[2.2,2,5],villainPaid:[2.2,1,2,5],otherPaid:[0.5]})};
  if(lesson.key==='cash-9max-multiway') return {...lesson,followup:auditedLesson({
   ...lesson,key:'cash-multiway-response',followup:undefined,skillIds:['postflop.multiway','math.pot-odds'],
   line:'接續：BB（你）過牌，UTG 下注 7BB，BTN 跟 7BB，輪到 BB。',
   prompt:'UTG 大尺寸只用 AQ、KK+、暗三條，BTN 跟注只用兩對、暗三條或強同花／順子聽牌。QJ 無紅心，沒有足夠隱含賠率或加注棄牌率，如何回應？',
   assumptions:['三人仍在池中：Hero 97BB，UTG 90BB，BTN 90BB；底池 23.5BB，需跟 7BB。直接價格約 22.95%，不是保證足以跟注的實現勝率。','多人必須同時擊敗兩個範圍；這是條件式棄牌基準，未假造多方 equity。'],best:'Fold',answers:{Fold:[10,'下注者與第三位跟注者同時顯示強度；中等頂對缺少明示繼續理由。'],Call:[3,'不能忽略第三位玩家，套用單挑小注防守。'],Raise:[1,'題述沒有較好牌會棄的條件。']},
   actions:[...(lesson.actions||[]),{street:'Flop',seat:'BB',action:'Check'},{street:'Flop',seat:'UTG',action:'Bet',amountBB:7},{street:'Flop',seat:'BTN',action:'Call',amountBB:7}],
  },{heroStart:100,villainStart:100,heroPaid:[3],villainPaid:[3,7],otherPaid:[3,7,0.5],callCost:7})};
  return lesson;
 });
}
