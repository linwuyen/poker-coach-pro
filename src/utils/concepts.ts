import { Scenario } from '../types';

export const CONCEPT_DISPLAY_NAMES: Record<string, string> = {
  'Preflop': '起手牌與 preflop 觀念',
  '3-Bet/4-Bet': '3-Bet / 4-Bet 應對',
  '同花聽牌': '同花與兩頭順聽牌打法',
  '聽牌打法': '強聽牌半詐唬與造池',
  '短碼策略': '短碼 Push 或 Fold 決策',
  '錦標賽': '錦標賽與泡沫期戰略',
  '控池': '邊緣牌控制底池大小',
  '邊緣牌': '中等強度的邊緣牌應對',
  'ICM 壓力': 'ICM 錦標賽生存壓力',
  '多人底池': '多人底池與阻擋牌效應',
  '慢打/Slow Play': '超強牌慢打設陷阱',
  '強牌價值': '強牌價值極大化',
  '抓雞/Bluff Catch': '河牌抓雞 Blocker 效應',
  'Blocker': 'Blocker 阻擋牌觀念',
  'Value Bet': '價值下注與尺寸選擇',
  'SPR': 'SPR 底池籌碼比決策',
  '常規戰術': '常規實戰策略'
};

export function getScenarioCategories(scenario: Scenario): string[] {
  if (scenario.category && scenario.category.length > 0) return scenario.category;
  const title = scenario.title || '';
  if (title.includes('3-bet') || title.includes('4-bet')) return ['Preflop', '3-Bet/4-Bet'];
  if (title.includes('同花聽牌') || title.includes('Flush')) return ['同花聽牌', '聽牌打法'];
  if (title.includes('短碼') || title.includes('10BB')) return ['短碼策略', '錦標賽'];
  if (title.includes('中底對') || title.includes('邊緣')) return ['控池', '邊緣牌'];
  if (title.includes('ICM') || title.includes('頂對頂踢')) return ['ICM 壓力', '錦標賽'];
  if (title.includes('多人底池')) return ['多人底池', '聽牌打法'];
  if (title.includes('Slow play') || title.includes('超強牌')) return ['慢打/Slow Play', '強牌價值'];
  if (title.includes('抓雞') || title.includes('Blocker')) return ['抓雞/Bluff Catch', 'Blocker'];
  return ['常規戰術'];
}
