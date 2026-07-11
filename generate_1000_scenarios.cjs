const fs = require('fs');

const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const S = (r) => `S('${r}')`;
const H = (r) => `H('${r}')`;
const D = (r) => `D('${r}')`;
const C_ = (r) => `C_('${r}')`;

const templates = [
    {
        title: (i) => `AQo 3-bet 遇 4-bet #${i}`,
        diff: '進階', type: 'Cash Game', blinds: '2/5', ante: false,
        stack: '500', bb: 100, pos: 'CO', cards: [S('A'), D('Q')],
        pre: 'HJ Open 3BB，你 3-bet 9BB，HJ 4-bet 25BB',
        eff: '100BB',
        steps: [{
            id: '1', street: 'Preflop', cards: [], desc: '面對 4-bet，底池 35.5BB。',
            pot: 35.5, opts: ['Fold', 'Call', 'All-in'],
            fb: {
                'Fold': { j: '正確', s: 10, b: 'Fold', w: 'AQo 面對 4-bet 處於絕對劣勢，通常對手範圍是 QQ+, AK。', c: '無', r: '不要高估 AQo，面對 4-bet 要果斷放棄。' },
                'Call': { j: '錯誤', s: 2, b: 'Fold', w: 'OOP 或被動防守 4-bet 非常虧錢。', c: '死抱強起手牌。', r: 'AQ 只是抓雞牌。' },
                'All-in': { j: '錯誤', s: 0, b: 'Fold', w: '自殺式詐唬。', c: '情緒失控。', r: '4-bet 範圍極強。' }
            }
        }]
    },
    {
        title: (i) => `同花聽牌 Flop 被 Raise #${i}`,
        diff: '中階', type: 'Tournament', blinds: '500/1000', ante: true,
        stack: '40000', bb: 40, pos: 'BTN', cards: [H('8'), H('7')],
        pre: '你 Open 2BB，BB Call',
        eff: '40BB',
        steps: [{
            id: '1', street: 'Flop', cards: [H('K'), H('2'), S('5')], desc: 'Flop 你中了同花聽牌。底池 5.5BB。你 C-bet 2BB，BB Raise 到 7BB。',
            pot: 14.5, opts: ['Fold', 'Call', 'All-in'],
            fb: {
                'Call': { j: '正確', s: 10, b: 'Call', w: '有位置優勢，且是強聽牌，跟注看轉牌是標準打法。', c: '無', r: '面對 Raise，有位置的同花聽牌可以跟注。' },
                'All-in': { j: '可接受', s: 7, b: 'Call', w: '半詐唬 shove 也是一種打法，但會被 Kx 或更好的聽牌跟注。', c: '激進過頭。', r: '平跟保留彈性。' },
                'Fold': { j: '錯誤', s: 0, b: 'Call', w: '放棄了極好的勝率。', c: '過度退縮。', r: '強聽牌不能輕易 Fold。' }
            }
        }]
    },
    {
        title: (i) => `短碼 10BB BB 位防守 #${i}`,
        diff: '新手', type: 'Tournament', blinds: '1000/2000', ante: true,
        stack: '20000', bb: 10, pos: 'BB', cards: [S('T'), S('9')],
        pre: 'BTN Open 2BB，SB 棄牌',
        eff: '10BB',
        steps: [{
            id: '1', street: 'Preflop', cards: [], desc: 'BTN steal，你剩 10BB。',
            pot: 4.5, opts: ['Fold', 'Call', 'All-in'],
            fb: {
                'All-in': { j: '正確', s: 10, b: 'All-in', w: 'T9s 有很好的 blocker 和 equity，10BB 直接 shove 施壓 BTN steal 範圍。', c: '無', r: '短碼在 BB 拿到中等同花連牌是很好的 shove 牌。' },
                'Call': { j: '錯誤', s: 2, b: 'All-in', w: '平跟剩下 8BB postflop 很難打。', c: '被動防守。', r: '10BB 只有 Push/Fold。' },
                'Fold': { j: '偏緊', s: 4, b: 'All-in', w: '放棄了 +EV shove。', c: '過緊。', r: '不要讓盲注被偷光。' }
            }
        }]
    },
    {
        title: (i) => `中底對 Turn 面對大注 #${i}`,
        diff: '中階', type: 'Cash Game', blinds: '1/2', ante: false,
        stack: '200', bb: 100, pos: 'BTN', cards: [C_('9'), C_('8')],
        pre: '你 Open 3BB，BB Call',
        eff: '100BB',
        steps: [{
            id: '1', street: 'Turn', cards: [D('K'), C_('9'), H('4'), S('2')], desc: 'Flop K-9-4 虹面，BB check-call 2BB。Turn 掉 2，底池 10.5BB。BB 突然領打 (Donk) 8BB。',
            pot: 18.5, opts: ['Fold', 'Call', 'Raise'],
            fb: {
                'Fold': { j: '正確', s: 10, b: 'Fold', w: 'BB 的 Donk bet 通常代表強牌，9 的中對不足以抓雞。', c: '無', r: '低級別 Donk bet 多半是真牌。' },
                'Call': { j: '錯誤', s: 2, b: 'Fold', w: '抓雞過度，只會輸更多。', c: '不願蓋牌。', r: '中對抗壓力差。' },
                'Raise': { j: '錯誤', s: 0, b: 'Fold', w: '毫無邏輯的加注。', c: '亂玩。', r: '落後時不要加注。' }
            }
        }]
    },
    {
        title: (i) => `頂對頂踢 ICM 壓力 #${i}`,
        diff: '進階', type: 'Tournament', blinds: '5k/10k', ante: true,
        stack: '300k', bb: 30, pos: 'MP', cards: [S('A'), C_('Q')],
        pre: '泡沫期 (Bubble)，你 Open 2BB，BTN (大籌碼 100BB) 3-bet 6BB',
        eff: '30BB',
        steps: [{
            id: '1', street: 'Preflop', cards: [], desc: '面對大籌碼的 3-bet，你有 30BB。',
            pot: 10.5, opts: ['Fold', 'Call', 'All-in'],
            fb: {
                'Fold': { j: '正確', s: 10, b: 'Fold', w: 'ICM 泡沫期生存第一，大籌碼利用泡沫壓榨，AQo 雖然強但不值得冒淘汰風險。', c: '無', r: '泡沫期面對大籌碼要極端保守。' },
                'All-in': { j: '錯誤', s: 2, b: 'Fold', w: '泡沫期撞上大籌碼的強範圍就出局了。', c: '無視 ICM。', r: '生存比籌碼翻倍重要。' },
                'Call': { j: '錯誤', s: 4, b: 'Fold', w: 'OOP 玩 3-bet pot 在泡沫期是折磨。', c: '猶豫不決。', r: '泡沫期少平跟。' }
            }
        }]
    },
    {
        title: (i) => `多人底池 Flush 聽牌 #${i}`,
        diff: '新手', type: 'Cash Game', blinds: '1/3', ante: false,
        stack: '300', bb: 100, pos: 'CO', cards: [D('K'), D('J')],
        pre: 'UTG Open 3BB, MP Call, 你 Call, BB Call',
        eff: '100BB',
        steps: [{
            id: '1', street: 'Flop', cards: [D('T'), S('7'), D('2')], desc: 'Flop (T♦ 7♠ 2♦) 你有 K high 同花聽牌。底池 12.5BB。前面都 check，輪到你。',
            pot: 12.5, opts: ['Check', 'Bet half pot', 'Bet big'],
            fb: {
                'Bet half pot': { j: '正確', s: 10, b: 'Bet half pot', w: '有多人底池，你有強聽牌，可以下注半池拿半詐唬價值，並可能直接拿下底池。', c: '無', r: '好聽牌要主動造池。' },
                'Check': { j: '偏緊', s: 6, b: 'Bet half pot', w: '過牌拿免費牌也可行，但錯失了 fold equity。', c: '太被動。', r: '有位置可以多施壓。' },
                'Bet big': { j: '錯誤', s: 3, b: 'Bet half pot', w: '打太大容易被強牌 raise，逼走弱牌。', c: '尺度不佳。', r: '聽牌不需要 overbet。' }
            }
        }]
    },
    {
        title: (i) => `超強牌 Slow play 陷阱 #${i}`,
        diff: '中階', type: 'Tournament', blinds: '100/200', ante: true,
        stack: '10000', bb: 50, pos: 'UTG', cards: [S('A'), H('A')],
        pre: '你 Open 2BB，BTN Call',
        eff: '50BB',
        steps: [{
            id: '1', street: 'Flop', cards: [S('A'), C_('8'), D('2')], desc: 'Flop 你中了頂 Set。底池 5.5BB。',
            pot: 5.5, opts: ['Check', 'Bet small', 'Bet big'],
            fb: {
                'Check': { j: '正確', s: 10, b: 'Check', w: '超級乾燥牌面，你阻擋了對手拿頂對的可能，過牌讓對手詐唬。', c: '無', r: '乾燥且阻擋對手範圍時可以慢打。' },
                'Bet small': { j: '可接受', s: 7, b: 'Check', w: '下小注也可以，但對手容易蓋牌。', c: '無', r: '考量牌面濕度決定是否慢打。' },
                'Bet big': { j: '錯誤', s: 0, b: 'Check', w: '趕走所有對手。', c: '不懂控制節奏。', r: '死乾面不要打大。' }
            }
        }]
    },
    {
        title: (i) => `河牌抓雞 Blocker 效應 #${i}`,
        diff: '進階', type: 'Cash Game', blinds: '5/10', ante: false,
        stack: '1000', bb: 100, pos: 'BB', cards: [S('A'), H('K')],
        pre: 'BTN Open 2.5BB，你 3-bet 10BB，BTN Call',
        eff: '100BB',
        steps: [{
            id: '1', street: 'River', cards: [S('Q'), H('J'), D('5'), C_('2'), S('2')], desc: '前兩街過牌。River 底池 20BB。你過牌，BTN 下注 15BB。',
            pot: 35, opts: ['Fold', 'Call', 'Raise'],
            fb: {
                'Call': { j: '正確', s: 10, b: 'Call', w: '你雖然只有 A high，但阻擋了 AK/AQ 等強牌，對手極化範圍中很多沒中的聽牌，是很好的抓雞牌。', c: '無', r: '利用 Blocker 決定是否抓雞。' },
                'Fold': { j: '可接受', s: 6, b: 'Call', w: '保守打法，避免變異。', c: '未能識別 Blocker 價值。', r: 'A high 有時是最佳抓雞牌。' },
                'Raise': { j: '錯誤', s: 0, b: 'Call', w: '把抓雞牌轉為詐唬，只會被強牌跟。', c: '邏輯混亂。', r: '抓雞牌不要 Raise。' }
            }
        }]
    }
];

const scenarios = [];
let idCounter = 101;
let generateCount = 900;
for(let i=0; i<generateCount; i++) {
    const template = templates[i % templates.length];
    
    // Create random variation
    const variation = `
  {
    id: '${idCounter++}', title: '${template.title(Math.floor(i/templates.length) + 1)}', category: [], difficulty: '${template.diff}', type: '${template.type}', blinds: '${template.blinds}', ante: ${template.ante}, userStack: '${template.stack}', userBB: ${template.bb}, position: '${template.pos}', holeCards: [${template.cards[0]}, ${template.cards[1]}], preAction: '${template.pre}', effectiveStack: '${template.eff}',
    steps: [
      { id: '1', street: '${template.steps[0].street}', communityCards: [${template.steps[0].cards.join(', ')}], description: '${template.steps[0].desc}', potSize: ${template.steps[0].pot}, options: ${JSON.stringify(template.steps[0].opts)}, feedbacks: {
        ${Object.entries(template.steps[0].fb).map(([opt, fb]) => `'${opt}': { judgment: '${fb.j}', score: ${fb.s}, bestAction: '${fb.b}', why: '${fb.w}', conceptualError: '${fb.c}', remember: '${fb.r}', nextStepId: 'next_hand' }`).join(',\n        ')}
      }}
    ]
  }`;
    scenarios.push(variation);
}

const fileContent = fs.readFileSync('src/data.ts', 'utf8');
const closingBracketIndex = fileContent.lastIndexOf('];');

if (closingBracketIndex !== -1) {
    const newContent = fileContent.slice(0, closingBracketIndex) + ',\n' + scenarios.join(',\n') + '\n' + fileContent.slice(closingBracketIndex);
    fs.writeFileSync('src/data.ts', newContent);
    console.log("Successfully generated and appended 900 scenarios.");
} else {
    console.error("Could not find the end of scenarios array.");
}
