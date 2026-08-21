import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMultiSiteHandHistoryText } from '../src/real-game/multiSiteHandHistory';

const common=(header:string,button:string)=>`${header}\nTable: 'CrossSite' 3-max\nSeat 1: VillainA ($100)\nSeat 2: VillainB ($100)\nSeat 3: Hero ($100)\n${button}\nVillainA posts small blind $0.50\nVillainB posts big blind $1\n*** HOLE CARDS ***\nDealt to Hero [As Kd]\nHero raises $1.50 to $2.50\nVillainA folds\nVillainB folds\nHero collected $2.50 from pot\n*** SUMMARY ***`;

const fixtures=[
 ['winamax',common("Winamax Poker - CashGame - HandId: #111-222-333 - Holdem no limit ($0.50/$1.00) - 2026/08/21 12:00:00 UTC",'Seat #3 is the button')],
 ['wpn',common('Game Hand #222 - Holdem No Limit ($0.50/$1.00) - 2026/08/21 12:01:00','Seat #3 is the button')],
 ['partypoker',common('***** Hand History for Game 333 ***** Blinds $0.50/$1.00 - 2026/08/21 12:02:00','button is seat 3')],
 ['ipoker',common('Game #444 - Holdem No Limit - Blinds $0.50/$1.00 - 2026/08/21 12:03:00','Seat #3 is the button')],
] as const;

for(const [site,raw] of fixtures)test(`P25 ${site} adapter normalizes into the shared replay contract`,()=>{
 const result=parseMultiSiteHandHistoryText(raw);
 assert.equal(result.hands.length,1);
 assert.equal(result.hands[0].source,site);
 assert.equal(result.hands[0].heroName,'Hero');
 assert.equal(result.hands[0].heroPosition,'BTN');
 assert.equal(result.hands[0].bigBlind,1);
 assert.equal(result.hands[0].actions.some(action=>action.player==='Hero'&&action.type==='raise'&&action.toBB===2.5),true);
 assert.equal(result.rejectedBlocks,0);
});

test('P25 mixed-site input keeps site provenance per hand instead of flattening everything to PokerStars',()=>{
 const result=parseMultiSiteHandHistoryText(fixtures.map(([,raw])=>raw).join('\n\n'));
 assert.equal(result.hands.length,4);
 assert.deepEqual(new Set(result.hands.map(hand=>hand.source)),new Set(['winamax','wpn','partypoker','ipoker']));
});
