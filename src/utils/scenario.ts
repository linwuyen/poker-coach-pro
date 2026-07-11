import { Scenario, Card, Suit } from '../types';
import { SUITS, SUIT_SYMBOLS } from './cards';

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mapTextSymbols(text: string, suitMap: Record<Suit, Suit>): string {
  if (!text) return text;
  const symbolMap: Record<string, string> = {
    '♥': SUIT_SYMBOLS[suitMap['hearts']],
    '♦': SUIT_SYMBOLS[suitMap['diamonds']],
    '♣': SUIT_SYMBOLS[suitMap['clubs']],
    '♠': SUIT_SYMBOLS[suitMap['spades']]
  };
  return text.replace(/[♥♦♣♠]/g, match => symbolMap[match] || match);
}

export function reskinScenario(scenario: Scenario): Scenario {
  // Shuffle suits to map them randomly
  const shuffledSuits = shuffleArray(SUITS);
  const suitMap: Record<Suit, Suit> = {
    'spades': shuffledSuits[0],
    'hearts': shuffledSuits[1],
    'diamonds': shuffledSuits[2],
    'clubs': shuffledSuits[3]
  };

  const mapCard = (card: Card): Card => ({
    rank: card.rank,
    suit: suitMap[card.suit]
  });

  const holeCards = scenario.holeCards.map(mapCard);
  
  const steps = scenario.steps.map(step => {
    // map feedbacks
    const feedbacks: any = {};
    if (step.feedbacks) {
      Object.entries(step.feedbacks).forEach(([action, fb]) => {
        if (fb) {
          feedbacks[action] = {
            ...fb,
            why: mapTextSymbols(fb.why, suitMap),
            conceptualError: mapTextSymbols(fb.conceptualError, suitMap),
            remember: mapTextSymbols(fb.remember, suitMap)
          };
        }
      });
    }

    return {
      ...step,
      communityCards: step.communityCards.map(mapCard),
      description: mapTextSymbols(step.description, suitMap),
      feedbacks
    };
  });

  return {
    ...scenario,
    holeCards,
    steps
  };
}

export function matchesSearch(s: Scenario, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase().trim();
  if (s.title.toLowerCase().includes(q)) return true;
  if (s.difficulty.toLowerCase().includes(q)) return true;
  if (s.category && s.category.some(c => c.toLowerCase().includes(q))) return true;
  if (s.position.toLowerCase().includes(q)) return true;
  
  const holeCardsStr = s.holeCards.map(c => c.rank).join('');
  const holeCardsFull = s.holeCards.map(c => `${c.rank}${c.suit}`).join(' ').toLowerCase();
  if (holeCardsStr.toLowerCase().includes(q)) return true;
  if (holeCardsFull.includes(q)) return true;
  
  const rank1 = s.holeCards[0]?.rank || '';
  const rank2 = s.holeCards[1]?.rank || '';
  const suitsEqual = s.holeCards[0]?.suit === s.holeCards[1]?.suit;
  const pairStr = rank1 + rank2;
  const pairStrRev = rank2 + rank1;
  const suitedStr = pairStr + 's';
  const suitedStrRev = pairStrRev + 's';
  const offsuitedStr = pairStr + 'o';
  const offsuitedStrRev = pairStrRev + 'o';
  
  if (pairStr.toLowerCase().includes(q) || pairStrRev.toLowerCase().includes(q)) return true;
  if (suitsEqual && (suitedStr.toLowerCase().includes(q) || suitedStrRev.toLowerCase().includes(q))) return true;
  if (!suitsEqual && (offsuitedStr.toLowerCase().includes(q) || offsuitedStrRev.toLowerCase().includes(q))) return true;

  return false;
}

export const getOptionBBLabel = (
  opt: string,
  potSize: number,
  scenario: any,
  description: string,
  preAction: string
): string => {
  const optLower = opt.toLowerCase();
  const text = `${preAction || ''} ${description || ''}`;

  if (optLower.includes('fold')) {
    return '';
  }
  if (optLower.includes('check')) {
    return '0 BB';
  }

  // Parse open/steal sizing
  const getOpenSize = (): number => {
    const match = text.match(/(?:Open|open|steal)\s*(\d+(?:\.\d+)?)\s*BB/i);
    if (match) return parseFloat(match[1]);
    return 2.5;
  };

  // Parse previous bet sizing
  const getPreviousBet = (): number => {
    const match = text.match(/(?:3-bet|Raise|raise|下注|打|領打|donk)\s*(?:到)?\s*(\d+(?:\.\d+)?)\s*BB/i);
    if (match) return parseFloat(match[1]);
    return 0;
  };

  if (optLower.includes('all-in') || optLower.includes('push') || optLower.includes('shove')) {
    const stack = scenario?.userBB || 100;
    return `${stack} BB`;
  }

  if (optLower.includes('half pot') || optLower.includes('50%')) {
    const size = Math.round(potSize * 0.5 * 10) / 10;
    return `${size} BB`;
  }

  if (optLower.includes('small') || optLower.includes('33%') || optLower.includes('30%')) {
    const size = Math.round(potSize * 0.33 * 10) / 10;
    return `${size} BB`;
  }

  if (optLower.includes('big') || optLower.includes('75%') || optLower.includes('70%')) {
    const size = Math.round(potSize * 0.75 * 10) / 10;
    return `${size} BB`;
  }

  if (optLower.includes('pot') && !optLower.includes('half')) {
    const size = Math.round(potSize * 10) / 10;
    return `${size} BB`;
  }

  if (optLower.includes('3-bet')) {
    const open = getOpenSize();
    const size = Math.round(open * 3.5 * 10) / 10;
    return `${size} BB`;
  }

  if (optLower.includes('4-bet') || optLower.includes('raise')) {
    const prev = getPreviousBet();
    if (prev > 0) {
      const size = Math.round(prev * 2.5 * 10) / 10;
      return `${size} BB`;
    }
    // Preflop raise of an open
    const open = getOpenSize();
    const size = Math.round(open * 3.5 * 10) / 10;
    return `${size} BB`;
  }

  if (optLower.includes('call')) {
    // Look for previous bet to call
    const prev = getPreviousBet();
    if (prev > 0) {
      return `${prev} BB`;
    }
    const open = getOpenSize();
    if (open > 0) {
      return `${open} BB`;
    }
    // Check if there is any custom BB number mentioned
    const match = text.match(/(\d+(?:\.\d+)?)\s*BB/i);
    if (match) {
      return `${match[1]} BB`;
    }
    return '';
  }

  return '';
};
