import type { Card, Feedback, Scenario } from '../types';
import { PRACTICAL_ACTION_ORDER, type Lesson } from './practicalLesson';
import { curriculumV4Additions, connectPracticalLessons, practicalSkillIds } from './practicalCurriculumV4';
import { expandedPracticalLessons } from './expandedPracticalLessons';
const suits = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const;
function cards(text = ''): Card[] { return (text.match(/[2-9TJQKA][shdc]/g) || []).map(c => ({ rank: c[0] as Card['rank'], suit: suits[c[1] as keyof typeof suits] })); }

/** Original, conditional coaching examples. These are not copied solver ranges. */
const lessons: Lesson[] = [
  { key:'cash-rfi',title:'BTN 開池：位置與後方防守',topic:'翻前開池',format:'cash',depth:100,position:'BTN',cards:'AsJd',pot:1.5,
    line:'6-max，前面全部棄牌，SB 0.5BB、BB 1BB。',prompt:'兩個盲位偏被動，常用較弱 Ax、Jx 跟注。AJ 應如何開始？',assumptions:['100BB、無 ante；本題暫不計抽水。','盲位不頻繁 3-bet，較弱牌會跟 2.5BB 開池；不是任意對手的開池表。'],best:'Raise',answers:{Raise:[10,'以約 2.5BB 開池建立價值底池，利用位置處理後續防守。'],Call:[4,'Limp 放棄可取得的價值與棄牌率，也給 BB 免費看牌。'],Fold:[2,'在題述被動盲位下，AJ 有明確價值與位置優勢。']},remember:'開池前同時看位置、後方玩家、有效深度與抽水。' },
  { key:'cash-ep',title:'9-max 前位：避免被支配的入池',topic:'翻前開池',format:'cash',depth:100,table:'9max',position:'UTG',cards:'Kd8s',pot:1.5,
    line:'9-max UTG，還有八位玩家待行動。',prompt:'後位常用強 Broadway 跟注或加注，沒有特別過度棄牌的讀牌。K8o？',assumptions:['100BB、無 ante。','教學採緊實前位範圍，沒有偷盲或隔離弱手的額外理由。'],best:'Fold',answers:{Fold:[10,'弱不同花 K 容易被後方 KQ、KJ 等支配，位置也不利。'],Raise:[3,'不能把 BTN 的開池寬度直接搬到 UTG。'],Call:[2,'Limp 無法解決支配與位置問題。']},remember:'先問後面還有多少人，不要只看兩張牌的絕對大小。' },
  { key:'cash-3bet-value',title:'SB 價值 3-bet：對手會用什麼繼續',topic:'3-bet 與防守',format:'cash',depth:100,position:'SB',cards:'QsQd',pot:4,
    line:'BTN Open 2.5BB；SB 已投入 0.5BB，BB 1BB。',prompt:'BTN 開池寬，會用 JJ–88、AQ、部分 AJ 跟 3-bet，BB 未行動。QQ？',assumptions:['無 ante，本題不計抽水。','對手繼續範圍包含足夠較差牌；4-bet 後須重新評估，這題只問第一個決定。'],best:'3-bet',answers:{'3-bet':[10,'以約 11BB 價值再加注，取得價值並降低 BB 低價入池機會。'],Call:[7,'有特定誘導或 BB 很緊的理由可平跟，但須接受多人、無位置底池。'],Fold:[0,'QQ 對題述寬開池與繼續範圍遠非應棄的牌。']},remember:'價值加注要能說出較差的繼續牌；不要把每次被 4-bet 都當成必須打光。' },
  { key:'cash-3bet-defense',title:'面對緊 3-bet：不要被已投入籌碼綁住',topic:'3-bet 與防守',format:'cash',depth:100,position:'CO',cards:'AhJd',pot:15,
    line:'CO Open 2.5BB，BTN 3-bet 至 11BB，盲位棄牌；底池含盲注 1.5BB。',prompt:'可靠長期讀牌：BTN 此線只用 QQ+/AK，幾乎不詐唬。AJo？',assumptions:['只在此明示窄範圍讀牌可靠時成立。','跟注需 8.5BB，翻後無位置；沒有額外獎勵或特殊動態。'],best:'Fold',answers:{Fold:[10,'AJo 對 QQ+/AK 的支配問題嚴重，已開池不構成繼續理由。'],Call:[2,'漂亮起手牌不代表對窄範圍仍能實現足夠勝率。'],'4-bet (Raise)':[2,'對不肯放棄強範圍的對手，阻擋 A 並不足以支持自動 4-bet 詐唬。']},remember:'對手若加入大量詐唬，答案可以改變；讀牌不可靠時不可過度剝削。' },
  { key:'cash-bb-defense',title:'BB 防守：價格與可實現勝率',topic:'BB 防守',format:'cash',depth:100,position:'BB',cards:'JsTs',pot:4,
    line:'BTN Open 2.5BB，SB 棄牌；BB 已投入 1BB，再跟 1.5BB。',prompt:'BTN 寬開池且翻後不持續過度施壓。JTs 如何防守？',assumptions:['6-max、無 ante；本題忽略抽水。','JTs 有同花與連張可玩性；這是條件基準，不宣稱全部混合頻率。'],best:'Call',answers:{Call:[10,'用有可玩性的同花連張取得看翻牌機會；仍需按牌面與範圍決策。'],'3-bet':[7,'若對方過度棄給 3-bet，可轉為加注；須規劃被跟後的無位置底池。'],Fold:[3,'在題述價格與對手下防守過緊；高抽水或更窄開池會改變邊界。']},remember:'Pot odds 是起點，翻後實現率與抽水會改變防守邊界。' },
  { key:'cash-srp',title:'單加注底池：乾燥 A 高面的小注',topic:'單加注底池',format:'cash',depth:97.5,position:'BTN',cards:'AcQd',board:'Ah7c2s',street:'Flop',pot:5.5,
    line:'BTN Open 2.5BB，BB Call，SB 棄牌；BB 過牌。',prompt:'BB 會用較弱 Ax、7x 跟小注，大注則大幅收緊。AQ 如何取值？',assumptions:['雙方起始 100BB；目前有效剩餘 97.5BB。','沒有 solver 頻率；用題述跟注反應選教學基準。'],best:'Bet small',answers:{'Bet small':[10,'約 1.5BB 小注讓較差牌付費，保留對手較寬的繼續範圍。'],Check:[8,'部分過牌能保護過牌範圍，也可對抗積極對手；不代表錯誤。'],'Bet big':[4,'若大注趕走原本會付費的弱牌，額外價值有限。']},remember:'尺寸要對應較差牌願意支付的價格，而非單純看自己多強。' },
  { key:'cash-3bet-pot',title:'3-bet 底池：過對也要重新看範圍',topic:'3-bet 底池',format:'cash',depth:90,position:'SB',cards:'AsAd',board:'Kh8c3d',street:'Flop',pot:21,
    line:'BTN Open 2.5BB，SB 3-bet 至 10BB，BB 棄牌，BTN Call。',prompt:'你先行動；BTN 會用 KQ/KJ 及中口袋對跟小注，但不會用這些牌跟超大注。AA？',assumptions:['起始 100BB，目前有效 90BB；無抽水。','此題只比較下注尺度；後續被加注並不保證應打光。'],best:'Bet small',answers:{'Bet small':[10,'約 6BB 可向 Kx 與中口袋對取得第一街價值。'],Check:[8,'過牌可保留對手下注，但須有後續跟注與加注計畫。'],'All-in':[1,'90BB 打入 21BB 底池，在題述反應下會隔離出極強範圍。']},remember:'低於起始 100BB 不等於低 SPR；先算剩餘有效籌碼與底池比例。' },
  { key:'cash-thin-value',title:'河牌薄價值：列出會支付的較差牌',topic:'河牌價值',format:'cash',depth:80,position:'BTN',cards:'KsQd',board:'Kh8c3dJs2c',street:'River',pot:12,
    line:'單加注底池；Flop 小注被跟，Turn 雙方過牌，River BB 過牌。',prompt:'已觀察到 BB 常用 KT/K9/Jx 跟半池，強兩對以上通常先下注或加注。KQ？',assumptions:['80BB 為目前有效剩餘籌碼。','只在題述支付傾向下建議薄價值；面對加注另行評估。'],best:'Bet half pot',answers:{'Bet half pot':[10,'6BB 能從明示較差牌取得價值，並且可在被加注後重新判斷。'],Check:[7,'讀牌不可靠或對手過牌範圍強時，保留攤牌是合理替代。'],'All-in':[2,'80BB 超大注不會被題述較差牌支付。']},remember:'薄價值不是「我多半領先」，而是「被跟時仍有足夠較差牌」。' },
  { key:'cash-catch',title:'河牌抓詐唬：先列出價值與詐唬',topic:'抓詐唬 bluff-catching',format:'cash',depth:60,position:'BB',cards:'QsJd',board:'Qh8s4s2d2c',street:'River',pot:30,
    line:'River 原底池 20BB，BTN 下注 10BB；你需跟 10BB。',prompt:'可靠讀牌：這個尺寸幾乎只出現 QK+ 與更強牌；錯失聽牌通常過牌。QJ？',assumptions:['單挑、沒有後續下注；對手極少詐唬是本題必要前提。','不給假造的精確 range equity；若對手常詐唬應重新計算。'],best:'Fold',answers:{Fold:[10,'題述下注範圍缺乏足夠詐唬，不能只因自己有頂對就跟。'],Call:[3,'價格好也需要勝過足夠下注組合；錯失聽牌存在不代表它們會下注。'],Raise:[1,'較差牌會棄、較好牌會跟時，抓詐唬牌加注沒有得到支持。']},remember:'分開問「可能有什麼牌」與「那些牌會不會用這個尺寸下注」。' },
  { key:'cash-short',title:'20BB 短碼：價值全下與有效籌碼',topic:'短碼策略',format:'cash',depth:20,position:'BB',cards:'AhAd',pot:4,
    line:'BTN Open 2.5BB，SB 棄牌；你有 20BB 可用籌碼，BTN 覆蓋。',prompt:'BTN 會用 TT+/AQ+ 跟你的全下，且沒有特殊誘導理由。AA？',assumptions:['20BB 為本次決策前可投入的有效剩餘籌碼；BB 已投盲注不包含在內。','無 ante；這是強牌價值課，不提供完整短碼推跟表。'],best:'All-in',answers:{'All-in':[10,'題述對手會用大量較差牌跟全下，短碼可直接實現價值。'],'3-bet':[7,'小幅再加注誘導亦可，但需要清楚規劃剩餘籌碼。'],Fold:[0,'在題述條件下放棄 AA 沒有價值理由。']},remember:'有效籌碼由能互相贏走的較短籌碼決定，不由大籌碼玩家決定。' },
  { key:'mtt-10',title:'10BB：SB 開放底池的推牌計畫',topic:'10–20BB 翻前',format:'tournament',depth:10,table:'6max',position:'SB',cards:'AsKd',pot:2.5,
    line:'6-max，所有人棄到 SB；SB 0.5BB、BB 1BB、BB ante 1BB 已在底池。',prompt:'SB 尚有 10BB，BB 覆蓋且會用較差 Ax/Kx 和口袋對跟全下。AK？',assumptions:['目前有效剩餘 10BB；只考慮 chip EV，遠離獎金跳級。','完整推牌範圍取決於 BB 策略；本題只練強牌與死錢。'],best:'All-in',answers:{'All-in':[10,'死錢與較差跟注牌支持直接推入，確保實現全部勝率。'],Call:[7,'Limp/再加注可作另一策略，但需明確對手加注反應。'],Fold:[0,'對題述範圍棄 AK 過緊。']},remember:'先分清 chip EV 與 ICM，再看盲注、ante 和對手跟注反應。' },
  { key:'mtt-15',title:'15BB：對寬開池的價值再推',topic:'10–20BB 翻前',format:'tournament',depth:15,position:'BTN',cards:'QsQd',pot:4.7,
    line:'9-max，HJ Open 2.2BB；盲注合計 1.5BB、BB ante 1BB。',prompt:'HJ 開池寬，會用 99–JJ、AQ、AK 跟再推；你有 15BB，後方盲位未行動。QQ？',assumptions:['15BB 為目前有效籌碼；無顯著 ICM 壓力。','題述跟注範圍不是對所有 HJ 的推定。'],best:'All-in',answers:{'All-in':[10,'取得死錢並能被較差牌支付；短碼下不必設計難以棄牌的小 3-bet。'],Call:[7,'針對特定後方玩家可誘導，但要接受多人與低 SPR。'],Fold:[0,'對明示寬開池與繼續範圍棄 QQ 過緊。']},remember:'再推要評估開池範圍、跟推範圍和仍未行動的玩家。' },
  { key:'mtt-20',title:'20BB：BB 面對小開池',topic:'10–20BB 翻前',format:'tournament',depth:20,position:'BB',cards:'KsJs',pot:4.7,
    line:'BTN Open 2.2BB，SB 棄牌；底池含 1BB BB ante，BB 需再跟 1.2BB。',prompt:'BTN 開池寬，翻後偏直接，KJs 應如何處理？',assumptions:['20BB 為目前有效剩餘；忽略 ICM，只作 chip-EV 條件教學。','未給完整範圍，所以不宣稱跟注/再推的精確頻率。'],best:'Call',answers:{Call:[10,'好價格和同花可玩性支持防守；低 SPR 要預先規劃頂對與聽牌。'],'All-in':[7,'對較寬開池且會棄掉足夠牌的對手，可考慮再推；不是無條件。'],Fold:[3,'對此價格與寬開池直接棄掉 KJs 通常過緊。']},remember:'BB 有已投入盲注與 ante 帶來的價格，不可套用冷跟者的門檻。' },
  { key:'mtt-30',title:'30BB：開池不等於推或棄',topic:'30–40BB 翻前',format:'tournament',depth:30,table:'6max',position:'CO',cards:'AhQh',pot:2.5,
    line:'6-max，前面棄到 CO；盲注 1.5BB、BB ante 1BB。',prompt:'後方常規玩家會用弱 Ax/Broadway 防守小開池，只用強範圍跟 30BB 全下。AQs？',assumptions:['30BB 為有效可投入深度；無顯著 ICM 壓力。','題目比較初始尺度，不指定完整開池表。'],best:'Raise',answers:{Raise:[10,'約 2.2BB 開池可被較差牌繼續，並保留對再加注的決策空間。'],'All-in':[4,'30BB 並非自動推棄區；全下會趕走許多可取得價值的弱牌。'],Fold:[0,'在題述普通後方範圍下棄 AQs 過緊。']},remember:'中短碼仍有小開池、跟注與非全下再加注的策略空間。' },
  { key:'mtt-40',title:'40BB：3-bet 尺度與後續計畫',topic:'30–40BB 翻前',format:'tournament',depth:40,position:'BTN',cards:'KsKd',pot:4.7,
    line:'HJ Open 2.2BB，盲注與 BB ante 合計 2.5BB。',prompt:'HJ 會跟小 3-bet 的範圍包含 TT/JJ/AQ，盲位尚未行動。KK？',assumptions:['目前有效 40BB，遠離 ICM 壓力。','偏好約 6–7BB 的非全下價值再加注；不是 solver 唯一尺寸。'],best:'3-bet',answers:{'3-bet':[10,'保留較差牌的跟注，同時建立能在有利牌面取得後續價值的底池。'],Call:[7,'有後方擠壓或誘導讀牌時可保留平跟；須接受多人風險。'],'All-in':[6,'能立即取池，但若只有強範圍跟注，可能失去較差牌支付。']},remember:'40BB 的強牌不必自動推；先想被跟後 SPR 與哪些翻牌要減速。' },
  { key:'mtt-srp',title:'MTT 翻後：頂對與低 SPR',topic:'MTT 翻後',format:'tournament',depth:16.8,heroStack:17.8,villainStack:16.8,position:'BTN',cards:'AsQd',board:'Qh7c2s',street:'Flop',pot:5.9,
    potAccounting:{contributionsBB:[2.2,2.2,0.5,1],callCostBB:0},actions:[{street:'Preflop',seat:'BTN',action:'Raise',amountBB:2.2},{street:'Preflop',seat:'BB',action:'Call',amountBB:1.2,label:'BB 補 1.2BB；另已支付 1BB ante'},{street:'Flop',seat:'BB',action:'Check'}],
    line:'雙方 20BB 起始（含將支付的盲注與 ante），BTN Open 2.2BB，BB Call；SB 0.5BB、BB ante 1BB；BB 過牌。',prompt:'BB 會用 QJ/QT/7x 跟小注；面對大注較緊。AQ 第一街？',assumptions:['Hero 剩餘 17.8BB，BB 付過 ante 後剩餘 16.8BB；目前有效 16.8BB；chip EV，沒有顯著 ICM 壓力。','SPR 約 2.85 仍需看對手範圍，並非頂對自動全下。'],best:'Bet small',answers:{'Bet small':[10,'約 2BB 向較弱牌取值並保留後街價值空間。'],Check:[7,'針對會亂下注的對手可過牌誘導；後續不能機械式棄牌。'],'All-in':[4,'直接超池推可能只留下強牌，題述反應不足以支持最大尺寸。']},remember:'SPR 幫助規劃投入，不替代範圍與牌面判斷。' },
  { key:'mtt-catch',title:'MTT 河牌：保留攤牌與抓詐唬',topic:'抓詐唬 bluff-catching',format:'tournament',depth:25,position:'BB',cards:'KhJd',board:'Ks8s4d2c2h',street:'River',pot:18,
    line:'River 原底池 12BB，BTN 下注 6BB。你有 25BB 有效剩餘，跟注需 6BB。',prompt:'可靠讀牌：BTN 常把所有錯失黑桃聽牌下注，價值則主要 KQ/AK；你沒有黑桃。KJ？',assumptions:['只考慮 chip EV，無顯著 ICM 壓力。','「常把所有錯失聽牌下注」是條件，不從牌面自動推定詐唬頻率。'],best:'Call',answers:{Call:[10,'題述對手保留大量錯失聽牌詐唬；沒有黑桃較少阻擋這些組合，跟注是教學基準。'],Fold:[7,'若實際下注組合不足或 ICM 風險高，棄牌可合理；要先驗證讀牌。'],Raise:[3,'抓詐唬牌通常不需要把詐唬趕走、讓較強牌繼續。']},remember:'先列組合與下注頻率，再看 blocker；ICM 場景另算效用。' },
  { key:'mtt-bubble',title:'泡沫中籌碼：不要照搬 chip-EV 直覺',topic:'ICM 決策準備',format:'tournament',depth:18,position:'BTN',cards:'AdJs',pot:26.5,
    line:'四人泡沫，前三名同額獎金；你 20BB，SB 40BB，BB 3BB，CO 12BB。CO 棄，BTN Open 2BB，SB 3-bet 至 23BB，BB 棄；底池含 BB 1BB 與 ante 0.5BB。',prompt:'SB 此次再加注的可靠讀牌是 TT+/AQ+，你尚有 18BB；這次無賞金。AJo？',assumptions:['完整原始籌碼與等額獎金已明示，但這是條件教材，未計出本手牌的精確 equity。','大籌碼窄再加注且另一玩家極短，風險溢價和支配問題同時存在。'],best:'Fold',answers:{Fold:[10,'AJo 對窄再加注範圍被支配，且出局會放棄短碼先淘汰的席位價值。'],Call:[2,'不能只因自己已開池、底池有死錢就忽略泡沫風險。']},remember:'要量化邊界，必須提供完整 payouts/stacks 與對範圍 equity；接著做 ICM 數學課。' },
  { key:'mtt-satellite',title:'衛星賽：有保證席位時的零風險選擇',topic:'衛星賽',format:'tournament',depth:40,position:'BB',cards:'AsAd',pot:42.5,
    line:'衛星賽尚有三人爭兩張等值票；賽事規則已確認，只要本手棄牌便鎖定席位。SB 向你全下。',prompt:'沒有額外籌碼獎金或賞金，取得門票是唯一目標。即使 AA，該如何選？',assumptions:['「棄牌已保證席位」是此題特別給定的賽事狀態，不能從籌碼大就自行推定。','任何跟注都存在失去席位的正機率，贏得更多籌碼不增加獎勵。'],best:'Fold',answers:{Fold:[10,'門票效用已確定為一，增加籌碼沒有額外效用。'],Call:[0,'AA 的 chip EV 很高，但此條件下冒風險不能改善已保證的獎勵。']},remember:'一般衛星泡沫不代表可以棄所有牌；先確認是否真的保證席位。' },
  { key:'mtt-pko',title:'PKO：賞金再大也先確認能否淘汰',topic:'PKO 賞金',format:'tournament',depth:15,position:'BB',cards:'7h2d',pot:32.5,
    line:'SB 覆蓋你並全下，BB 尚有 15BB；SB 賞金很大，但你贏了也無法讓他出局。',prompt:'SB 全下範圍偏強，沒有其他足以支持 72o 的價格或讀牌理由。你能為了賞金跟嗎？',assumptions:['此決策只談本次立即可領賞金；不假造未來賞金模型。','Hero 未覆蓋 SB，因此本次擊敗對手無法立即領其賞金。'],best:'Fold',answers:{Fold:[10,'這次即時賞金為零，不能用對手頭上的高額賞金補貼弱牌跟注。'],Call:[1,'先確認能否淘汰，再把可立即領取部分加入 EV；賞金面額不是自動可得。']},remember:'分開主獎金 EV、立即賞金與未來賞金；覆蓋關係先於賞金金額。' },
];

function toScenario(lesson: Lesson): Scenario {
  const feedbacks = Object.fromEntries(Object.entries(lesson.answers).map(([action, [score, why]]) => [action, {
    score, judgment: score >= 10 ? '正確' : score >= 8 ? '可接受' : '錯誤', bestAction: lesson.best,
    why, conceptualError: score >= 8 ? '無' : '忽略本題對手反應、位置、有效深度或效用前提。',
    remember: lesson.remember, nextStepId: lesson.followup && action === lesson.best ? 'followup' : 'next_hand',
    evidence: { sourceConfidence: 'expert-baseline', objective: '條件式教學基準，沒有 solver 動作 EV 或頻率。' },
  } satisfies Feedback]));
  return {
    id:`course-${lesson.key}`, decisionFamilyId:`course-${lesson.key}`, title:lesson.title,
    category:['實戰課程', lesson.topic], type:lesson.format === 'cash' ? 'Cash Game' : 'Tournament', difficulty:'中階',
    blinds:'BB 單位，已投入金額見題目', ante:lesson.format === 'tournament',
    userStack:`${lesson.heroStack ?? lesson.depth}BB`, userBB:lesson.heroStack ?? lesson.depth, effectiveStack:`${lesson.depth}BB`, tableSize:lesson.table || (lesson.format === 'cash' ? '6max' : '9max'),
    position:lesson.position, holeCards:cards(lesson.cards), preAction:lesson.line, benchmarkRole:'training',
    situationIds:[`format.${lesson.format === 'cash' ? 'cash' : 'mtt'}`],
    steps:[{ id:'decision', preAction:lesson.line, street:lesson.street || 'Preflop', communityCards:cards(lesson.board), potSize:lesson.pot,
      description:lesson.prompt, options:PRACTICAL_ACTION_ORDER.filter(action => lesson.answers[action] !== undefined), feedbacks,
      potAccounting:lesson.potAccounting,
      skillIds:lesson.skillIds || practicalSkillIds[lesson.key],
      ...(lesson.potAccounting?.callCostBB && lesson.potAccounting.callCostBB > 0 ? {potOdds:`${Number((100 * lesson.potAccounting.callCostBB / (lesson.pot + lesson.potAccounting.callCostBB)).toFixed(4))}%（直接價格；不含未來投入與實現率）`} : {}),
      ...(lesson.heroStack !== undefined && lesson.villainStack !== undefined ? {
        handState:{tableSize:lesson.table || (lesson.format === 'cash' ? '6max' as const : '9max' as const),potSizeBB:lesson.pot,heroStackBB:lesson.heroStack,villainStackBB:lesson.villainStack,actions:lesson.actions || []},
        ...(lesson.street ? {spr:Math.round(lesson.depth / lesson.pot * 100) / 100} : {}),
      } : {}),
      assumptions:lesson.assumptions,
      strategySource:'Original conditional coaching; not a solver range. Concepts: effective depth, range response, blockers and tournament utility.',
      conceptIds:[lesson.street ? 'postflop.range-response' : 'preflop.range-response', ...(lesson.topic.includes('bluff-catching') ? ['postflop.bluff-catching'] : [])],
    }, ...(lesson.followup ? toScenario(lesson.followup).steps.map(step => ({...step,id:'followup'})) : [])],
  };
}

export const practicalCurriculum: Scenario[] = connectPracticalLessons([...lessons, ...expandedPracticalLessons, ...curriculumV4Additions]).map(toScenario);
