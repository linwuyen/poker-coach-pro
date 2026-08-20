import { Scenario, Card, Rank, Suit } from './types';

const C = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const S = (r: Rank) => C(r, 'spades');
const H = (r: Rank) => C(r, 'hearts');
const D = (r: Rank) => C(r, 'diamonds');
const C_ = (r: Rank) => C(r, 'clubs');

export const scenarios: Scenario[] = [
  {
    id: '1', title: 'AJo HJ 中頂對', category: ['Value Bet', '控池', 'SPR'], villainProfile: 'Loose Aggressive (LAG)', heroImage: 'Tight Aggressive (TAG)', difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'HJ', holeCards: [S('A'), D('J')], preAction: '前位棄牌', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [H('J'), C_('8'), D('5'), S('9')], spr: 4.5, potOdds: '33%', description: '你在 HJ Open 3BB，BTN Call。Flop 你 C-bet 半池，BTN Call。Turn 掉 9，底池 12BB。你該怎麼做？', potSize: 12, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '牌面變濕，AJo 只是頂對中等 kicker，無法拿三條街價值。', conceptualError: '無', remember: '不要把頂對中等 kicker 打爆，學會控池。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '偏鬆', score: 5, bestAction: 'Check', why: '下注會被更好的牌跟，較差的牌棄牌。', conceptualError: '過度高估頂對。', remember: '邊緣牌要控池。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 0, bestAction: 'Check', why: '這牌面下大注等於自我隔離。', conceptualError: '把中等牌力當堅果打。', remember: 'SPR 高時頂對不值一個 stack。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '2', title: 'KQs 16BB 面對鬆玩家 open', category: ['短碼策略', '錦標賽'], difficulty: '進階', type: 'Tournament', blinds: '500/1000', ante: true, tourneyInfo: '中期，剩餘 50 人，錢圈 30', userStack: '16000', userBB: 16, position: 'SB', holeCards: [S('K'), S('Q')], preAction: 'CO (鬆玩家) Open 2.1BB，BTN 棄牌', effectiveStack: '16BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'CO Open 2.1BB，你在 SB 持 KQs，碼量 16BB。', potSize: 4.6, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '對手鬆，你的 KQs block 了 AK/KQ，有極高的 fold equity 與不錯的 equity。', conceptualError: '無', remember: '15-20BB 面對中後位 open，KQs 是絕佳的 re-steal 牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'All-in', why: '在 SB 平跟 16BB 非常尷尬，沒有位置且 flop 沒中只能 fold。', conceptualError: '被動防守短碼。', remember: '短碼盡量不要平跟，要有 fold equity。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'All-in', why: 'KQs 牌力太強，放棄太可惜。', conceptualError: '太過保守。', remember: '短碼需要主動尋找籌碼翻倍機會。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '3', title: 'A8o BB 面對 BTN steal', category: ['Preflop'], difficulty: '新手', type: 'Tournament', blinds: '100/200', ante: true, tourneyInfo: '前期', userStack: '6000', userBB: 30, position: 'BB', holeCards: [D('A'), C_('8')], preAction: 'BTN Open 2BB，SB 棄牌', effectiveStack: '30BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'BTN steal 2BB，你在 BB。', potSize: 3.5, options: ['Fold', 'Call', '3-bet'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '有極佳的 pot odds 可以防守，且 A8o 對抗 steal 範圍有不錯的勝率。', conceptualError: '無', remember: '大盲位面對 steal，需要較寬的防守範圍。', nextStepId: 'next_hand' },
        '3-bet': { judgment: '可接受', score: 7, bestAction: 'Call', why: '可做詐唬，但 A8o 被跟注後不好打。', conceptualError: '過度激進。', remember: 'A8o 平跟就好。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'Call', why: '放棄了太好的 pot odds。', conceptualError: '不理解底池賠率與位置防守。', remember: 'BB 面對 2BB open 只需很少的勝率即可防守。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '4', title: 'QJs 3-bet pot 濕牌面', category: ['聽牌打法', '3-Bet/4-Bet'], difficulty: '中階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'BTN', holeCards: [H('Q'), H('J')], preAction: 'CO Open 3BB，你 3-bet 9BB，CO Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [H('T'), H('9'), S('2')], description: '3-bet 底池 19.5BB。Flop (T♥ 9♥ 2♠) 你中了兩頭順與同花聽牌 (Monster Draw)。CO Check。', potSize: 19.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: '你有超強的 draw，下大注可以施壓對手的中等牌力，同時為自己的 all-in 做準備。', conceptualError: '無', remember: '強 draw 在 3-bet pot 裡要主動建立底池。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 8, bestAction: 'Bet big', why: '下注正確，但稍微偏小。', conceptualError: '給予對手太好的賠率。', remember: '濕牌面要打大。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 3, bestAction: 'Bet big', why: '放棄了主動權，也損失了 fold equity。', conceptualError: '過度被動玩強 draw。', remember: 'Monster draw 要當強牌打。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '5', title: 'AQo 面對 UTG open + 短碼 all-in', category: ['ICM 壓力', '錦標賽', 'Preflop'], difficulty: '進階', type: 'Tournament', blinds: '1000/2000', ante: true, tourneyInfo: '接近錢圈', userStack: '80000', userBB: 40, position: 'BTN', holeCards: [S('A'), D('Q')], preAction: 'UTG Open 2BB，MP (12BB) All-in', effectiveStack: '40BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'UTG (50BB) Open，MP (12BB) All-in。你在 BTN。', potSize: 17, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: 'UTG 範圍很強，且 MP all-in。你如果 call 或 all-in，面臨 UTG 的反擊會非常難受。ICM 壓力下 AQo 不夠強。', conceptualError: '無', remember: '面對 UTG open 與 all-in，AQo 容易被壓制。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '冒險隔離 12BB，但後面還有 UTG 可能拿 AA/KK/AK 等著你。', conceptualError: '忽視原 open 者的範圍。', remember: '不要輕易隔離 UTG 的 open。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '平跟最糟，邀請 UTG 擠壓 (Squeeze)。', conceptualError: '不想放棄又不敢 all-in。', remember: '這種情況通常是 Fold 或 All-in，而 AQ 只能 Fold。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '6', title: 'KK 多人 3-bet pot', category: ['控池', '多人底池', '3-Bet/4-Bet'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BB', holeCards: [S('K'), H('K')], preAction: 'UTG Open 3BB，BTN Call，你 3-bet 12BB，UTG 與 BTN 皆 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('A'), C_('T'), S('5')], description: '3-bet 底池 36BB。Flop (A♦ T♣ 5♠) 有一張 A。', potSize: 36, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: 'A 高牌面，且是多人底池，有人拿 A 的機率非常高。KK 有攤牌價值但無法拿價值，應先過牌控池。', conceptualError: '無', remember: '多人 3-bet pot 掉 A，沒有 A 就要小心。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '偏鬆', score: 5, bestAction: 'Check', why: '可能當作詐唬，但對手有 A 不會蓋。', conceptualError: '無法放下強牌。', remember: '控池勝過無謂的 c-bet。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 0, bestAction: 'Check', why: '純送錢，只有比你強的牌會跟注。', conceptualError: '死抱高對不放。', remember: '面對 A high board，KK 只是中等牌。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '7', title: '88 中 set 濕牌面', category: ['強牌價值', 'Value Bet'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'MP', holeCards: [S('8'), C_('8')], preAction: '你 Open 3BB，CO Call，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('T'), H('8'), D('7')], description: '底池 9.5BB。Flop (T♦ 8♥ 7♦)。BB Check。', potSize: 9.5, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: '極度濕潤的牌面 (同花聽牌、順子聽牌)，你需要打大收價值並剝奪對手的勝率。', conceptualError: '無', remember: '濕牌面強牌要打大。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '錯誤', score: 3, bestAction: 'Bet big', why: '給予各種聽牌太好的賠率。', conceptualError: '錯誤的下注尺度。', remember: '不要給對手便宜看牌的機會。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 0, bestAction: 'Bet big', why: '極度糟糕，免費發牌給對手聽牌。', conceptualError: '慢打不分場合。', remember: '濕牌面絕對不要慢打 set。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '8', title: 'KQs 面對三街壓力', category: ['抓雞/Bluff Catch', '邊緣牌'], difficulty: '進階', type: 'Tournament', blinds: '1k/2k', ante: true, userStack: '100k', userBB: 50, position: 'BB', holeCards: [S('K'), S('Q')], preAction: 'BTN Open 2BB，你 Call', effectiveStack: '50BB',
    steps: [
      { id: '1', street: 'River', communityCards: [D('K'), C_('7'), H('4'), S('2'), D('J')], description: 'Flop K-7-4 虹面，他打 1.5BB 你跟。Turn 2 他打 4BB 你跟。River J，底池 16BB。對手 All-in 42.5BB。', potSize: 16, options: ['Fold', 'Call'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '對手在沒什麼聽牌的面上連開三槍 all-in，極化範圍偏向強牌(AK/KJ/Set)。你的頂對無法抓雞。', conceptualError: '無', remember: '尊重微聽牌面上的連三槍重注。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '你的牌只是抓雞牌 (Bluff catcher)，而對手的 line 缺乏足夠的詐唬。', conceptualError: '抓雞過度。', remember: '頂對不能硬扛三槍全下。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '9', title: 'A5s nut flush draw turn', category: ['同花聽牌', '聽牌打法'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [H('A'), H('5')], preAction: 'CO Open 3BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [H('K'), C_('8'), D('2'), H('4')], description: 'Flop 你們過牌。Turn (K♥ 8♣ 2♦ 4♥) 你有堅果同花聽牌加卡順。底池 7.5BB。CO 下注 6BB。', potSize: 7.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '雖然賠率稍差，但你有隱含賠率 (Implied Odds) 與位置優勢，且是堅果聽牌。', conceptualError: '無', remember: '好聽牌面對重注可以跟注一次看 river。', nextStepId: 'next_hand' },
        'Raise': { judgment: '可接受', score: 8, bestAction: 'Call', why: '半詐唬 (Semi-bluff) 可行，但如果被 push 就很難受。', conceptualError: '過度激進。', remember: '有位置時平跟看牌也是好選擇。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'Call', why: '勝率太高，放棄可惜。', conceptualError: '太緊。', remember: '12 張 outs 以上的強聽牌不要輕易蓋掉。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '10', title: 'KJo BB 呼叫短碼', category: ['短碼策略', '錦標賽'], difficulty: '中階', type: 'Tournament', blinds: '500/1000', ante: true, userStack: '30000', userBB: 30, position: 'BB', holeCards: [S('K'), D('J')], preAction: 'CO (9.5BB) All-in，BTN/SB 棄牌', effectiveStack: '9.5BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '底池 12BB (包含你的 1BB)。你還需要補 8.5BB。', potSize: 12, options: ['Fold', 'Call'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '底池賠率好 (需 8.5 贏 20.5)，且 CO 9.5BB shove 範圍寬，KJo 有足夠勝率。', conceptualError: '無', remember: '大盲位面對短碼 shove 需要用數學賠率計算防守範圍。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '放棄了有利可圖的 call。', conceptualError: '賠率計算錯誤。', remember: '短碼 shove 時，KJo 在 BB 常常是 +EV 的 call。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '11', title: 'ATo Turn 壞牌', category: ['控池', '邊緣牌'], difficulty: '中階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'HJ', holeCards: [S('A'), C_('T')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [H('T'), D('7'), C_('4'), S('8')], description: 'Flop (T-7-4) 你 C-bet 4BB，BB Call。Turn (8) 完成順子聽牌。底池 14.5BB。BB 突然領打 (Donk bet) 10BB。', potSize: 14.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '對手在危險 Turn 牌領打，通常代表極強的牌 (順子或兩對)，頂對 ATo 已經落後。', conceptualError: '無', remember: '尊重對手在壞牌的領打。', nextStepId: 'next_hand' },
        'Call': { judgment: '偏鬆', score: 4, bestAction: 'Fold', why: '跟注只會讓你陷入 River 更難打的局面。', conceptualError: '死抓頂對。', remember: '牌面結構改變時要重新評估牌力。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '純粹送錢。', conceptualError: '不理智的攻擊。', remember: '落後時不要詐唬強範圍。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '12', title: 'JTs J-high flush', category: ['抓雞/Bluff Catch', '同花聽牌'], difficulty: '進階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'CO', holeCards: [S('J'), S('T')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [S('8'), S('5'), D('2'), C_('4'), S('7')], description: 'Flop, Turn 都過牌。River 掉 7♠，你成 J-high 同花。底池 6.5BB。BB 突然 All-in 97BB。', potSize: 6.5, options: ['Fold', 'Call'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '這是一個巨大的 overbet。你的 J 同花非堅果，對手極化為 A/K 同花或純詐唬。通常小級別玩家很少用這種 size 詐唬。', conceptualError: '無', remember: 'Overbet 時非堅果牌要極其小心。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '被 A/K 同花壓榨。', conceptualError: '無法蓋掉同花。', remember: '同花也有分大小。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '13', title: 'AK miss flop', category: ['常規戰術'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'MP', holeCards: [H('A'), D('K')], preAction: '你 Open 3BB，BTN Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [S('9'), C_('5'), D('2'), H('J')], description: 'Flop (9-5-2) 你 C-bet 半池被 Call。Turn (J)。底池 14.5BB。', potSize: 14.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: 'AK 沒中，Turn 對手範圍有 J, 9，你沒有勝率，應該放棄。', conceptualError: '無', remember: 'AK 沒中時，Turn 該放棄就放棄。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '錯誤', score: 2, bestAction: 'Check', why: '盲目開第二槍浪費籌碼。', conceptualError: '不願放棄強起手牌。', remember: '未成牌無法支付太多價值。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 0, bestAction: 'Check', why: '糟糕的詐唬。', conceptualError: '胡亂詐唬。', remember: 'AK 只是高牌。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '14', title: '55 13BB shove', category: ['短碼策略', '錦標賽'], difficulty: '中階', type: 'Tournament', blinds: '1000/2000', ante: true, userStack: '26000', userBB: 13, position: 'CO', holeCards: [S('5'), D('5')], preAction: '前面皆棄牌', effectiveStack: '13BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '你在 CO 持 55，碼量 13BB。', potSize: 4, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '短碼時，中小口袋對在 CO 是一個標準的 push 範圍。', conceptualError: '無', remember: '15BB 以下的口袋對在晚位可以直接 all-in 收池。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '平跟只會被剝削。', conceptualError: '被動。', remember: '短碼不要平跟。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'All-in', why: '放棄了 +EV 的機會。', conceptualError: '過度保守。', remember: '小對子也是強牌。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '15', title: 'KTs 面對 3-bet', category: ['Preflop', '3-Bet/4-Bet'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'HJ', holeCards: [S('K'), S('T')], preAction: '你 Open 3BB，BTN 3-bet 到 9BB', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '你被 BTN 3-bet 到 9BB，該怎麼做？', potSize: 13.5, options: ['Fold', 'Call', '4-bet (Raise)'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: 'KTs 在沒位置面對 3-bet 容易被壓制 (KQs, AK)，直接蓋掉是標準打法。', conceptualError: '無', remember: '邊緣同花牌沒位置時果斷蓋給 3-bet。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: 'OOP (Out of position) 玩邊緣牌是輸錢的主因。', conceptualError: '高估同花牌。', remember: '不要 OOP 跟 3-bet。', nextStepId: 'next_hand' },
        '4-bet (Raise)': { judgment: '偏鬆', score: 5, bestAction: 'Fold', why: '偶爾可做 4-bet 詐唬，但不適合常規。', conceptualError: '過度激進。', remember: '選擇更好的阻擋牌 4-bet。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '16', title: 'JJ 面對激進 3-bet', category: ['3-Bet/4-Bet', 'Preflop'], difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'CO', holeCards: [S('J'), D('J')], preAction: '你 Open 3BB，BTN (非常激進) 3-bet 到 10BB', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '你持 JJ 被激進 BTN 3-bet。', potSize: 14.5, options: ['Fold', 'Call', '4-bet (Raise)'], feedbacks: {
        '4-bet (Raise)': { judgment: '正確', score: 10, bestAction: '4-bet (Raise)', why: '面對激進對手，JJ 是強牌，4-bet 可以拿價值並掌握主動權。', conceptualError: '無', remember: '面對寬範圍的 3-bet，JJ 應該 4-bet。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 7, bestAction: '4-bet (Raise)', why: '平跟保留對手詐唬，但 OOP 較難打。', conceptualError: '過於被動。', remember: 'OOP JJ 建議 4-bet。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: '4-bet (Raise)', why: '被激進玩家剝削。', conceptualError: '太緊。', remember: 'JJ 是強牌。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '17', title: 'A7s 中兩對濕牌面', category: ['強牌價值', 'Value Bet'], difficulty: '中階', type: 'Tournament', blinds: '200/400', ante: true, userStack: '16000', userBB: 40, position: 'BB', holeCards: [S('A'), S('7')], preAction: 'BTN Open 2BB，你 Call', effectiveStack: '40BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('A'), C_('7'), D('6')], description: 'Flop (A♦ 7♣ 6♦)，你中了頂底兩對。底池 5.5BB。你過牌，BTN 下注 3BB。', potSize: 8.5, options: ['Call', 'Raise', 'All-in'], feedbacks: {
        'Raise': { judgment: '正確', score: 10, bestAction: 'Raise', why: '牌面很濕，有很多聽牌 (同花、順子)，你需要 Raise 保護手牌並拿價值。', conceptualError: '無', remember: '脆弱的兩對在濕牌面要快打 (Fast play)。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 3, bestAction: 'Raise', why: '慢打會讓轉牌發出很多恐怖牌 (任何方塊、5、8、9)。', conceptualError: '危險牌面慢打。', remember: '保護你的 equity。', nextStepId: 'next_hand' },
        'All-in': { judgment: '偏鬆', score: 5, bestAction: 'Raise', why: '打太大，對手會蓋掉所有較弱的牌。', conceptualError: 'Size 不當。', remember: '正常的 Raise size (約 3 倍) 即可。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '18', title: 'AK 面對 MP', category: ['Preflop', '3-Bet/4-Bet'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'BTN', holeCards: [H('A'), C_('K')], preAction: 'MP Open 3BB，CO 棄牌', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '你在 BTN 持 AKo 面對 MP open 3BB。', potSize: 4.5, options: ['Fold', 'Call', '3-bet'], feedbacks: {
        '3-bet': { judgment: '正確', score: 10, bestAction: '3-bet', why: 'AK 是超強牌，有位置優勢一定要 3-bet 拿價值與建立底池。', conceptualError: '無', remember: 'AK 幾乎總是 3-bet。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 4, bestAction: '3-bet', why: '平跟讓盲注有好的賠率進來，多人底池 AK 容易輸。', conceptualError: '不敢造池。', remember: '未成牌怕多人底池。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: '3-bet', why: '放棄頂級牌。', conceptualError: '完全不會玩。', remember: '永遠不要蓋 AK 除非面對 4bet/5bet。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '19', title: 'QQ A-high', category: ['控池', '邊緣牌'], difficulty: '中階', type: 'Tournament', blinds: '1k/2k', ante: true, userStack: '100k', userBB: 50, position: 'MP', holeCards: [S('Q'), H('Q')], preAction: '你 Open 2.1BB，BB Call', effectiveStack: '50BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [C_('A'), D('8'), S('2')], description: '底池 6.2BB。Flop (A♣ 8♦ 2♠)。BB Check。', potSize: 6.2, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '牌面有 A，你的 QQ 降級為第二大對子。此牌面很乾，不需要保護，過牌控池並保留對手的詐唬。', conceptualError: '無', remember: 'Underpair 面對 A high board 優先考慮過牌。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '可接受', score: 6, bestAction: 'Check', why: '作為範圍下注 (Range bet) 可行，但被 raise 會很難受。', conceptualError: '無', remember: '控池更安全。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 0, bestAction: 'Check', why: '只會被 A 跟注，較差的牌全蓋。', conceptualError: '將攤牌價值牌當價值牌打。', remember: '不要自己隔離自己。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '20', title: '66 set 河牌危險', category: ['抓雞/Bluff Catch', '邊緣牌'], difficulty: '進階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'CO', holeCards: [S('6'), C_('6')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [D('K'), H('6'), S('5'), D('7'), D('8')], description: '前兩街你都下注，BB 都 Call。River 掉 8♦，牌面完成四面順子且同花也到了。底池 30BB。BB 突然領打 (Donk bet) 25BB。', potSize: 30, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '這是一個極度惡劣的 River。順子、同花都可能成，且對手在沒主動權時領打大注。你的 66 Set 在這裡只能抓雞，但這面太危險。', conceptualError: '無', remember: '牌面全毀時，Set 也必須學會蓋牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '過於勉強的抓雞。', conceptualError: '死抱 Set 不放。', remember: '相對牌力已經很低。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '自殺行為。', conceptualError: '情緒失控。', remember: '永遠不要在這裡 raise。', nextStepId: 'next_hand' }
      }}
    ]
  }
,

  {
    id: '21', title: 'AQo 3-bet 遇 4-bet', category: ['3-Bet/4-Bet', 'Preflop'], difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'CO', holeCards: [S('A'), D('Q')], preAction: 'HJ Open 3BB，你 3-bet 9BB，HJ 4-bet 25BB', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '面對 4-bet，底池 35.5BB。', potSize: 35.5, options: ["Fold","Call","All-in"], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: 'AQo 面對 4-bet 處於絕對劣勢，通常對手範圍是 QQ+, AK。', conceptualError: '無', remember: '不要高估 AQo，面對 4-bet 要果斷放棄。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: 'OOP 或被動防守 4-bet 非常虧錢。', conceptualError: '死抱強起手牌。', remember: 'AQ 只是抓雞牌。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '自殺式詐唬。', conceptualError: '情緒失控。', remember: '4-bet 範圍極強。', nextStepId: 'next_hand' }
      }}
    ]
  },

  {
    id: '22', title: '同花聽牌 Flop 被 Raise', category: ['同花聽牌', '聽牌打法'], difficulty: '中階', type: 'Tournament', blinds: '500/1000', ante: true, userStack: '40000', userBB: 40, position: 'BTN', holeCards: [H('8'), H('7')], preAction: '你 Open 2BB，BB Call', effectiveStack: '40BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [H('K'), H('2'), S('5')], description: 'Flop 你中了同花聽牌。底池 5.5BB。你 C-bet 2BB，BB Raise 到 7BB。', potSize: 14.5, options: ["Fold","Call","All-in"], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '有位置優勢，且是強聽牌，跟注看轉牌是標準打法。', conceptualError: '無', remember: '面對 Raise，有位置的同花聽牌可以跟注。', nextStepId: 'next_hand' },
        'All-in': { judgment: '可接受', score: 7, bestAction: 'Call', why: '半詐唬 shove 也是一種打法，但會被 Kx 或更好的聽牌跟注。', conceptualError: '激進過頭。', remember: '平跟保留彈性。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'Call', why: '放棄了極好的勝率。', conceptualError: '過度退縮。', remember: '強聽牌不能輕易 Fold。', nextStepId: 'next_hand' }
      }}
    ]
  },

  {
    id: '23', title: '短碼 10BB BB 位防守', category: ['短碼策略', '錦標賽'], difficulty: '新手', type: 'Tournament', blinds: '1000/2000', ante: true, userStack: '20000', userBB: 10, position: 'BB', holeCards: [S('T'), S('9')], preAction: 'BTN Open 2BB，SB 棄牌', effectiveStack: '10BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'BTN steal，你剩 10BB。', potSize: 4.5, options: ["Fold","Call","All-in"], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: 'T9s 有很好的 blocker 和 equity，10BB 直接 shove 施壓 BTN steal 範圍。', conceptualError: '無', remember: '短碼在 BB 拿到中等同花連牌是很好的 shove 牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'All-in', why: '平跟剩下 8BB postflop 很難打。', conceptualError: '被動防守。', remember: '10BB 只有 Push/Fold。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'All-in', why: '放棄了 +EV shove。', conceptualError: '過緊。', remember: '不要讓盲注被偷光。', nextStepId: 'next_hand' }
      }}
    ]
  },

  {
    id: '24', title: '中底對 Turn 面對大注', category: ['控池', '邊緣牌'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [C_('9'), C_('8')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [D('K'), S('9'), H('4'), S('2')], description: 'Flop K-9-4 虹面，BB check-call 2BB。Turn 掉 2，底池 10.5BB。BB 突然領打 (Donk) 8BB。', potSize: 18.5, options: ["Fold","Call","Raise"], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: 'BB 的 Donk bet 通常代表強牌，9 的中對不足以抓雞。', conceptualError: '無', remember: '低級別 Donk bet 多半是真牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '抓雞過度，只會輸更多。', conceptualError: '不願蓋牌。', remember: '中對抗壓力差。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '毫無邏輯的加注。', conceptualError: '亂玩。', remember: '落後時不要加注。', nextStepId: 'next_hand' }
      }}
    ]
  },

  {
    id: '25', title: '頂對頂踢 ICM 壓力', category: ['ICM 壓力', '錦標賽'], difficulty: '進階', type: 'Tournament', blinds: '5k/10k', ante: true, userStack: '300k', userBB: 30, position: 'MP', holeCards: [S('A'), C_('Q')], preAction: '泡沫期 (Bubble)，你 Open 2BB，BTN (大籌碼 100BB) 3-bet 6BB', effectiveStack: '30BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '面對大籌碼的 3-bet，你有 30BB。', potSize: 10.5, options: ["Fold","Call","All-in"], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: 'ICM 泡沫期生存第一，大籌碼利用泡沫壓榨，AQo 雖然強但不值得冒淘汰風險。', conceptualError: '無', remember: '泡沫期面對大籌碼要極端保守。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '泡沫期撞上大籌碼的強範圍就出局了。', conceptualError: '無視 ICM。', remember: '生存比籌碼翻倍重要。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 4, bestAction: 'Fold', why: 'OOP 玩 3-bet pot 在泡沫期是折磨。', conceptualError: '猶豫不決。', remember: '泡沫期少平跟。', nextStepId: 'next_hand' }
      }}
    ]
  },

  {
    id: '26', title: '多人底池 Flush 聽牌', category: ['多人底池', '同花聽牌', '聽牌打法'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'CO', holeCards: [D('K'), D('J')], preAction: 'UTG Open 3BB, MP Call, 你 Call, BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('T'), S('7'), D('2')], description: 'Flop (T♦ 7♠ 2♦) 你有 K high 同花聽牌。底池 12.5BB。前面都 check，輪到你。', potSize: 12.5, options: ["Check","Bet half pot","Bet big"], feedbacks: {
        'Bet half pot': { judgment: '正確', score: 10, bestAction: 'Bet half pot', why: '有多人底池，你有強聽牌，可以下注半池拿半詐唬價值，並可能直接拿下底池。', conceptualError: '無', remember: '好聽牌要主動造池。', nextStepId: 'next_hand' },
        'Check': { judgment: '偏緊', score: 6, bestAction: 'Bet half pot', why: '過牌拿免費牌也可行，但錯失了 fold equity。', conceptualError: '太被動。', remember: '有位置可以多施壓。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 3, bestAction: 'Bet half pot', why: '打太大容易被強牌 raise，逼走弱牌。', conceptualError: '尺度不佳。', remember: '聽牌不需要 overbet。', nextStepId: 'next_hand' }
      }}
    ]
  },

  {
    id: '27', title: '超強牌 Slow play 陷阱', category: ['慢打/Slow Play', '強牌價值'], difficulty: '中階', type: 'Tournament', blinds: '100/200', ante: true, userStack: '10000', userBB: 50, position: 'UTG', holeCards: [S('A'), H('A')], preAction: '你 Open 2BB，BTN Call', effectiveStack: '50BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('A'), C_('8'), H('2')], description: 'Flop 你中了頂 Set。底池 5.5BB。', potSize: 5.5, options: ["Check","Bet small","Bet big"], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '超級乾燥牌面，你阻擋了對手拿頂對的可能，過牌讓對手詐唬。', conceptualError: '無', remember: '乾燥且阻擋對手範圍時可以慢打。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '可接受', score: 7, bestAction: 'Check', why: '下小注也可以，但對手容易蓋牌。', conceptualError: '無', remember: '考量牌面濕度決定是否慢打。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 0, bestAction: 'Check', why: '趕走所有對手。', conceptualError: '不懂控制節奏。', remember: '死乾面不要打大。', nextStepId: 'next_hand' }
      }}
    ]
  },

  {
    id: '28', title: '河牌抓雞 Blocker 效應', category: ['抓雞/Bluff Catch', 'Blocker'], difficulty: '進階', type: 'Cash Game', blinds: '5/10', ante: false, userStack: '1000', userBB: 100, position: 'BB', holeCards: [S('A'), H('K')], preAction: 'BTN Open 2.5BB，你 3-bet 10BB，BTN Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [S('Q'), H('J'), D('5'), C_('2'), S('2')], description: '前兩街過牌。River 底池 20BB。你過牌，BTN 下注 15BB。', potSize: 35, options: ["Fold","Call","Raise"], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '你雖然只有 A high，但阻擋了 AK/AQ 等強牌，對手極化範圍中很多沒中的聽牌，是很好的抓雞牌。', conceptualError: '無', remember: '利用 Blocker 決定是否抓雞。', nextStepId: 'next_hand' },
        'Fold': { judgment: '可接受', score: 6, bestAction: 'Call', why: '保守打法，避免變異。', conceptualError: '未能識別 Blocker 價值。', remember: 'A high 有時是最佳抓雞牌。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 0, bestAction: 'Call', why: '把抓雞牌轉為詐唬，只會被強牌跟。', conceptualError: '邏輯混亂。', remember: '抓雞牌不要 Raise。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '29', title: 'AQ 頂對河牌薄價值', category: ['Value Bet'], villainProfile: 'Loose Passive (跟注站傾向)', difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [S('A'), D('Q')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [H('Q'), C_('7'), D('3'), S('2'), D('9')], description: 'Flop 你 C-bet 2BB 被跟，Turn 雙方過牌。River 掉 9♦，BB 過牌。底池 10.5BB。對手是鬆被動的休閒玩家。', potSize: 10.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Bet half pot': { judgment: '正確', score: 10, bestAction: 'Bet half pot', why: '對手是跟注站，會用 Qx 弱 kicker、口袋對甚至 7x 付錢。頂對好 kicker 在這裡幾乎總是最好的牌，必須做薄價值下注。', conceptualError: '無', remember: '面對鬆被動玩家，河牌薄價值下注是長期贏利的核心來源。', nextStepId: 'next_hand' },
        'Check': { judgment: '偏緊', score: 5, bestAction: 'Bet half pot', why: '錯過明顯價值。被動玩家過牌不代表沒牌，他們幾乎從不主動下注。', conceptualError: '價值下注不足。', remember: '最好的牌不下注，就是把錢留在桌上。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '偏鬆', score: 4, bestAction: 'Bet half pot', why: '打太大會趕走大部分能跟注的較差牌，剩下跟你的反而是兩對以上。', conceptualError: '尺寸與目標範圍不匹配。', remember: '薄價值要選對手範圍跟得起的尺寸。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '30', title: '66 中 set 乾面造池', category: ['Value Bet', '強牌價值'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'CO', holeCards: [S('6'), C_('6')], preAction: '你 Open 3BB，BTN Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [D('K'), H('6'), S('2'), C_('T')], description: 'Flop (K-6-2) 你 C-bet 3BB 被跟。Turn 掉 T。底池 13.5BB。', potSize: 13.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: '你有 set，牌面乾燥，對手大概率有 Kx 或 Tx 願意付錢。現在不把底池做大，河牌就打不進整個 stack。', conceptualError: '無', remember: '強牌要從 Turn 開始規劃三條街價值，逐街加大尺寸。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 7, bestAction: 'Bet big', why: '有下注意識，但尺寸偏小，錯失建立大底池的最佳時機。', conceptualError: '造池不足。', remember: '對手能跟時就打大一點。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 2, bestAction: 'Bet big', why: '乾面 set 過牌只是錯失價值，對手很少替你詐唬。', conceptualError: '對強牌過度慢打。', remember: '價值牌不下注就是燒錢。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '31', title: '堅果同花河牌超額下注', category: ['Value Bet', '強牌價值'], difficulty: '進階', type: 'Tournament', blinds: '300/600', ante: true, tourneyInfo: '中期', userStack: '24000', userBB: 40, position: 'BTN', holeCards: [H('A'), H('J')], preAction: 'CO Open 2.2BB，你 Call', effectiveStack: '40BB',
    steps: [
      { id: '1', street: 'River', communityCards: [H('K'), H('8'), S('4'), D('Q'), H('2')], description: 'Flop 你跟注 CO 的 3BB C-bet。Turn 雙方過牌。River 2♥ 完成你的堅果同花，CO 過牌。底池 13BB，你剩約 35BB。', potSize: 13, options: ['Check', 'Bet half pot', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '堅果在手，範圍極化時超額下注能從對手的 Kx 同花、兩對、set 身上榨出最大價值——他們很難對堅果面過牌棄掉一切。', conceptualError: '無', remember: '河牌拿到堅果，思考的不是「會不會被跟」而是「怎麼拿最多」。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 6, bestAction: 'All-in', why: '能拿到跟注，但堅果牌配這種尺寸太客氣，範圍優勢支持更大的下注。', conceptualError: '價值極大化不足。', remember: '堅果牌敢於超額下注。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '河牌慢打堅果等於直接放棄整手牌的價值，後面沒有街了。', conceptualError: '慢打不分街道。', remember: 'River 是最後一條街，沒有埋伏的空間。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '32', title: 'AJ 轉牌成兩對加大價值', category: ['Value Bet'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'HJ', holeCards: [D('A'), C_('J')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [S('J'), D('7'), C_('2'), C_('A')], description: 'Flop 你 C-bet 2BB 被跟。Turn 掉 A，你成頂兩對。BB 過牌，底池 10.5BB。', potSize: 10.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: 'Turn 的 A 讓 BB 範圍裡所有 Ax 升級成頂對並願意付錢，而它們全部被你的兩對壓制。這正是加大尺寸的完美時機。', conceptualError: '無', remember: '當對手範圍撞上一張讓他「變強但仍落後」的牌，就是打大的時候。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 7, bestAction: 'Bet big', why: '方向正確但尺寸保守，對手的 Ax 跟得起更大的注。', conceptualError: '價值不夠飽滿。', remember: '對手範圍變強時要敢於加碼。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 2, bestAction: 'Bet big', why: '對手 check-call 範圍裡有大量 Ax/Jx 願意支付兩條街，過牌白白放掉一街價值。', conceptualError: '對兩對過度謹慎。', remember: '兩對在單一加注池是大價值牌。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '33', title: '頂對對跟注站三街價值', category: ['Value Bet'], villainProfile: 'Calling Station (跟注站)', difficulty: '新手', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'MP', holeCards: [S('K'), S('Q')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [H('K'), C_('9'), D('5'), S('3'), D('7')], description: 'Flop、Turn 你各下半池都被跟注。River 掉 7♦，對手過牌。底池 24.5BB，你持頂對好 kicker。', potSize: 24.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Bet half pot': { judgment: '正確', score: 10, bestAction: 'Bet half pot', why: '跟注站的定義：不棄牌、也極少詐唬。對付他們就是用成手價值下注到底，KQ 頂對在這個 runout 幾乎總是最好的牌。', conceptualError: '無', remember: '對跟注站：多價值、零詐唬、下到河牌為止。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '可接受', score: 7, bestAction: 'Bet half pot', why: '面對真正的跟注站甚至可以更大，但要留意他突然加注時代表超強牌。', conceptualError: '無', remember: '跟注站河牌加注 = 堅果。', nextStepId: 'next_hand' },
        'Check': { judgment: '偏緊', score: 4, bestAction: 'Bet half pot', why: '對跟注站過牌等於把錢留在桌上，他會用 K 弱踢、99-QQ 甚至 9x 付你錢。', conceptualError: '第三街價值下注缺失。', remember: '三條街價值是對站姿玩家的標準懲罰。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '34', title: '轉牌三條面對第二槍', category: ['Value Bet', '強牌價值'], difficulty: '中階', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'BB', holeCards: [S('A'), H('8')], preAction: 'BTN Open 2.5BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [C_('8'), D('8'), S('K'), H('4')], description: 'Flop (8♣ 8♦ K♠) 你過牌跟注 2BB。Turn 4♥ 你過牌，BTN 再下注 5BB。底池 14.5BB。', potSize: 14.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Raise': { judgment: '正確', score: 10, bestAction: 'Raise', why: '你的三條頂 kicker 遠遠領先 BTN 的持續下注範圍，轉牌加注開始造池，讓 Kx 與口袋對付兩條街大注。', conceptualError: '無', remember: '強牌埋伏一街可以，埋伏兩街常會錯過整個 stack。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 7, bestAction: 'Raise', why: '繼續埋伏到河牌也可行，但河牌對手可能縮手，你會錯過造池窗口。', conceptualError: '價值路線過於被動。', remember: '對手還在開槍時就是加注的最好時機。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'Raise', why: '你拿著三條棄牌。', conceptualError: '牌力判讀錯誤。', remember: '對子牌面你的 8x 是巨獸。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '35', title: 'AA 轉牌持續價值', category: ['Value Bet'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'MP', holeCards: [S('A'), D('A')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [H('9'), C_('6'), S('3'), D('Q')], description: 'Flop (9-6-3) 你 C-bet 3BB 被跟。Turn 掉 Q。BB 過牌，底池 12.5BB。', potSize: 12.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: 'Q 給對手範圍補進大量能跟注的頂對，你的 AA 仍壓制一切。繼續打大拿價值，同時不給順子聽牌免費看牌。', conceptualError: '無', remember: '高對不是用來攤牌的，是用來下三條街價值的。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 7, bestAction: 'Bet big', why: '持續下注正確，但這張 Turn 對手範圍變強，可以更大。', conceptualError: '無', remember: '對手能跟的牌變多時，加大尺寸。', nextStepId: 'next_hand' },
        'Check': { judgment: '偏緊', score: 3, bestAction: 'Bet big', why: '高對過牌控池是對 AA 最常見的浪費，也讓聽牌免費追。', conceptualError: '把大價值牌當邊緣牌打。', remember: 'AA 在單一加注池很少需要控池。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '36', title: 'KQ 頂對低 SPR 全下', category: ['Value Bet', 'SPR'], difficulty: '中階', type: 'Tournament', blinds: '400/800', ante: true, tourneyInfo: '中後期', userStack: '24000', userBB: 30, position: 'CO', holeCards: [S('K'), H('Q')], preAction: '你 Open 2.2BB，BB (短碼 18BB) Call', effectiveStack: '18BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [D('Q'), S('8'), C_('4'), D('2')], spr: 1.1, description: 'Flop 你 C-bet 3BB 被跟。Turn 2♦，底池 12BB，對手只剩約 12.8BB (SPR ≈ 1)。BB 過牌。', potSize: 12, options: ['Check', 'Bet half pot', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: 'SPR 只剩 1，你的頂對好 kicker 對短碼的防守範圍遠遠領先，直接全下讓較差的 Qx、8x、口袋對全額付清。', conceptualError: '無', remember: 'SPR 低於 2 時，頂對就是全下級別的牌，不要玩花樣。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 6, bestAction: 'All-in', why: '也會把錢打進去，但殘碼太淺，分兩次下注只是多一次操作失誤的空間。', conceptualError: '低 SPR 下多餘的精細化。', remember: '碼淺就一次推完。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 2, bestAction: 'All-in', why: '給對手免費翻牌反超的機會。低 SPR 沒有任何控池的必要。', conceptualError: '把低 SPR 局面當深籌碼打。', remember: '控池是深籌碼的概念，碼淺請套池。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '37', title: 'AK 3-bet 池低 SPR 頂對', category: ['SPR', '3-Bet/4-Bet'], difficulty: '中階', type: 'Tournament', blinds: '500/1000', ante: true, tourneyInfo: '中期', userStack: '35000', userBB: 35, position: 'SB', holeCards: [C_('A'), C_('K')], preAction: 'BTN Open 2.3BB，你 SB 3-bet 9BB，BTN Call', effectiveStack: '35BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('K'), S('7'), H('2')], spr: 1.3, description: '3-bet 底池約 20BB，你剩 26BB (SPR ≈ 1.3)。Flop (K♦ 7♠ 2♥) 你中頂對頂踢。', potSize: 20, options: ['Check', 'Bet half pot', 'All-in'], feedbacks: {
        'Bet half pot': { judgment: '正確', score: 10, bestAction: 'Bet half pot', why: '下半池讓對手的整個防守範圍付錢，轉牌任何一張牌都能自然全下。低 SPR 下 TPTK 就是套池計畫的頂端牌力。', conceptualError: '無', remember: '3-bet 前先算好翻後 SPR，中頂對就照計畫把錢打完。', nextStepId: 'next_hand' },
        'All-in': { judgment: '可接受', score: 8, bestAction: 'Bet half pot', why: '直接推也完全可以，只是半池下注能多留住一些較差的跟注。', conceptualError: '無', remember: '兩種打法都通向套池，選擇留住更多錯誤跟注的那條。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 2, bestAction: 'Bet half pot', why: 'SPR 這麼低沒有任何理由設陷阱，只會送免費牌並讓對手的空氣安全攤牌。', conceptualError: '低 SPR 慢打。', remember: '碼淺的 TPTK 不需要花招，直接要錢。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '38', title: '深籌碼高 SPR 頂對減速', category: ['SPR', '控池'], difficulty: '進階', type: 'Cash Game', blinds: '5/10', ante: false, userStack: '1000', userBB: 100, position: 'BTN', holeCards: [D('K'), D('J')], preAction: '你 Open 2.5BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [S('K'), H('9'), C_('3'), D('2')], spr: 3.4, description: 'Flop 你 C-bet 3.5BB，BB check-raise 到 12BB，你跟注。Turn 2♦，BB 再度重砲 22BB，底池 29.5BB。', potSize: 29.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '100BB 深度下，check-raise 加轉牌重砲的組合代表對手準備打光全部籌碼。深籌碼(高 SPR)時頂對只是抓雞牌，而這條 line 詐唬占比太低。', conceptualError: '無', remember: 'SPR 越深，打光全部籌碼所需的牌力越強——頂對在深籌碼下扛不了三條街重注。', nextStepId: 'next_hand' },
        'Call': { judgment: '偏鬆', score: 4, bestAction: 'Fold', why: '跟了這條街，河牌幾乎必定面對全下，你等於用頂對報名打 100BB。', conceptualError: '沒有預想整手牌的走向。', remember: '跟注前先問自己：河牌他推了我跟嗎？', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '對手範圍極強，加注只是把死錢送進去。', conceptualError: '對強範圍升級對抗。', remember: '別對著套池線加注一對。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '39', title: '小對子深籌碼 set mining', category: ['SPR', 'Preflop'], difficulty: '新手', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [S('2'), D('2')], preAction: 'CO Open 3BB，雙方皆 100BB 深', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'CO Open 3BB，你在 BTN 持 22。', potSize: 4.5, options: ['Fold', 'Call', '3-bet'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '中 set 機率約 12%，但 100BB 的深度提供超過 20:1 的隱含賠率——高 SPR 正是小對子靠 set 掙大錢的環境。', conceptualError: '無', remember: 'set mining 的本質是 SPR：深籌碼跟、淺籌碼丟。', nextStepId: 'next_hand' },
        '3-bet': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '被 4-bet 只能棄牌，把一手有隱含賠率的牌自己玩死。', conceptualError: '用錯誤的牌型詐唬。', remember: '小對子要的是便宜看翻牌，不是主動權。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'Call', why: '深籌碼有位置的小對子是明確有利可圖的跟注。', conceptualError: '忽視隱含賠率。', remember: '位置 + 深碼 = 小對子的黃金組合。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '40', title: '小對子面對 3-bet 碼太淺', category: ['SPR', 'Preflop', '3-Bet/4-Bet'], difficulty: '中階', type: 'Tournament', blinds: '600/1200', ante: true, tourneyInfo: '中期', userStack: '42000', userBB: 35, position: 'CO', holeCards: [H('5'), C_('5')], preAction: '你 Open 2.2BB，BTN 3-bet 7BB', effectiveStack: '35BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '你被 BTN 3-bet 到 7BB，有效籌碼 35BB。', potSize: 11.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '再投 4.8BB 去搏 12% 的 set，需要約 15:1 的隱含賠率，35BB 的殘碼根本付不起；55 翻後沒中 set 幾乎無法繼續。', conceptualError: '無', remember: '同一手 22-66，100BB 是跟注、35BB 是棄牌——SPR 決定一切。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 3, bestAction: 'Fold', why: '隱含賠率不足的 set mining 是長期漏錢的典型漏洞。', conceptualError: '不看籌碼深度硬中 set。', remember: 'set mining 需要 15:1 以上的有效籌碼。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '35BB 用中小對子去翻硬幣或撞鐵板，完全沒有必要。', conceptualError: '把邊緣牌打成核彈。', remember: '不是所有 3-bet 都要正面回應。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '41', title: 'AQs 25BB 用 3-bet 製造低 SPR', category: ['SPR', 'Preflop', '3-Bet/4-Bet'], difficulty: '進階', type: 'Tournament', blinds: '1000/2000', ante: true, tourneyInfo: '中後期', userStack: '50000', userBB: 25, position: 'BTN', holeCards: [S('A'), S('Q')], preAction: 'CO Open 2.2BB', effectiveStack: '25BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'CO Open 2.2BB，你在 BTN 持 AQs，25BB。', potSize: 4.5, options: ['Fold', 'Call', '3-bet'], feedbacks: {
        '3-bet': { judgment: '正確', score: 10, bestAction: '3-bet', why: '25BB 深度 3-bet 到約 6BB，把翻後 SPR 壓到 2 以下：中到任何頂對都能無壓力套池，沒中也保留 fold equity。平跟反而製造一個不上不下的尷尬 SPR。', conceptualError: '無', remember: '中等籌碼的強牌用 3-bet 主動設計翻後 SPR，讓決策自動化。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 6, bestAction: '3-bet', why: '有位置平跟不算大錯，但放棄了搶死錢與簡化翻後的機會。', conceptualError: '被動路線。', remember: '25BB 的 AQs 更喜歡主動權。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 2, bestAction: '3-bet', why: 'AQs 對抗 CO open 範圍是明顯領先的強牌。', conceptualError: '過度保守。', remember: '位置與牌力都在你這邊時不要退縮。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '42', title: '兩頭順加同花聽低 SPR 全下', category: ['SPR', '聽牌打法'], difficulty: '中階', type: 'Tournament', blinds: '800/1600', ante: true, tourneyInfo: '中後期', userStack: '32000', userBB: 20, position: 'BB', holeCards: [S('9'), S('8')], preAction: 'BTN Open 2.2BB，你 Call', effectiveStack: '20BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [S('7'), S('6'), D('K')], spr: 3, description: '底池 6BB。Flop (7♠ 6♠ K♦) 你有兩頭順加同花聽牌。你過牌，BTN C-bet 2.5BB。你剩約 17.8BB。', potSize: 8.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '約 15 張 outs，對抗頂對也接近五五開；check-raise 全下疊加對手的棄牌率，是短碼組合聽牌最強的打法。', conceptualError: '無', remember: 'SPR 3 左右的巨型聽牌，用全下把兩種贏法(棄牌+中牌)都拿到手。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 6, bestAction: 'All-in', why: '有賠率跟注，但沒中的轉牌會讓殘碼與底池的關係越來越難打。', conceptualError: '放棄 fold equity。', remember: '短碼聽牌的價值一半來自對手會棄牌。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '棄掉一手對抗頂對都幾乎不輸的牌。', conceptualError: '完全誤讀勝率。', remember: '15 outs 的聽牌是攻擊武器不是負擔。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '43', title: 'SPR 1 頂對自動套池', category: ['SPR'], difficulty: '新手', type: 'Tournament', blinds: '1000/2000', ante: true, tourneyInfo: '後期', userStack: '24000', userBB: 12, position: 'BB', holeCards: [H('K'), H('7')], preAction: 'BTN Min-open 2BB，SB 棄牌，你 Call', effectiveStack: '12BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [C_('K'), D('9'), H('5')], spr: 1.8, description: '底池 5.5BB。Flop (K♣ 9♦ 5♥) 你中頂對。你過牌，BTN 下注 3BB。你剩 10BB (SPR < 2)。', potSize: 8.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: 'SPR 不到 2，頂對就是你的全部身家牌。check-raise 全下保護勝率，不讓對手的兩張高牌或聽牌便宜追。', conceptualError: '無', remember: 'SPR 低於 2：頂對以上 = 自動套池，沒有猶豫空間。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 5, bestAction: 'All-in', why: '反正轉牌也是全下，晚推不如早推，早推還能收掉他的浮牌勝率。', conceptualError: '拖延已注定的決策。', remember: '碼淺時把錢先推進去的人拿走棄牌率。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: 'SPR 這麼低的頂對是堅果級牌力，棄牌是災難。', conceptualError: '用深籌碼的恐懼打淺籌碼的牌。', remember: '碼越淺，一對的價值越高。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '44', title: '兩頭順轉牌賠率不足', category: ['聽牌打法'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BB', holeCards: [C_('J'), C_('T')], preAction: 'CO Open 3BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [D('Q'), S('9'), H('3'), C_('2')], potOdds: '33%', description: 'Flop 你過牌跟注 3BB。Turn 2♣，你過牌，CO 下注 12.5BB (整池)。底池 12.5BB。', potSize: 12.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '面對整池下注需要約 33% 勝率，兩頭順只有約 17%；中牌後順子牌面明顯，對手會踩剎車，隱含賠率補不回缺口。', conceptualError: '無', remember: '聽牌不是免死金牌——賠率不夠就是棄牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '偏鬆', score: 4, bestAction: 'Fold', why: '每一次賠率不足的跟注都是慢性漏錢，這正是多數玩家聽牌虧損的來源。', conceptualError: '為了聽而聽。', remember: '先算需要的勝率，再看自己的 outs。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '對手 Turn 打整池的範圍很強，半詐唬選錯了時機與對象。', conceptualError: '對強範圍施壓。', remember: '半詐唬要挑會棄牌的對手與時機。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '45', title: '卡順加超牌翻牌半詐唬', category: ['聽牌打法'], difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'BTN', holeCards: [H('K'), H('Q')], preAction: 'MP Open 3BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [S('T'), D('9'), H('4')], description: '底池 7.5BB。Flop (T♠ 9♦ 4♥)，MP C-bet 4BB。你有卡順加兩張超牌。', potSize: 11.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Raise': { judgment: '正確', score: 10, bestAction: 'Raise', why: '4 張 J 的卡順、6 張可能反超的超牌，加上後門紅心——加注拿回主動權，對手的 AK/AQ 高牌與 55-88 都很難繼續。', conceptualError: '無', remember: '有牌力後備的加注才叫半詐唬，這手牌是教科書等級的材料。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 7, bestAction: 'Raise', why: '有位置跟注看轉牌也合理，但放掉了讓對手直接棄牌的那份 EV。', conceptualError: '無', remember: '偶爾把這類牌加進加注範圍，你的詐唬才有平衡。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 3, bestAction: 'Raise', why: '10 張左右的有效 outs 加位置優勢，棄牌太浪費。', conceptualError: '只看見「沒中」。', remember: '沒成的牌也有勝率與 fold equity 兩種資產。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '46', title: '弱同花聽牌多人動作棄牌', category: ['同花聽牌', '多人底池'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'BB', holeCards: [H('6'), H('4')], preAction: 'UTG Open 3BB，MP Call，BTN Call，你 BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [H('Q'), H('9'), S('2')], description: '四人底池 12.5BB。Flop (Q♥ 9♥ 2♠) 你有 6 高同花聽牌。你過牌，UTG 下注 8BB，MP 加注到 24BB，BTN 棄牌，輪到你。', potSize: 44.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '低同花聽牌在下注加加注面前是災難：常被更大的同花聽牌壓制，就算中了 6 高同花也可能輸給更大的花。賠率與反向隱含賠率都不允許繼續。', conceptualError: '無', remember: '小花聽小心：多人底池的低同花聽牌中了也可能是第二名。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '夾在下注者與加注者之間追一個非堅果聽牌，是資金上最貴的位置。', conceptualError: '追聽不看質量。', remember: '同花聽牌的價值取決於花的大小。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '對兩個展現強度的對手用 6 高聽牌全下，沒有任何一種數學能救回來。', conceptualError: '絕望式攻擊。', remember: '半詐唬需要 fold equity，這裡沒有。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '47', title: '堅果同花聽加對子短碼全下', category: ['同花聽牌', '聽牌打法', '短碼策略'], difficulty: '中階', type: 'Tournament', blinds: '800/1600', ante: true, tourneyInfo: '中後期', userStack: '28800', userBB: 18, position: 'BB', holeCards: [H('A'), H('4')], preAction: 'CO Open 2.2BB，你 Call', effectiveStack: '18BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [H('8'), D('4'), H('Q')], spr: 2.6, description: '底池 6BB。Flop (8♥ 4♦ Q♥) 你有堅果同花聽牌加底對。你過牌，CO C-bet 3BB。', potSize: 9, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '堅果同花聽牌加一對，對抗對手的跟注範圍也接近五成勝率，疊加棄牌率後是明確 +EV——短碼最標準的 semi-bluff 全下。', conceptualError: '無', remember: '堅果聽牌 + 一對 + 短碼 = 推，這個公式很少出錯。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 5, bestAction: 'All-in', why: '跟注不算大錯，但轉牌沒中會陷入殘碼尷尬的處境。', conceptualError: '放棄主動權。', remember: '短碼的聽牌要用攻擊的方式玩。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '棄掉一手勝率接近五成的牌。', conceptualError: '完全誤讀牌力。', remember: '堅果聽牌加對子是短碼的堅果級組合。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '48', title: 'A9s 8BB UTG 全下', category: ['短碼策略', '錦標賽', 'Preflop'], difficulty: '新手', type: 'Tournament', blinds: '1500/3000', ante: true, tourneyInfo: '後期', userStack: '24000', userBB: 8, position: 'UTG', holeCards: [S('A'), S('9')], preAction: '你在 UTG，8BB', effectiveStack: '8BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '你在 UTG 持 A9s，只剩 8BB。', potSize: 2.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '8BB 的 UTG push 範圍雖然緊，A9s 穩穩在內：A 的 blocker、不錯的攤牌價值、加上急迫的盲注壓力。', conceptualError: '無', remember: '10BB 以下沒有 open raise，只有 Push 或 Fold。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'All-in', why: '再蓋幾手盲注就吃光你了，A9s 已經是 8BB 下的好牌。', conceptualError: '等待永遠不會來的完美牌。', remember: '短碼的耐心是負資產。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: 'Limp 給後面的人免費壓榨你的機會，翻後沒中又只能放棄。', conceptualError: '短碼被動入池。', remember: '8BB limp 是最糟的世界。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '49', title: 'ATo 面對 CO 短碼全下的隔離', category: ['短碼策略', '錦標賽'], difficulty: '中階', type: 'Tournament', blinds: '1000/2000', ante: true, tourneyInfo: '中後期', userStack: '50000', userBB: 25, position: 'BTN', holeCards: [D('A'), S('T')], preAction: 'CO (9BB) All-in，身後 SB/BB 各約 20BB', effectiveStack: '9BB (對 CO)',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'CO 9BB 全下，你在 BTN 持 ATo，身後還有兩個 20BB 的盲注。底池 11.5BB。', potSize: 11.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '再全下隔離：把 SB/BB 的中小對、A9、KQ 這類會分走勝率的牌全部擠出去，單挑 CO 的寬 shove 範圍時 ATo 明顯領先。', conceptualError: '無', remember: '想跟短碼的全下時，先想「我要不要順便把後面的人趕走」。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 6, bestAction: 'All-in', why: '平跟給了盲注絕佳的賠率入池，多人攤牌會稀釋 ATo 的勝率。', conceptualError: '沒有保護自己的勝率。', remember: '平跟短碼全下常是邀請別人來分你的池。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 3, bestAction: 'All-in', why: '9BB 的 CO shove 範圍很寬 (小對、Ax、Kx 大、連張)，ATo 對抗它有明顯優勢。', conceptualError: '高估短碼全下的力量。', remember: '碼越短，shove 範圍越寬，你的跟注範圍也要跟著放寬。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '50', title: 'K7o 盲注戰 12BB 全下', category: ['短碼策略', '錦標賽'], difficulty: '中階', type: 'Tournament', blinds: '1200/2400', ante: true, tourneyInfo: '後期', userStack: '28800', userBB: 12, position: 'SB', holeCards: [D('K'), C_('7')], preAction: '全部棄牌到你，BB 碼量與你相當', effectiveStack: '12BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '盲注戰。你在 SB 持 K7o，12BB。', potSize: 2.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '盲注戰 12BB 的 K7o 在 Nash 全下表內綽綽有餘：K 高的攤牌價值加上大量的棄牌率，長期明確 +EV。', conceptualError: '無', remember: '盲注戰的推牌範圍比多數人直覺寬得多——照表推，不要憑感覺。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'All-in', why: '把明確 +EV 的全下讓給了 BB 白吃你的盲注與前注。', conceptualError: '盲注戰打得太緊。', remember: '每一圈盲注都在漲，錯過的 +EV 推不會回來。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'All-in', why: 'Limp 後翻牌沒中只能放棄，白白浪費了全下自帶的 fold equity。', conceptualError: '短碼玩小球。', remember: '12BB 的 SB 幾乎沒有 limp 的位置。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '51', title: 'Q9s BB 面對 SB 短碼全下', category: ['短碼策略', '錦標賽'], difficulty: '新手', type: 'Tournament', blinds: '1000/2000', ante: true, tourneyInfo: '後期', userStack: '40000', userBB: 20, position: 'BB', holeCards: [S('Q'), S('9')], preAction: 'SB (8BB) All-in', effectiveStack: '8BB (對 SB)',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], potOdds: '41%', description: 'SB 8BB 全下，你在 BB 持 Q9s。你需要再補 7BB 去贏總池約 17BB。', potSize: 10, options: ['Fold', 'Call'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: 'SB 對 BB 的 8BB shove 範圍極寬 (任意 A、任意對子、大量 Kx/Qx/連張)，Q9s 對抗這個範圍約有 45% 勝率，而賠率只要求約 41%。', conceptualError: '無', remember: '面對超寬的 shove 範圍，防守靠的是數學不是牌面好看。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '放棄了賠率上明確有利的跟注，長期被 SB 的激進推推推剝削。', conceptualError: '賠率計算缺失。', remember: '被推時先算需要的勝率，再決定牌夠不夠。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '52', title: '99 決賽桌獎金跳升棄牌', category: ['ICM 壓力', '錦標賽'], difficulty: '進階', type: 'Tournament', blinds: '5000/10000', ante: true, tourneyInfo: '決賽桌剩 4 人，獎金跳升巨大，場上還有一位 6BB 超短碼', userStack: '200000', userBB: 20, position: 'BB', holeCards: [S('9'), H('9')], preAction: 'BTN (大籌碼，蓋過你) All-in，SB 棄牌', effectiveStack: '20BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '大籌碼 BTN 全下蓋住你的 20BB。場上另有一位只剩 6BB 的玩家。', potSize: 22.5, options: ['Fold', 'Call'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '純籌碼 EV 也許是小賺的跟注，但 ICM 下你只要熬過那位 6BB 的短碼就鎖住一級獎金。用整個賽事生命去搏接近擲硬幣的局面，金錢期望是負的。', conceptualError: '無', remember: '決賽桌的問題不是「這手牌贏不贏」，而是「這個風險值多少真錢」。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '大籌碼正是仗著你不能跟才推得這麼寬——但反制他的方式是等短碼出局，不是用 99 對抗蓋住你的範圍。', conceptualError: '用 cEV 思維打 $EV 局面。', remember: '籌碼期望和金錢期望是兩回事，決賽桌只看後者。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '53', title: '衛星賽泡沫 AKs 也要蓋', category: ['ICM 壓力', '錦標賽'], difficulty: '進階', type: 'Tournament', blinds: '3000/6000', ante: true, tourneyInfo: '衛星賽：12 人剩 11 個名額，你 25BB 排名中上', userStack: '150000', userBB: 25, position: 'BB', holeCards: [S('A'), S('K')], preAction: 'UTG (蓋過你) All-in，其餘棄牌', effectiveStack: '25BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '衛星賽泡沫。UTG 全下蓋住你，你持 AKs。棄牌後你幾乎篤定拿到門票。', potSize: 26.5, options: ['Fold', 'Call'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '衛星賽只分「有票」和「沒票」，名次毫無差別。你棄牌後晉級機率極高——AKs 頂多六成多勝率，拿整張門票去換零額外報酬的賭局，永遠不划算。', conceptualError: '無', remember: '衛星賽泡沫的正解常是：連 AK 都蓋，甚至 AA 都可以蓋。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '就算 65% 贏也意味著 35% 從「篤定晉級」變成回家，而贏了也不會多拿一毛錢。', conceptualError: '不理解衛星賽的支付結構。', remember: '先看支付結構再看牌——衛星賽是 ICM 的極端教室。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '54', title: '泡沫期籌碼王的壓迫開局', category: ['ICM 壓力', '錦標賽', 'Preflop'], difficulty: '中階', type: 'Tournament', blinds: '2000/4000', ante: true, tourneyInfo: '泡沫期，你是全場籌碼王 (80BB)，盲注位皆為 15-20BB 的中等籌碼', userStack: '320000', userBB: 80, position: 'BTN', holeCards: [S('7'), S('6')], preAction: '前位皆棄牌', effectiveStack: '80BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '泡沫期，你在 BTN 持 76s，盲注位是兩個被 ICM 鎖死的中等籌碼。', potSize: 2.5, options: ['Fold', 'Raise', 'All-in'], feedbacks: {
        'Raise': { judgment: '正確', score: 10, bestAction: 'Raise', why: '中等籌碼在泡沫期被 ICM 鎖死，防守範圍被迫縮到極窄；籌碼王此時的每一次 open 都在印鈔，76s 綽綽有餘。', conceptualError: '無', remember: 'ICM 壓力是雙面刃：壓著別人時，你就是收租的那方。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'Raise', why: '放棄了泡沫期最大的結構性優勢——這是整場錦標賽最好搶的盲注。', conceptualError: '大籌碼打得像中等籌碼。', remember: '泡沫期籌碼王不攻擊，等於自願放棄王座的權力。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 2, bestAction: 'Raise', why: '殺雞用牛刀。2.2BB 就能達成同樣的壓迫，不需要冒被 AA 逮住 80BB 的風險。', conceptualError: '壓迫過度。', remember: '壓迫的藝術在於用最小的風險製造最大的壓力。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '55', title: '第二對面對轉牌小注試探', category: ['控池', '邊緣牌'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'CO', holeCards: [S('A'), S('9')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [D('K'), H('9'), C_('4'), S('2')], description: 'Flop (K-9-4) 雙方過牌。Turn 2♠，BB 突然領打 3BB。底池 9.5BB。你有第二對 + A 高。', potSize: 9.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '小注面前你的第二對加 A 高踢腳對抗試探性下注仍常常領先，賠率又極好。跟注控池，河牌再評估。', conceptualError: '無', remember: '面對小注，中等牌力的正解多半是「便宜地跟、不膨脹底池」。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 3, bestAction: 'Call', why: '對這種試探性小注全蓋，你會被任何觀察力正常的對手用小注剝削到死。', conceptualError: '對小注過度尊重。', remember: '下注尺寸透露資訊：小注常常只是試探。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '加注把自己的中等牌力變成詐唬：更好的牌不走，更差的牌全跑。', conceptualError: '中等牌力主動膨脹底池。', remember: '第二對加注贏不到任何額外的東西。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '56', title: '多人底池頂對弱踢控池', category: ['控池', '邊緣牌', '多人底池'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'BTN', holeCards: [H('K'), H('8')], preAction: 'UTG Open 3BB，MP 與 SB Call，你 BTN Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [S('K'), D('7'), C_('3')], description: '四人底池 13BB。Flop (K♠ 7♦ 3♣) 你中頂對但踢腳只有 8。前面全部過牌，輪到你。', potSize: 13, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '四人底池有人持更好 Kx 的機率大增；頂對弱踢下注的結局多半是「更好的牌跟注、更差的牌棄牌」。過牌控池，後面便宜攤牌。', conceptualError: '無', remember: '人越多，你需要的牌力越強——頂對弱踢在多人池只是攤牌牌。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '可接受', score: 6, bestAction: 'Check', why: '小注拿一點保護與資訊不算大錯，但被加注時你只能痛苦棄牌。', conceptualError: '無', remember: '多人池下注前先想好被加注怎麼辦。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 2, bestAction: 'Check', why: '對三個對手打大注，等於宣告只想跟更強的牌單挑。', conceptualError: '弱踢頂對重注。', remember: '多人池的重注要用真正的強牌來打。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '57', title: '河牌阻擋性下注', category: ['控池', '邊緣牌'], difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'BB', holeCards: [S('T'), S('9')], preAction: 'BTN Open 2.5BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [D('9'), C_('6'), H('2'), S('K'), D('3')], description: 'Flop 你過牌跟注 2BB。Turn K♠ 雙方過牌。River 3♦，輪到你先行動。底池 9.5BB，你持第二對。', potSize: 9.5, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Bet small': { judgment: '正確', score: 10, bestAction: 'Bet small', why: '經典阻擋性下注 (Blocking bet)：OOP 用約四分之一池自己定價攤牌，避免過牌後面對 7BB 的大注陷入兩難。有攤牌價值但撐不起大注的牌最適合這招。', conceptualError: '無', remember: 'OOP 的中等牌用小注買一個便宜的攤牌。', nextStepId: 'next_hand' },
        'Check': { judgment: '可接受', score: 6, bestAction: 'Bet small', why: '也可以，但要做好面對大注時艱難抓雞的心理準備。', conceptualError: '無', remember: '過牌就要想好對手下注時的應對。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 1, bestAction: 'Bet small', why: '大注把自己的牌變成詐唬：只有壓制你的牌會跟注。', conceptualError: '尺寸與牌力錯配。', remember: '下注尺寸要服務目的，攤牌價值牌不打大注。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '58', title: '頂對抓雞：聽牌全落空', category: ['抓雞/Bluff Catch'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [D('A'), D('T')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [S('T'), S('8'), H('4'), D('2'), C_('2')], potOdds: '33%', description: 'Flop 你 C-bet 3BB 被跟。Turn (2♦) 雙方過牌。River 2♣，BB 突然下注 12.5BB (整池)。底池 12.5BB。', potSize: 12.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: 'BB 的 check-call 範圍塞滿了落空的黑桃同花與 97/J9 順子聽牌；你轉牌放了一街後，河牌的突然重砲正是這些空氣的最後出口。頂對頂踢是完美的抓雞牌。', conceptualError: '無', remember: '抓雞前問一句：他的範圍裡有沒有足夠多「輸了才會這樣打」的牌？', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'Call', why: '這個牌面落空的聽牌太多，河牌全蓋會被系統性剝削。', conceptualError: '只看見對方可能的強牌。', remember: '牌面越多落空聽牌，你的抓雞頻率就要越高。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 0, bestAction: 'Call', why: '加注只會趕走所有詐唬、留下所有壓制你的牌。', conceptualError: '抓雞牌加注。', remember: '抓雞牌的動作只有跟注或棄牌。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '59', title: '翻牌四條極致慢打', category: ['慢打/Slow Play', '強牌價值'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'BB', holeCards: [S('7'), H('7')], preAction: 'CO Open 3BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('7'), C_('7'), S('Q')], description: '底池 6.5BB。Flop (7♦ 7♣ Q♠) 你中四條！你過牌，CO C-bet 3BB。', potSize: 9.5, options: ['Call', 'Raise', 'All-in'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '你鎖死了整個牌面，對手連一對都很難有。加注只會嚇跑他的空氣——讓他繼續開槍，或讓轉牌給他接上一點什麼。', conceptualError: '無', remember: '慢打的唯一正當理由：你強到對手沒有任何牌能付錢，而牌面安全到不怕免費牌。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '對手的 C-bet 範圍大半是空氣，加注等於告訴他快逃。', conceptualError: '把對手僅剩的詐唬嚇跑。', remember: '牌面被你鎖死時，讓對手保有「他還領先」的錯覺。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 0, bestAction: 'Call', why: '全世界只有比四條更小的牌會棄牌。', conceptualError: '價值牌打成驅逐令。', remember: '越強的牌越要溫柔。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '60', title: '河牌成葫蘆反加收割', category: ['強牌價值', 'Value Bet'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [S('5'), D('5')], preAction: 'MP Open 3BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [C_('Q'), H('5'), D('8'), S('2'), H('Q')], description: 'Flop 你中 set 跟注 4BB，Turn 跟注 10BB。River Q♥ 讓你成葫蘆，MP 第三槍下注 25BB。底池 60.5BB。', potSize: 60.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Raise': { judgment: '正確', score: 10, bestAction: 'Raise', why: '河牌的 Q 讓你的 55 升級成葫蘆，壓制對手所有的 Qx 三條——而他的 Qx 面對加注幾乎不可能棄牌。這是整手牌最後一次收價值的機會。', conceptualError: '無', remember: '河牌反超成巨獸時，對手的價值下注就是你加注的請帖。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 6, bestAction: 'Raise', why: '太保守。對手三條街下注代表他有真牌，正是他付得起加注的時候。', conceptualError: '巨獸牌只跟不加。', remember: '對手有牌的時候才加得到價值。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'Raise', why: '你拿著葫蘆棄牌。', conceptualError: '牌力誤讀。', remember: '先看清自己的牌再做決定。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '61', title: 'A5s 大盲擠壓', category: ['3-Bet/4-Bet', 'Preflop', 'Blocker'], difficulty: '進階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BB', holeCards: [S('A'), S('5')], preAction: 'CO Open 3BB，BTN Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'CO Open 3BB，BTN 平跟，你在 BB 持 A5s。底池 7.5BB。', potSize: 7.5, options: ['Fold', 'Call', '3-bet'], feedbacks: {
        '3-bet': { judgment: '正確', score: 10, bestAction: '3-bet', why: '教科書擠壓 (Squeeze)：open 加平跟都示弱，場上一堆死錢；你的 A blocker 壓縮對手持 AA/AK 的組合，被跟注了還有同花與順子的翻後潛力。', conceptualError: '無', remember: 'A5s 這類「blocker + 潛力」的牌是擠壓的第一梯隊材料。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 6, bestAction: '3-bet', why: '賠率不錯，但 OOP 的 A5s 多人底池常淪為反向隱含賠率的受害者(小 A 中頂對付大錢)。', conceptualError: '被動入池。', remember: '擠壓拿死錢常比翻後周旋更有利。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 3, bestAction: '3-bet', why: '收池賠率極好的位置直接放棄，太緊了。', conceptualError: '無視死錢。', remember: 'BB 面對 open+call 是擠壓的黃金位置。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '62', title: 'TT 有位置防守 3-bet', category: ['3-Bet/4-Bet', 'Preflop'], difficulty: '中階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'BTN', holeCards: [S('T'), D('T')], preAction: '你 Open 2.5BB，SB 3-bet 11BB，BB 棄牌', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'SB 3-bet 到 11BB，你在 BTN 持 TT。底池 14.5BB。', potSize: 14.5, options: ['Fold', 'Call', '4-bet (Raise)'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: 'TT 對抗 SB 的 3-bet 範圍太強不能蓋，但 4-bet 又只會被 QQ+/AK 繼續。有位置平跟，讓對手 OOP 打一個範圍劣勢的大底池。', conceptualError: '無', remember: '中等口袋對面對 3-bet 的標準答案：有位置就跟注，讓位置去掙錢。', nextStepId: 'next_hand' },
        '4-bet (Raise)': { judgment: '可接受', score: 5, bestAction: 'Call', why: '把自己推進「不是硬幣就是被壓制」的困境，放棄了位置帶來的所有彈性。', conceptualError: '把牌打成非黑即白。', remember: '4-bet 前想清楚被跟注後你面對什麼範圍。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 2, bestAction: 'Call', why: 'TT 對抗 SB 3-bet 範圍的勝率遠超過棄牌線。', conceptualError: '對 3-bet 過度尊重。', remember: '有位置的中對是防守 3-bet 的主力。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '63', title: 'A5s 4-bet 詐唬', category: ['3-Bet/4-Bet', 'Blocker', 'Preflop'], difficulty: '進階', type: 'Cash Game', blinds: '5/10', ante: false, userStack: '1000', userBB: 100, position: 'CO', holeCards: [H('A'), H('5')], preAction: '你 Open 2.5BB，BTN 3-bet 8BB', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'BTN 3-bet 到 8BB，你在 CO 持 A5s。底池 12BB。', potSize: 12, options: ['Fold', 'Call', '4-bet (Raise)'], feedbacks: {
        '4-bet (Raise)': { judgment: '正確', score: 10, bestAction: '4-bet (Raise)', why: '最標準的 4-bet 詐唬牌：A blocker 讓對手持 AA/AK 的組合直接減半，被 5-bet 可以無痛棄牌，被跟注了還有同花與順子的翻後潛力。', conceptualError: '無', remember: '4-bet 詐唬選牌看兩件事：blocker 和被跟注後的可玩性，A5s 兩者兼備。', nextStepId: 'next_hand' },
        'Fold': { judgment: '可接受', score: 6, bestAction: '4-bet (Raise)', why: '棄牌不虧，但如果你的 4-bet 範圍只剩 QQ+/AK，觀察力好的對手會把你 3-bet 到懷疑人生。', conceptualError: '範圍過於誠實。', remember: '沒有詐唬的 4-bet 範圍等於明牌打牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 3, bestAction: '4-bet (Raise)', why: 'A5s 平跟 3-bet 後 OOP，翻後既難中牌也難打出價值。', conceptualError: '用錯誤的方式不棄牌。', remember: '這手牌的價值在詐唬潛力，不在攤牌力。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '64', title: 'ATo UTG 開局紀律', category: ['Preflop'], difficulty: '新手', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'UTG', holeCards: [C_('A'), H('T')], preAction: '9 人桌，你在 UTG 首位行動', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '9 人桌 UTG，你持 ATo。', potSize: 1.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '身後還有八個人。ATo 這種容易被壓制的牌在 UTG 進池，遇到反抗時你面對的是 AJ/AQ/AK——中了頂對也常是付錢的那方。', conceptualError: '無', remember: '位置越前，範圍越緊：ATo 是 UTG 紀律的試金石。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 3, bestAction: 'Fold', why: '典型的「贏小輸大」：沒人反抗時贏個盲注，有人反抗時你已經落後。', conceptualError: '前位範圍過寬。', remember: '好牌不等於在所有位置都能玩的牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: 'Limp 是最糟選項：不搶池、不施壓、還把弱點寫在臉上。', conceptualError: '被動入池。', remember: '要嘛加注要嘛棄牌，limp 不在選單上。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '65', title: '99 set 慢打一街後轉攻', category: ['慢打/Slow Play', '強牌價值', 'Value Bet'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'MP', holeCards: [S('9'), D('9')], preAction: '你 Open 3BB，BTN Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [H('9'), C_('4'), D('2'), S('J')], description: 'Flop (9♥ 4♣ 2♦) 你中頂 set 選擇過牌設陷阱，BTN 也過牌。Turn 掉 J♠。底池 7.5BB，你先行動。', potSize: 7.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: '慢打是有期限的：你已經送出一條免費街，J 又給了對手能跟注的頂對。現在不開始造池，這手 set 最後只會贏一個迷你池。', conceptualError: '無', remember: '慢打最多一條街——之後必須轉入價值模式追回進度。', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 7, bestAction: 'Bet big', why: '開始下注正確，但你已經落後一條街的建池進度，尺寸應該更大。', conceptualError: '造池進度落後。', remember: '慢打過的牌要用更大的尺寸補回底池。', nextStepId: 'next_hand' },
        'Check': { judgment: '錯誤', score: 2, bestAction: 'Bet big', why: '慢打兩條街等於讓對手免費追牌，還把底池小到河牌收不了價值。', conceptualError: '陷阱設過頭。', remember: '過牌兩次的 set 常常只贏一個沒人要的池。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '66', title: 'AA 有位置平跟瘋子 3-bet', category: ['慢打/Slow Play', '3-Bet/4-Bet', 'Preflop'], villainProfile: 'Maniac (超激進瘋子)', difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'BTN', holeCards: [S('A'), H('A')], preAction: '你 Open 2.5BB，SB (瘋子) 3-bet 11BB', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'SB 是逢人就 3-bet、翻後三條街開火的瘋子。他 3-bet 到 11BB，你在 BTN 持 AA。', potSize: 14.5, options: ['Fold', 'Call', '4-bet (Raise)'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '對這種對手，他翻後的連續開火就是你最大的收入來源。有位置平跟把他的整個詐唬範圍留在池子裡，讓他替你打光他自己。', conceptualError: '無', remember: '慢打的前提是對手會替你下注——瘋子正是最佳人選。', nextStepId: 'next_hand' },
        '4-bet (Raise)': { judgment: '可接受', score: 7, bestAction: 'Call', why: '標準打法，瘋子也可能跟注或 5-bet。但他的大量空氣牌會就此棄牌，你少賺了他翻後的三條街砲火。', conceptualError: '無', remember: '對會自己送錢的對手，別急著把價格標出來。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'Call', why: '用 AA 對 3-bet 棄牌。', conceptualError: '不需要解釋的錯誤。', remember: 'AA 永遠不在棄牌名單上（翻牌前）。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '67', title: '堅果順讓他開完第三槍', category: ['慢打/Slow Play', '強牌價值'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BB', holeCards: [S('6'), S('5')], preAction: 'BTN Open 2.5BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [D('7'), C_('4'), H('3'), S('K'), D('2')], description: 'Flop (7-4-3) 你中堅果順，過牌跟注 3BB。Turn (K♠) 過牌跟注 7BB。River 2♦，底池 25.5BB，你先行動。對手火力全開。', potSize: 25.5, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '他已經連開兩槍，把河牌讓給他打完——你的過牌加注能收到他第三槍的全部；自己主動下注反而會嚇醒他的空氣牌。', conceptualError: '無', remember: '對手在替你下注時，你唯一的工作是不要打斷他。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '可接受', score: 6, bestAction: 'Check', why: '能從他的 Kx 收到一次跟注，但他所有的詐唬牌會就地棄牌。', conceptualError: '搶了對手的台詞。', remember: '面對連續開火的對手，讓他自己走進陷阱。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '錯誤', score: 3, bestAction: 'Check', why: '小注既收不到大價值，也誘不出詐唬，還提醒他你有牌。', conceptualError: '尺寸沒有目的。', remember: '每個下注尺寸都要回答「我要誰跟注」。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '68', title: 'AA 中頂葫蘆鎖死牌面', category: ['慢打/Slow Play', '強牌價值'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'MP', holeCards: [H('A'), D('A')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [C_('A'), S('6'), D('6')], description: '底池 6.5BB。Flop (A♣ 6♠ 6♦) 你中頂葫蘆。BB 過牌。', potSize: 6.5, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '你把牌面鎖到對手幾乎沒有任何能跟注的牌（A 和 6 都在你和牌面上）。過牌讓他轉牌接上一點什麼，或起詐唬的念頭。', conceptualError: '無', remember: '慢打的標準面：牌面被你鎖死 + 對手範圍空到沒牌能跟。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '可接受', score: 7, bestAction: 'Check', why: '迷你注維持故事也可行，但這牌面他的棄牌率還是太高。', conceptualError: '無', remember: '下注前先問：他拿什麼跟我？', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 0, bestAction: 'Check', why: '把對手僅存的一點好奇心也趕跑了。', conceptualError: '對空範圍重砲。', remember: '越強的牌越要溫柔（尤其你鎖死牌面時）。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '69', title: 'A♠ 阻擋堅果同花的詐唬', category: ['Blocker'], difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'BTN', holeCards: [S('A'), D('K')], preAction: '你 Open 2.5BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [S('Q'), S('9'), S('3'), D('7'), H('2')], description: 'Flop (Q♠ 9♠ 3♠) 你 C-bet 2BB 被跟。Turn、River 雙方過牌到你。牌面三張黑桃，你持 A♠ 但沒有成花。底池 9.5BB，BB 過牌。', potSize: 9.5, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: '你手上的 A♠ 意味著對手不可能持有堅果同花，而他一路的被動也不像大花。大注講述的正是「我有同花」的故事，他的單對很難跟注。', conceptualError: '無', remember: '持有關鍵 blocker 時，你就是最有資格說這個謊的人。', nextStepId: 'next_hand' },
        'Check': { judgment: '可接受', score: 5, bestAction: 'Bet big', why: 'A 高偶爾能贏攤牌，但這是一個可以直接奪走的底池。', conceptualError: '放棄可信的詐唬機會。', remember: 'Blocker 詐唬的本錢是「他不可能有你代表的牌」。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '錯誤', score: 3, bestAction: 'Bet big', why: '半吊子尺寸講不了同花的故事，反而會被隨便一對跟注。', conceptualError: '故事與尺寸不匹配。', remember: '要說謊就說完整——詐唬尺寸要符合你代表的牌力。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '70', title: 'A♥ 在手擋住他的詐唬', category: ['Blocker', '抓雞/Bluff Catch'], difficulty: '進階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [H('A'), D('K')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [H('K'), H('7'), S('2'), D('8'), C_('3')], description: 'Flop (K♥ 7♥ 2♠) 你 C-bet 3BB 被跟，Turn (8♦) 你下注 8BB 被跟。River 3♣ 紅心落空，BB 突然全下 35BB。底池 28.5BB。你持頂對頂踢，且拿著 A♥。', potSize: 28.5, options: ['Fold', 'Call'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '他詐唬的主力是落空的紅心聽牌，但你手上的 A♥ 恰好砍掉其中最大宗的 A♥X♥ 組合。剩下的全下範圍偏向 78、33、慢打的兩對。同一手牌若你拿的是 A♣K♦，跟注反而正確。', conceptualError: '無', remember: '抓雞前檢查：你的牌是擋住他的「詐唬」還是他的「價值」——擋詐唬就蓋，擋價值就跟。', nextStepId: 'next_hand' },
        'Call': { judgment: '偏鬆', score: 4, bestAction: 'Fold', why: '頂對頂踢看起來是標準抓雞牌，但組合學上你自己擋掉了他大半的空氣。', conceptualError: '忽視自己手牌對對手範圍的影響。', remember: '你的手牌不只是牌力，也是對手範圍的過濾器。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '71', title: 'TT 阻擋成順組合抓雞', category: ['Blocker', '抓雞/Bluff Catch'], difficulty: '進階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BB', holeCards: [D('T'), C_('T')], preAction: 'CO Open 3BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [C_('9'), D('8'), H('2'), S('7'), C_('2')], potOdds: '37%', description: 'Flop (9♣ 8♦ 2♥) 你過牌跟注 3BB，Turn (7♠) 過牌跟注 8BB。River 2♣，你過牌，CO 全下 40BB。底池 28.5BB。你的超對 TT 面對三條街火力。', potSize: 28.5, options: ['Fold', 'Call'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '他要代表的順子是 JT、T6、65——你的兩張 T 直接砍掉 JT 與 T6 的大半組合。加上這條線上無數談不攏的半詐唬，你的超對抓下他範圍裡過重的空氣。', conceptualError: '無', remember: '抓雞的組合學：拿著對手「成牌所需的牌」，他的故事就講不通。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'Fold', why: '牌面確實危險，但你的 blocker 讓他的成順組合大幅縮水，37% 的門檻是可以達到的。', conceptualError: '只看牌面不看組合。', remember: '危險牌面 + 你持關鍵 blocker = 對手最愛詐唬的地方。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '72', title: 'AA 別讓多人池發生', category: ['多人底池', 'Preflop', '3-Bet/4-Bet'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'BTN', holeCards: [D('A'), C_('A')], preAction: 'UTG Open 3BB，MP 與 CO Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: 'UTG Open，兩人平跟，你在 BTN 持 AA。底池 10.5BB。', potSize: 10.5, options: ['Call', '3-bet', 'All-in'], feedbacks: {
        '3-bet': { judgment: '正確', score: 10, bestAction: '3-bet', why: 'AA 單挑勝率 85%，四人池會掉到 55% 左右。大尺寸 3-bet（約 14BB）收割場上死錢，並把牌局擠回你最強的單挑戰場。', conceptualError: '無', remember: 'AA 的最大敵人不是某手牌，是人數——用 3-bet 控制人數。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: '3-bet', why: '平跟邀請盲注加入，AA 打五人池是自毀：翻牌後你幾乎永遠只有一對。', conceptualError: '慢打不看人數。', remember: '多人池裡沒有牌叫做「只是一對的 AA」更可憐的了。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 1, bestAction: '3-bet', why: '100BB 全下只有 KK/QQ 會跟，把 AA 的價值上限一刀砍掉。', conceptualError: '價值牌打成驅逐令。', remember: '3-bet 到能被較差的牌跟注的尺寸即可。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '73', title: 'JT 頂兩對濕面遭遇戰', category: ['多人底池', '強牌價值'], difficulty: '進階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'CO', holeCards: [H('J'), H('T')], preAction: '你 Open 3BB，BTN、SB、BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [S('J'), S('T'), D('6')], description: '四人底池 12BB。Flop (J♠ T♠ 6♦) 你中頂兩對，下注 8BB，BTN 加注到 24BB，SB 冷跟 24BB，BB 棄牌。輪到你，你還有 89BB。', potSize: 68, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '加注+冷跟的範圍裡塞滿了同花聽牌、兩頭順與組合聽牌。你的頂兩對現在領先，但幾乎每張轉牌都是災難——把錢在你還領先的這條街全部放進去。', conceptualError: '無', remember: '濕牌面的脆弱強牌：要嘛現在全下，要嘛永遠不知道自己死在哪張牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '偏鬆', score: 4, bestAction: 'All-in', why: '跟注讓三人看轉牌，任何黑桃、K、Q、9、8 都會讓你進退兩難。', conceptualError: '拖延注定的對決。', remember: '對抗聽牌大軍，時間站在他們那邊。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 1, bestAction: 'All-in', why: '頂兩對面對以聽牌為主的動作範圍棄牌，過度悲觀。', conceptualError: '把聽牌動作讀成成牌。', remember: '濕牌面的加注常常是聽牌在搶勝率。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '74', title: '多人池 AK 沒中收槍', category: ['多人底池', '常規戰術'], difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'CO', holeCards: [S('A'), H('K')], preAction: '你 Open 3BB，BTN、SB、BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('9'), D('8'), C_('6')], description: '四人底池 12BB。Flop (9♦ 8♦ 6♣) 完全沒中你。前面都過牌，輪到你。', potSize: 12, options: ['Check', 'Bet small', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '四個範圍疊在這種連張牌面上，總有人中了什麼。多人池的 C-bet 頻率要大砍，AK 高牌在這裡連一條街都撐不起。', conceptualError: '無', remember: '單挑可以用範圍開槍，多人池只能用牌開槍。', nextStepId: 'next_hand' },
        'Bet small': { judgment: '錯誤', score: 3, bestAction: 'Check', why: '對三個人的小注幾乎必被跟注或加注，你在用錢買一個壞消息。', conceptualError: '把單挑習慣帶進多人池。', remember: '多人池的 C-bet 要有牌面與牌力雙重支撐。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 0, bestAction: 'Check', why: '對著三個範圍的重砲詐唬，這牌面誰都不會走。', conceptualError: '無視人數的詐唬。', remember: '詐唬的第一條件：對手棄得掉。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '75', title: '家庭池順子聽牌純賠率', category: ['多人底池', '聽牌打法'], difficulty: '新手', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BB', holeCards: [C_('7'), C_('6')], preAction: 'UTG Open 2.5BB，MP、CO、BTN Call，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Flop', communityCards: [D('8'), H('5'), C_('K')], potOdds: '12%', description: '五人底池 13BB。Flop (8♦ 5♥ K♣) 你有兩頭順聽牌。你過牌，UTG 下注 3BB，MP 跟注，BTN 跟注。輪到你，只需再補 3BB。', potSize: 22, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '3BB 進 22BB 的池，只需 12% 勝率——你的兩頭順有 17% 直接命中率加上巨大的隱含賠率（中了順子有三個人付你錢）。', conceptualError: '無', remember: '多人池是聽牌的天堂：便宜的價格 + 成倍的隱含賠率。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '三個對手在場，fold equity 趨近於零，半詐唬失去了一半的意義。', conceptualError: '對人群半詐唬。', remember: '半詐唬要在有人會棄牌時才成立。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 1, bestAction: 'Call', why: '7 倍賠率的跟注送上門還丟掉。', conceptualError: '看不見賠率。', remember: '先算價格再做決定——這是送分題。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '76', title: 'A8o 讓一手等升級', category: ['ICM 壓力', '錦標賽', '短碼策略'], difficulty: '進階', type: 'Tournament', blinds: '5000/10000', ante: true, tourneyInfo: '決賽桌剩 5 人，桌上另有一位 3BB 即將被盲光的玩家，獎金跳升極大', userStack: '80000', userBB: 8, position: 'UTG', holeCards: [S('A'), D('8')], preAction: '輪到你首位行動', effectiveStack: '8BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '你 8BB 持 A8o 在 UTG。桌上有位 3BB 的玩家下一輪就會被盲注吃光。', potSize: 2.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '純籌碼 EV 這是推，但那位 3BB 玩家幾乎確定先出局——多熬一圈就升一級獎金。A8o 全下被跟注的風險，換不回這個近在眼前的 $EV 階梯。', conceptualError: '無', remember: 'ICM 的黃金法則：有人快出局時，你的推牌範圍要跟著他的倒數計時收緊。', nextStepId: 'next_hand' },
        'All-in': { judgment: '偏鬆', score: 4, bestAction: 'Fold', why: '平時 8BB 的 A8o 是標準推，但現在多等一手可能就是一級獎金的差距。', conceptualError: '用 cEV 表打 $EV 局。', remember: '推牌表是基準，ICM 是修正——決賽桌永遠先看後者。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '8BB limp 進池，翻後沒中只能棄，等於白丟一顆大盲。', conceptualError: '短碼被動入池。', remember: '8BB 的世界只有推或棄。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '77', title: '衛星賽短碼要反著打', category: ['ICM 壓力', '錦標賽', '短碼策略'], difficulty: '進階', type: 'Tournament', blinds: '4000/8000', ante: true, tourneyInfo: '衛星賽：12 人剩 11 個名額，但你只剩 4BB，盲注一圈就會吃光你', userStack: '32000', userBB: 4, position: 'CO', holeCards: [C_('A'), D('7')], preAction: '前位皆棄牌', effectiveStack: '4BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '衛星賽泡沫，但你是全場最短的 4BB。你在 CO 持 A7o。', potSize: 2.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '和籌碼安全時的衛星策略完全相反：你的 4BB 熬不到名額，盲注正在倒數。A7o 已是你等得到的最好牌之一，趁還有 fold equity 搶先全下翻倍。', conceptualError: '無', remember: '衛星賽兩張臉：碼夠的人連 AA 都能蓋，碼不夠的人拿 A 高就要衝。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 2, bestAction: 'All-in', why: '棄到死是這個籌碼量最確定的出局方式——你在替別人保住名額。', conceptualError: '把安全玩家的策略抄過來用。', remember: '先算自己能不能熬到名額，再決定要不要縮。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '4BB limp 沒有任何戰略意義。', conceptualError: '無計畫入池。', remember: '4BB 就是一顆全下按鈕。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '78', title: '泡沫期挑短碼打', category: ['ICM 壓力', '錦標賽', '短碼策略'], difficulty: '中階', type: 'Tournament', blinds: '2000/4000', ante: true, tourneyInfo: '泡沫期，盲注位分別剩 10BB 與 9BB，你 12BB', userStack: '48000', userBB: 12, position: 'BTN', holeCards: [D('A'), D('4')], preAction: '前位皆棄牌', effectiveStack: '12BB',
    steps: [
      { id: '1', street: 'Preflop', communityCards: [], description: '泡沫期，你在 BTN 持 A4s (12BB)，身後盲注位分別是 10BB 和 9BB。', potSize: 2.5, options: ['Fold', 'Raise', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '泡沫期打架要挑比你短的：他們每一次跟注都賭上整個賽事，你輸了卻還活著。ICM 把你的 fold equity 放大到平時的兩倍，A4s 綽綽有餘。', conceptualError: '無', remember: '泡沫期的籌碼階級：壓比你短的，躲比你長的。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 2, bestAction: 'All-in', why: '12BB 小加注等於給他們免費的 re-shove 機會，你反而變成被壓的那方。', conceptualError: '留了不該留的空間。', remember: '12BB 沒有 raise/fold 這個選項。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'All-in', why: '放掉了 ICM 加持下最有利可圖的全下位置。', conceptualError: '泡沫期只想守。', remember: '泡沫期不只是生存賽，也是收租季。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '79', title: '頂對面對河牌小注', category: ['抓雞/Bluff Catch', '控池'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'HJ', holeCards: [S('A'), D('J')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [H('J'), C_('8'), D('4'), S('Q'), H('3')], potOdds: '18%', description: 'Flop 你 C-bet 2BB 被跟。Turn (Q♠) 雙方過牌。River 3♥，BB 領打小注 3BB。底池 13.5BB。', potSize: 13.5, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '四分之一池的小注只需要 18% 勝率就打平。這種尺寸多半是薄價值或阻擋性下注，你的頂對 J 對抗它的範圍還有大把勝率。', conceptualError: '無', remember: '對小注棄牌要非常吝嗇——那是全桌最便宜的攤牌票。', nextStepId: 'next_hand' },
        'Raise': { judgment: '偏鬆', score: 4, bestAction: 'Call', why: '把他的弱價值變詐唬理論上存在，但他小注後願意跟大注的範圍不會比你的 Jx 差。', conceptualError: '不必要的複雜化。', remember: '有攤牌價值時，簡單的跟注常是最高 EV。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '對 18% 的價格棄掉頂對，會被任何會用小注試探的對手長期收割。', conceptualError: '對任何下注都給予同等尊重。', remember: '尊重要看尺寸——小注只值小尊重。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '80', title: '被動玩家河牌突然加注', category: ['抓雞/Bluff Catch'], villainProfile: 'Loose Passive (休閒跟注型)', difficulty: '新手', type: 'Cash Game', blinds: '1/3', ante: false, userStack: '300', userBB: 100, position: 'MP', holeCards: [S('K'), C_('K')], preAction: '你 Open 3BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [D('Q'), S('7'), H('4'), D('5'), C_('2')], description: 'Flop 你下注 3BB、Turn 下注 8BB 都被跟。River 2♣ 你下注 14BB，BB 突然加注全下 60BB。底池 42.5BB。', potSize: 42.5, options: ['Fold', 'Call'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '整手被動跟注的休閒玩家，河牌的突然加注不是詐唬——是 67、44、Q7 這些你想不到的兩對三條。KK 在這裡付錢純屬自願捐款。', conceptualError: '無', remember: '被動玩家的加注是全撲克最誠實的訊號，尤其在河牌。', nextStepId: 'next_hand' },
        'Call': { judgment: '錯誤', score: 2, bestAction: 'Fold', why: '「他怎麼可能有牌」是對休閒玩家最貴的誤解——他們跟三條街的理由你永遠猜不到。', conceptualError: '用常規範圍讀休閒玩家。', remember: '對休閒玩家：多下價值注，但他反擊時立刻相信他。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '81', title: '雙過牌後的河牌超額下注', category: ['抓雞/Bluff Catch'], difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'BB', holeCards: [S('9'), C_('9')], preAction: 'BTN Open 2.5BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [D('K'), S('7'), H('4'), C_('2'), H('6')], potOdds: '38%', description: 'Flop (K♦ 7♠ 4♥) 與 Turn (2♣) 雙方都過牌。River 6♥ 你過牌，BTN 突然超額下注 15BB。底池 9.5BB。', potSize: 9.5, options: ['Fold', 'Call'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '兩條街的過牌已經把他的範圍鎖在弱牌區——真正的 Kx 很少連過兩街。河牌突然的超額下注與他自己講的故事自相矛盾，這種線的詐唬濃度極高。', conceptualError: '無', remember: '抓雞看故事的連貫性：前後矛盾的大注，多半是空氣在虛張聲勢。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'Call', why: '38% 的門檻面對一條几乎不含價值牌的下注線，你的 99 綽綽有餘。', conceptualError: '被尺寸嚇到忘了讀範圍。', remember: '下注大小是嚇人用的，範圍組成才是真相。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '82', title: '同花聽牌面對全下的純數學', category: ['同花聽牌', '聽牌打法'], difficulty: '中階', type: 'Tournament', blinds: '600/1200', ante: true, tourneyInfo: '中期', userStack: '30000', userBB: 25, position: 'BB', holeCards: [H('K'), H('Q')], preAction: 'BTN Open 2.2BB，你 Call', effectiveStack: '15BB (對 BTN)',
    steps: [
      { id: '1', street: 'Flop', communityCards: [H('9'), H('6'), S('2')], potOdds: '42%', description: '底池 6BB。Flop (9♥ 6♥ 2♠) 你有 K 高同花聽牌加兩張超牌。BTN 直接全下 15BB。', potSize: 21, options: ['Fold', 'Call'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: '需要 42% 勝率：9 張同花 outs 約 35%，加上 K/Q 超牌對抗他的中小對全下範圍，實際勝率約 45%。看起來像英雄跟注，其實是純數學。', conceptualError: '無', remember: '面對全下沒有後續決策，只剩一道算術題——算完就照答案做。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 4, bestAction: 'Fold', why: '直覺上「沒成牌就蓋」，但這裡的組合勝率已經超過價格。', conceptualError: '把聽牌當空氣。', remember: '大聽牌對抗全下常常是領先或五五開，別憑感覺蓋。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '83', title: '非堅果同花對上岩石的加注', category: ['同花聽牌', '抓雞/Bluff Catch'], villainProfile: 'Tight Passive (岩石)', difficulty: '進階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [S('9'), S('8')], preAction: 'CO Open 3BB，你 Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [S('A'), S('6'), H('2'), S('Q')], description: 'Flop (A♠ 6♠ 2♥) CO C-bet 4BB 你跟注。Turn Q♠ 完成你的同花，CO 過牌，你下注 10BB，CO 突然 check-raise 到 32BB。底池 57.5BB。', potSize: 57.5, options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'Fold': { judgment: '正確', score: 10, bestAction: 'Fold', why: '岩石的 check-raise 就是堅果區：K♠J♠、J♠T♠ 的更大同花，或者準備在配對河牌反超的 set。你的 9 高花對他而言只是抓雞牌，而岩石不詐唬。', conceptualError: '無', remember: '同花分大小，對手分類型——非堅果花碰上岩石的加注，先想想誰會這樣打。', nextStepId: 'next_hand' },
        'Call': { judgment: '偏鬆', score: 4, bestAction: 'Fold', why: '跟注後河牌面對第二槍，你的處境只會更糟。', conceptualError: '捨不得成牌。', remember: '成牌不是終點，相對牌力才是。', nextStepId: 'next_hand' },
        'All-in': { judgment: '錯誤', score: 0, bestAction: 'Fold', why: '對岩石的加注全下 9 高花，只有更大的花會跟你。', conceptualError: '無視對手類型的自信。', remember: '對岩石升級對抗是資金自殺。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '84', title: '對手全落空:過牌勝過薄價值', category: ['Value Bet', '抓雞/Bluff Catch'], villainProfile: 'Aggressive Reg (會開槍的常客)', difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'MP', holeCards: [S('K'), C_('Q')], preAction: '你 Open 3BB，BTN Call', effectiveStack: '100BB',
    steps: [
      { id: '1', street: 'River', communityCards: [D('K'), D('9'), S('4'), C_('7'), H('2')], description: 'Flop (K♦ 9♦ 4♠) 你 C-bet 3BB 被跟，Turn (7♣) 下注 9BB 被跟。River 2♥ 方塊全落空。底池 31.5BB，你先行動。', potSize: 31.5, options: ['Check', 'Bet half pot', 'Bet big'], feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: '兩條街下注已把他的範圍過濾成大量方塊聽牌加少數 9x/Kx。落空的聽牌不會跟你第三槍，但只要你過牌，它們就可能變成詐唬——過牌-跟注的期望超過薄價值。', conceptualError: '無', remember: '河牌下注前先問：他跟得起的牌多，還是他會拿來詐唬的牌多？', nextStepId: 'next_hand' },
        'Bet half pot': { judgment: '可接受', score: 6, bestAction: 'Check', why: '能收到一點 9x 的跟注，但同時放走了他所有的落空詐唬——這是對這種對手的淨損失。', conceptualError: '對錯的對手做對的事。', remember: '同一手牌對跟注站下注、對會開槍的人過牌。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '錯誤', score: 2, bestAction: 'Check', why: '大注只會被壓制你的牌跟注，把自己變成半個詐唬。', conceptualError: '尺寸與目標完全脫節。', remember: '沒有明確目標範圍的下注就不該存在。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '85', title: 'SPR 中段的耐心 check-call', category: ['SPR', '控池', '邊緣牌'], difficulty: '中階', type: 'Tournament', blinds: '500/1000', ante: true, tourneyInfo: '中期', userStack: '40000', userBB: 40, position: 'BB', holeCards: [S('A'), S('J')], preAction: 'BTN Open 2.5BB，你 Call', effectiveStack: '40BB',
    steps: [
      { id: '1', street: 'Turn', communityCards: [D('J'), C_('8'), H('3'), D('6')], spr: 2.9, description: 'Flop (J♦ 8♣ 3♥) 你過牌跟注 3BB。Turn 6♦，你過牌，BTN 再下注 8BB。底池 20BB (SPR ≈ 3)。', potSize: 20, options: ['Fold', 'Call', 'Raise'], feedbacks: {
        'Call': { judgment: '正確', score: 10, bestAction: 'Call', why: 'SPR 中段是最需要耐心的區間：頂對好踢跟得起兩條街，但主動加注只會被更強的範圍套住。維持 check-call，河牌再依他的第三槍與牌面做結。', conceptualError: '無', remember: 'SPR 低就套池、SPR 高就控池、SPR 中間就耐心——不搶戲、不棄守。', nextStepId: 'next_hand' },
        'Raise': { judgment: '錯誤', score: 2, bestAction: 'Call', why: '加注後你只會被兩對以上繼續，等於自己宣判頂對出局。', conceptualError: '中等牌力搶主動權。', remember: '加注要嘛為價值要嘛為詐唬，頂對在這裡兩者都不是。', nextStepId: 'next_hand' },
        'Fold': { judgment: '偏緊', score: 3, bestAction: 'Call', why: '兩槍就放棄頂對頂踢太早，BTN 的下注範圍還很寬。', conceptualError: '對持續下注過度反應。', remember: '位置差就用 check-call 撐住,別把防守變投降。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '86', title: '多街：BTN KQ 頂對控池與河牌薄價值', category: ['控池', 'Value Bet', 'SPR'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false, userStack: '200', userBB: 100, position: 'BTN', holeCards: [S('K'), D('Q')], preAction: 'CO 棄牌，你在 BTN Open 2.5BB，BB Call', effectiveStack: '100BB',
    steps: [
      { id: 'flop', street: 'Flop', communityCards: [H('K'), C_('8'), D('3')], potSize: 5.5, description: 'BB 過牌。你持頂對好踢腳，乾燥牌面要如何建立第一街策略？', options: ['Check', 'Bet small', 'Bet big'], assumptions: ['6-max 現金桌', '對手為一般常規玩家', '不考慮抽水差異'], strategySource: '教學用範圍策略；非求解器唯一頻率', handState: { tableSize: '6max', potSizeBB: 5.5, heroStackBB: 97.5, actions: [
        { street: 'Preflop', seat: 'BTN', action: 'raise', amountBB: 2.5, label: 'Open' },
        { street: 'Preflop', seat: 'BB', action: 'call', amountBB: 2.5 },
        { street: 'Flop', seat: 'BB', action: 'check' }
      ] }, feedbacks: {
        'Bet small': { judgment: '正確', score: 10, bestAction: 'Bet small', why: '乾燥 K-high 牌面適合用小尺寸讓 8x、口袋對與 A-high 繼續。', conceptualError: '無', remember: '乾面範圍優勢配小注，保留較差牌。', nextStepId: 'turn' },
        'Check': { judgment: '可接受', score: 7, bestAction: 'Bet small', why: '過牌能保護過牌範圍，但會少拿一街價值。', conceptualError: '價值下注頻率略低。', remember: '頂對好踢腳通常可先拿小注價值。', nextStepId: 'turn' },
        'Bet big': { judgment: '偏鬆', score: 3, bestAction: 'Bet small', why: '大注會讓許多較差牌直接棄牌，並把對手範圍收得太強。', conceptualError: '尺寸與目標範圍不匹配。', remember: '乾面不必一開始就把底池打大。', nextStepId: 'next_hand' }
      }},
      { id: 'turn', street: 'Turn', communityCards: [H('K'), C_('8'), D('3'), S('J')], potSize: 8.5, description: '你在 Flop 小注後被跟。Turn J♠，BB 過牌；這張牌讓部分聽牌與兩對出現。', options: ['Check', 'Bet half pot', 'Bet big'], handState: { tableSize: '6max', potSizeBB: 8.5, heroStackBB: 96, actions: [
        { street: 'Preflop', seat: 'BTN', action: 'raise', amountBB: 2.5, label: 'Open' },
        { street: 'Preflop', seat: 'BB', action: 'call', amountBB: 2.5 },
        { street: 'Flop', seat: 'BB', action: 'check' },
        { street: 'Flop', seat: 'BTN', action: 'bet', amountBB: 1.5 },
        { street: 'Flop', seat: 'BB', action: 'call', amountBB: 1.5 },
        { street: 'Turn', seat: 'BB', action: 'check' }
      ] }, feedbacks: {
        'Check': { judgment: '正確', score: 10, bestAction: 'Check', why: 'Q 踢腳頂對仍有攤牌價值，但 J 提升了 BB 的兩對與聽牌密度；過牌控制底池並誘發河牌詐唬。', conceptualError: '無', remember: '中等強度牌不必強求三街價值。', nextStepId: 'river' },
        'Bet half pot': { judgment: '可接受', score: 6, bestAction: 'Check', why: '仍能被 Kx 弱踢或聽牌跟注，但被加注時很難處理。', conceptualError: '第二街價值略薄。', remember: '下注前先想好面對加注怎麼做。', nextStepId: 'river' },
        'Bet big': { judgment: '錯誤', score: 2, bestAction: 'Check', why: '大注把較差一對趕走，留下兩對、暗三條與強聽牌。', conceptualError: '把一對打成套池牌。', remember: '牌面變動時要重新評估範圍。', nextStepId: 'next_hand' }
      }},
      { id: 'river', street: 'River', communityCards: [H('K'), C_('8'), D('3'), S('J'), C_('2')], potSize: 8.5, description: 'Turn 雙方過牌。River 2♣，BB 再次過牌。現在是否補上一街薄價值？', options: ['Check', 'Bet half pot', 'Bet big'], handState: { tableSize: '6max', potSizeBB: 8.5, heroStackBB: 96, actions: [
        { street: 'Preflop', seat: 'BTN', action: 'raise', amountBB: 2.5, label: 'Open' },
        { street: 'Preflop', seat: 'BB', action: 'call', amountBB: 2.5 },
        { street: 'Flop', seat: 'BTN', action: 'bet', amountBB: 1.5 },
        { street: 'Flop', seat: 'BB', action: 'call', amountBB: 1.5 },
        { street: 'Turn', seat: 'BB', action: 'check' },
        { street: 'Turn', seat: 'BTN', action: 'check' },
        { street: 'River', seat: 'BB', action: 'check' }
      ] }, feedbacks: {
        'Bet half pot': { judgment: '正確', score: 10, bestAction: 'Bet half pot', why: '空白河牌後，Kx 弱踢、Jx 與部分 8x 仍可能支付中小尺寸。', conceptualError: '無', remember: '控池不是放棄價值，而是把價值移到更安全的街道。', nextStepId: 'next_hand' },
        'Check': { judgment: '偏緊', score: 5, bestAction: 'Bet half pot', why: '攤牌幾乎總能贏，但錯過較差一對的支付。', conceptualError: '薄價值不足。', remember: '河牌沒有下一街，安全時要補價值。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '偏鬆', score: 3, bestAction: 'Bet half pot', why: '過大尺寸會讓想獲取價值的 Jx、8x 大量棄牌。', conceptualError: '價值尺寸過大。', remember: '薄價值要讓較差牌跟得起。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '87', title: '多街：同花聽牌半詐唬到河牌', category: ['同花聽牌', '聽牌打法', 'Blocker'], difficulty: '進階', type: 'Cash Game', blinds: '2/5', ante: false, userStack: '500', userBB: 100, position: 'CO', holeCards: [H('A'), H('5')], preAction: '你在 CO Open 2.5BB，BTN Call', effectiveStack: '100BB',
    steps: [
      { id: 'flop', street: 'Flop', communityCards: [H('K'), H('8'), C_('2')], potSize: 6.5, description: '你有堅果同花聽牌與後門順子可能，BTN 在你過牌後下注 2BB。', options: ['Fold', 'Call', 'Raise'], assumptions: ['100BB 無前注現金桌', 'BTN 為能棄牌的常規玩家'], strategySource: '教學用半詐唬線', handState: { tableSize: '6max', potSizeBB: 8.5, actions: [
        { street: 'Preflop', seat: 'CO', action: 'raise', amountBB: 2.5, label: 'Open' },
        { street: 'Preflop', seat: 'BTN', action: 'call', amountBB: 2.5 },
        { street: 'Flop', seat: 'CO', action: 'check' },
        { street: 'Flop', seat: 'BTN', action: 'bet', amountBB: 2 }
      ] }, feedbacks: {
        'Raise': { judgment: '正確', score: 10, bestAction: 'Raise', why: 'A♥5♥ 有高勝率、阻擋堅果同花與足夠 fold equity，適合成為 check-raise 半詐唬。', conceptualError: '無', remember: '最強聽牌可以同時靠勝率與棄牌率獲利。', nextStepId: 'turn' },
        'Call': { judgment: '可接受', score: 7, bestAction: 'Raise', why: '跟注保留全部勝率，但沒有利用 A♥ 阻擋牌施壓。', conceptualError: '略偏被動。', remember: '有些聽牌不只值得跟，也值得加注。', nextStepId: 'turn' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'Raise', why: '面對小注棄掉堅果同花聽牌，放棄過多勝率。', conceptualError: '過度棄牌。', remember: '先比較 pot odds 與成牌機率。', nextStepId: 'next_hand' }
      }},
      { id: 'turn', street: 'Turn', communityCards: [H('K'), H('8'), C_('2'), D('Q')], potSize: 24, description: 'Flop check-raise 被跟。Turn Q♦ 未成花，你保有 A-high 與堅果同花聽牌。', options: ['Check', 'Bet half pot', 'Bet big'], handState: { tableSize: '6max', potSizeBB: 24, actions: [
        { street: 'Preflop', seat: 'CO', action: 'raise', amountBB: 2.5, label: 'Open' },
        { street: 'Preflop', seat: 'BTN', action: 'call', amountBB: 2.5 },
        { street: 'Flop', seat: 'CO', action: 'raise', amountBB: 8, label: 'Check-Raise' },
        { street: 'Flop', seat: 'BTN', action: 'call', amountBB: 6 },
        { street: 'Turn', seat: 'CO', action: 'check' }
      ] }, feedbacks: {
        'Bet big': { judgment: '正確', score: 10, bestAction: 'Bet big', why: 'Q 改善你的 KQ、QQ 與強牌範圍；大尺寸可對 8x、弱 Kx 和中口袋對施壓。', conceptualError: '無', remember: '選擇有範圍優勢的牌繼續第二槍。', nextStepId: 'river' },
        'Check': { judgment: '可接受', score: 6, bestAction: 'Bet big', why: '可以實現勝率，但放棄延續前一街故事的 fold equity。', conceptualError: '進攻線不連貫。', remember: '半詐唬要規劃哪些轉牌繼續。', nextStepId: 'river' },
        'Bet half pot': { judgment: '偏鬆', score: 5, bestAction: 'Bet big', why: '方向正確，但小尺寸給對手太好的價格繼續所有成對牌。', conceptualError: '極化尺寸不足。', remember: '極化範圍通常需要較大尺寸。', nextStepId: 'river' }
      }},
      { id: 'river', street: 'River', communityCards: [H('K'), H('8'), C_('2'), D('Q'), S('4')], potSize: 60, description: 'River 4♠，同花沒有完成。對手在 Turn 跟注後 River 過牌到你。', options: ['Check', 'Bet big', 'All-in'], handState: { tableSize: '6max', potSizeBB: 60, heroStackBB: 70, actions: [
        { street: 'Flop', seat: 'CO', action: 'raise', amountBB: 8, label: 'Check-Raise' },
        { street: 'Flop', seat: 'BTN', action: 'call', amountBB: 6 },
        { street: 'Turn', seat: 'CO', action: 'bet', amountBB: 18 },
        { street: 'Turn', seat: 'BTN', action: 'call', amountBB: 18 },
        { street: 'River', seat: 'CO', action: 'check' }
      ] }, feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: 'A♥ 阻擋對手最自然的堅果同花聽牌；你的線能代表 set、KQ 與兩對，適合作為河牌詐唬候選。', conceptualError: '無', remember: '錯過聽牌不代表自動放棄；先看阻擋牌與價值範圍。', nextStepId: 'next_hand' },
        'Check': { judgment: '可接受', score: 6, bestAction: 'All-in', why: '放棄可避免高變異，但 A-high 很少能攤牌獲勝。', conceptualError: '詐唬不足。', remember: '選最好的 blocker 組合完成三街故事。', nextStepId: 'next_hand' },
        'Bet big': { judgment: '偏鬆', score: 5, bestAction: 'All-in', why: '大注有壓力，但留下的籌碼讓極化故事不如全下完整。', conceptualError: '河牌尺寸與範圍不一致。', remember: '低 SPR 河牌極化通常使用全下。', nextStepId: 'next_hand' }
      }}
    ]
  },
  {
    id: '88', title: '多街：18BB 錦標賽 3-bet pot', category: ['短碼策略', '錦標賽', 'SPR'], difficulty: '進階', type: 'Tournament', blinds: '1000/2000', ante: true, tourneyInfo: '中期，尚未接近錢圈', userStack: '36000', userBB: 18, position: 'BTN', holeCards: [S('A'), S('Q')], preAction: 'HJ Open 2.2BB，你在 BTN 3-bet All-in 前需決策', effectiveStack: '18BB',
    steps: [
      { id: 'preflop', street: 'Preflop', communityCards: [], potSize: 5.9, description: 'HJ 以一般範圍 Open 2.2BB。18BB、無顯著 ICM 壓力時如何處理 AQs？', options: ['Fold', 'Call', 'All-in'], assumptions: ['無顯著 ICM 壓力', 'HJ 為一般常規開池範圍'], strategySource: '教學用短碼策略', handState: { tableSize: '9max', potSizeBB: 5.9, heroStackBB: 18, actions: [
        { street: 'Preflop', seat: 'HJ', action: 'raise', amountBB: 2.2, label: 'Open' }
      ] }, feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: 'AQs 對一般 HJ 開池範圍有足夠勝率，18BB 全下可取得 fold equity 並避免翻後低 SPR 困境。', conceptualError: '無', remember: '短碼強牌優先用全下實現全部勝率。', nextStepId: 'showdown' },
        'Call': { judgment: '偏鬆', score: 4, bestAction: 'All-in', why: '平跟會邀請盲位入池，且剩餘 SPR 很低。', conceptualError: '短碼過度平跟。', remember: '18BB 要優先考慮可直接盈利的再加注全下。', nextStepId: 'flop' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '無 ICM 壓力時棄掉 AQs 過緊。', conceptualError: '錯估強起手牌價值。', remember: '先區分 cEV 與 ICM 情境。', nextStepId: 'next_hand' }
      }},
      { id: 'flop', street: 'Flop', communityCards: [D('Q'), H('7'), C_('4')], potSize: 8.4, spr: 1.9, description: '你選擇平跟，盲位棄牌。Flop 頂對頂踢，HJ 下注 2.5BB。低 SPR 下如何回應？', options: ['Fold', 'Call', 'All-in'], handState: { tableSize: '9max', potSizeBB: 10.9, heroStackBB: 15.8, actions: [
        { street: 'Preflop', seat: 'HJ', action: 'raise', amountBB: 2.2, label: 'Open' },
        { street: 'Preflop', seat: 'BTN', action: 'call', amountBB: 2.2 },
        { street: 'Flop', seat: 'HJ', action: 'bet', amountBB: 2.5 }
      ] }, feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: 'SPR 低於 2 且持頂對頂踢，直接全下可從 Qx、口袋對與聽牌取得價值。', conceptualError: '無', remember: '低 SPR 的強頂對通常已是套池牌。', nextStepId: 'showdown' },
        'Call': { judgment: '可接受', score: 7, bestAction: 'All-in', why: '跟注能保留詐唬，但剩餘籌碼幾乎必然在後街投入。', conceptualError: '價值取得稍慢。', remember: '若跟注，要提前接受後街套池。', nextStepId: 'showdown' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '低 SPR 頂對頂踢不能對小注棄牌。', conceptualError: '嚴重過度棄牌。', remember: 'SPR 決定一對牌願意投入多少。', nextStepId: 'next_hand' }
      }},
      { id: 'showdown', street: 'River', communityCards: [D('Q'), H('7'), C_('4'), S('2'), D('9')], potSize: 38, description: '教學回顧：牌面安全跑完。請選出這手牌最重要的原則。', options: ['Fold', 'Call', 'All-in'], feedbacks: {
        'All-in': { judgment: '正確', score: 10, bestAction: 'All-in', why: '核心不是結果，而是 18BB AQs 翻前有足夠 cEV 全下；若平跟後中頂對，低 SPR 也應套池。', conceptualError: '無', remember: '先規劃整手牌，而不是每街重新臨時決定。', nextStepId: 'next_hand' },
        'Call': { judgment: '可接受', score: 6, bestAction: 'All-in', why: '理解了牌力，但沒有把 fold equity 與低 SPR 納入完整規劃。', conceptualError: '缺乏整手牌計畫。', remember: '短碼決策從翻前就要規劃到攤牌。', nextStepId: 'next_hand' },
        'Fold': { judgment: '錯誤', score: 0, bestAction: 'All-in', why: '這條線中持續棄牌會錯失明顯的正期望值機會。', conceptualError: '結果導向與過度保守。', remember: '評估決策品質，不以單次輸贏判斷。', nextStepId: 'next_hand' }
      }}
    ]
  }
];
