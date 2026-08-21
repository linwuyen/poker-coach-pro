import assert from 'node:assert/strict';
import test from 'node:test';
import { importHandHistoryText, parseHandHistoryText } from '../src/real-game/handHistory';

const STARS_HAND = `PokerStars Hand #256630874413: Hold'em No Limit (€1/€2 EUR) - 2026/08/20 18:50:25 ET
Table 'Dangreen' 4-max Seat #5 is the button
Seat 2: Alice (€20 in chips)
Seat 4: Bob (€38.25 in chips)
Seat 5: Carol (€13.18 in chips)
Seat 6: Dan (€74.33 in chips)
Carol: posts small blind €1
Alice: posts big blind €2
*** HOLE CARDS ***
Dealt to Alice [Td As]
Bob: raises €4 to €6
Carol: folds
Alice: calls €4
*** FLOP *** [2d 7h 8c]
Alice: checks
Bob: bets €6
Alice: folds
Uncalled bet (€6) returned to Bob
*** SUMMARY ***`;

const GG_HAND = `Poker Hand #SG3318570581 Tournament #244159797 Spin&Gold Hold'em No Limit Level1 (10/20) - 2026/08/20 14:48:57
Table '90112' 3-max Seat #3 is the button
Seat 1: VillainA (270 in chips)
Seat 2: VillainB (360 in chips)
Seat 3: Hero (270 in chips)
VillainA: posts small blind 10
VillainB: posts big blind 20
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Hero: raises 20 to 40
VillainA: folds
VillainB: folds
Hero collected 50 from pot
*** SUMMARY ***`;

test('PokerStars text is parsed into structured hero decisions and BB-normalized context', () => {
  const [hand] = parseHandHistoryText(STARS_HAND);
  assert.ok(hand);
  assert.equal(hand.source, 'pokerstars');
  assert.equal(hand.id, '256630874413');
  assert.equal(hand.heroName, 'Alice');
  assert.equal(hand.heroPosition, 'BB');
  assert.equal(hand.heroStackBB, 10);
  assert.equal(hand.actions.filter(action => action.player === 'Alice' && action.type !== 'post').length, 3);
  assert.deepEqual(hand.board, ['2d', '7h', '8c']);
});

test('GGPoker tournament histories detect MTT format and button position', () => {
  const [hand] = parseHandHistoryText(GG_HAND);
  assert.ok(hand);
  assert.equal(hand.source, 'ggpoker');
  assert.equal(hand.format, 'MTT');
  assert.equal(hand.heroName, 'Hero');
  assert.equal(hand.heroPosition, 'BTN');
  assert.equal(hand.bigBlind, 20);
});

test('hand-history import creates real-game exposure evidence without inventing mistakes or EV loss', () => {
  const result = importHandHistoryText(`${STARS_HAND}\n\n${GG_HAND}`, { batchId: 'batch-1', importedAt: 1_800_000_000_000 });
  assert.equal(result.hands.length, 2);
  assert.ok(result.history.length >= 2);
  assert.ok(result.history.every(item => item.trainingType === 'real-hand'));
  assert.ok(result.history.every(item => item.spotExposureCount && item.spotExposureCount > 0));
  assert.ok(result.history.every(item => item.utilityLoss === undefined));
  assert.ok(result.history.some(item => item.skillIds?.includes('preflop.bb-defense')));
});

test('already imported hand ids are skipped deterministically', () => {
  const result = importHandHistoryText(STARS_HAND, { alreadyImportedIds: ['256630874413'] });
  assert.equal(result.hands.length, 0);
  assert.deepEqual(result.skippedHandIds, ['256630874413']);
  assert.equal(result.history.length, 0);
});
