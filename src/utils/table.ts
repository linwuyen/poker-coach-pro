export const isPositionMatch = (posA: string, posB: string, tableSize: '6max' | '9max' = '9max'): boolean => {
  const a = posA.toLowerCase().trim();
  const b = posB.toLowerCase().trim();
  if (a === b) return true;
  if (tableSize === '6max') {
    if ((a === 'hj' || a === 'mp') && (b === 'hj' || b === 'mp')) return true;
  }
  return false;
};

export const parseSeatAction = (
  seatKey: string,
  preAction: string,
  description: string,
  position: string,
  tableSize: '6max' | '9max' = '9max'
) => {
  const text = (preAction + " " + description).toLowerCase();
  const sKey = seatKey.toLowerCase();
  const isH = isPositionMatch(seatKey, position, tableSize);
  
  let actionText = "";
  let betText = "";
  
  if (isH) {
    if (text.includes("你 open 3bb") || text.includes("你 open 2.5bb") || text.includes("你 open 2.2bb") || text.includes("你 open 3.0bb")) {
      actionText = "Open";
      betText = text.includes("3bb") || text.includes("3.0bb") ? "3.0 BB" : text.includes("2.2bb") ? "2.2 BB" : "2.5 BB";
    } else if (text.includes("你 3-bet 12bb")) {
      actionText = "3-Bet";
      betText = "12.0 BB";
    } else if (text.includes("你 3-bet 9bb")) {
      actionText = "3-Bet";
      betText = "9.0 BB";
    } else if (text.includes("你 c-bet 4bb")) {
      actionText = "C-Bet";
      betText = "4.0 BB";
    } else if (text.includes("你 c-bet 半池")) {
      actionText = "C-Bet";
      betText = "半池";
    } else if (text.includes("你 open 3bb") || text.includes("你 open")) {
      actionText = "Open";
      betText = "3.0 BB";
    }
  } else {
    if (sKey === 'utg' && (text.includes('utg open') || text.includes('utg (50bb) open') || text.includes('utg 加注') || text.includes('utg open 2bb'))) {
      actionText = "Open";
      betText = "2.0 BB";
    } else if (sKey === 'co' && (text.includes('co open 2.1bb') || text.includes('co (鬆玩家) open') || text.includes('co open 2.2bb') || text.includes('co 加注'))) {
      actionText = "Open";
      betText = text.includes('2.1bb') ? "2.1 BB" : text.includes('2.2bb') ? "2.2 BB" : "2.5 BB";
    } else if (sKey === 'co' && text.includes('co (9.5bb) all-in')) {
      actionText = "All-In";
      betText = "9.5 BB";
    } else if (sKey === 'btn' && (text.includes('btn open 2bb') || text.includes('btn open') || text.includes('btn 加注'))) {
      actionText = "Open";
      betText = text.includes('2bb') ? "2.0 BB" : "2.5 BB";
    } else if (sKey === 'btn' && text.includes('btn 3-bet to 9bb')) {
      actionText = "3-Bet";
      betText = "9.0 BB";
    } else if (sKey === 'btn' && text.includes('btn call')) {
      actionText = "Call";
      betText = "跟注";
    } else if (sKey === 'bb' && text.includes('bb 突然 check-raise')) {
      actionText = "Raise";
      betText = "6.0 BB";
    } else if (sKey === 'bb' && (text.includes('bb 突然領打') || text.includes('bb 領打') || text.includes('bb 突然領打 (donk bet) 10bb'))) {
      actionText = "Donk";
      betText = "10.0 BB";
    } else if (sKey === 'btn' && text.includes('btn 突然超額下注 1.5 倍底池')) {
      actionText = "Overbet";
      betText = "1.5x Pot";
    } else if (sKey === 'btn' && text.includes('btn 突然 all-in 97bb')) {
      actionText = "All-In";
      betText = "97.0 BB";
    } else if (sKey === 'btn' && text.includes('btn (12bb) all-in')) {
      actionText = "All-In";
      betText = "12.0 BB";
    } else if (sKey === 'mp' && text.includes('mp (12bb) all-in')) {
      actionText = "All-In";
      betText = "12.0 BB";
    } else if (sKey === 'hj' && text.includes('mp (12bb) all-in')) {
      actionText = "All-In";
      betText = "12.0 BB";
    }
  }
  
  return { actionText, betText };
};

export const isFolded = (
  seatKey: string,
  preAction: string,
  description: string,
  position: string,
  street: string,
  tableSize: '6max' | '9max' = '9max'
) => {
  const isH = isPositionMatch(seatKey, position, tableSize);
  if (isH) return false;
  
  const text = (preAction + " " + description).toLowerCase();
  const sKey = seatKey.toLowerCase();
  
  if (sKey === 'btn' && text.includes('btn 棄牌')) return true;
  if (sKey === 'sb' && text.includes('sb 棄牌')) return true;
  if (sKey === 'btn' && text.includes('btn/sb 棄牌')) return true;
  if (sKey === 'sb' && text.includes('btn/sb 棄牌')) return true;
  
  if (text.includes('前位棄牌')) {
    const posOrder = tableSize === '9max'
      ? ['utg', 'utg1', 'utg2', 'mp', 'hj', 'co', 'btn', 'sb', 'bb']
      : ['utg', 'hj', 'co', 'btn', 'sb', 'bb'];
    const heroIdx = posOrder.findIndex(p => isPositionMatch(p, position, tableSize));
    const seatIdx = posOrder.indexOf(sKey);
    if (seatIdx !== -1 && heroIdx !== -1 && seatIdx < heroIdx) {
      return true;
    }
  }

  if (street !== 'Preflop') {
    const mentionTerms = ['utg', 'utg1', 'utg2', 'mp', 'hj', 'co', 'btn', 'sb', 'bb', '莊家', '小盲', '大盲', '對手', 'villain', 'hero', '你'];
    const hasMention = mentionTerms.some(term => {
      if (term === sKey) return text.includes(term);
      if (tableSize === '6max') {
        if (term === 'mp' && sKey === 'hj') return text.includes('mp');
        if (term === 'hj' && sKey === 'hj') return text.includes('hj');
      } else {
        // For 9-max, handle relative key mappings
        if (term === 'mp' && sKey === 'mp') return text.includes('mp');
        if (term === 'hj' && sKey === 'hj') return text.includes('hj');
        if (term === 'utg' && (sKey === 'utg1' || sKey === 'utg2')) return text.includes('utg');
      }
      return false;
    });
    if (!hasMention) return true;
  }
  
  return false;
};

export const SIX_MAX_SEATS = [
  { key: 'btn', label: 'BTN 莊家位', top: '50%', left: '91%', betTop: '50%', betLeft: '75%', dealerTop: '50%', dealerLeft: '76%' },
  { key: 'sb', label: 'SB 小盲位', top: '81.2%', left: '70.5%', betTop: '67.3%', betLeft: '62.5%' },
  { key: 'bb', label: 'BB 大盲位', top: '81.2%', left: '29.5%', betTop: '67.3%', betLeft: '37.5%' },
  { key: 'utg', label: 'UTG 槍口位', top: '50%', left: '9%', betTop: '50%', betLeft: '25%' },
  { key: 'hj', label: 'HJ 劫持位', top: '18.8%', left: '29.5%', betTop: '32.7%', betLeft: '37.5%' },
  { key: 'co', label: 'CO 關位', top: '18.8%', left: '70.5%', betTop: '32.7%', betLeft: '62.5%' },
];

export const NINE_MAX_SEATS = [
  { key: 'mp', label: 'MP 中位', top: '14%', left: '50%', betTop: '30%', betLeft: '50%' },
  { key: 'hj', label: 'HJ 劫持位', top: '22.4%', left: '76.4%', betTop: '34.7%', betLeft: '66.1%' },
  { key: 'co', label: 'CO 關位', top: '43.7%', left: '90.4%', betTop: '46.5%', betLeft: '74.6%' },
  { key: 'btn', label: 'BTN 莊家位', top: '68%', left: '85.5%', betTop: '60%', betLeft: '71.7%', dealerTop: '61%', dealerLeft: '73%' },
  { key: 'sb', label: 'SB 小盲位', top: '83.8%', left: '64%', betTop: '68.8%', betLeft: '58.6%' },
  { key: 'bb', label: 'BB 大盲位', top: '83.8%', left: '36%', betTop: '68.8%', betLeft: '41.4%' },
  { key: 'utg', label: 'UTG 槍口位', top: '68%', left: '14.5%', betTop: '60%', betLeft: '28.3%' },
  { key: 'utg1', label: 'UTG+1 槍口+1', top: '43.7%', left: '9.6%', betTop: '46.5%', betLeft: '25.4%' },
  { key: 'utg2', label: 'UTG+2 槍口+2', top: '22.4%', left: '23.6%', betTop: '34.7%', betLeft: '33.9%' },
];
