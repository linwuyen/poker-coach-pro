export type HandHistoryAdapterSite = 'pokerstars' | 'ggpoker' | 'winamax' | 'wpn' | 'partypoker' | 'ipoker' | 'generic';

const START = /^(?=(?:PokerStars Hand\s*#|Poker Hand\s*#|Winamax Poker\b|Game Hand\s*#|PartyPoker Hand\s*#|\*{3,}\s*Hand History for Game\s+|iPoker Hand\s*#|Game\s*#\d+))/gmi;

function splitAnyHands(text:string):string[]{
 const normalized=text.replace(/\r\n/g,'\n').trim();if(!normalized)return[];
 const starts=[...normalized.matchAll(START)].map(match=>match.index||0);
 if(!starts.length)return[normalized];
 return starts.map((start,index)=>normalized.slice(start,starts[index+1]??normalized.length).trim()).filter(Boolean);
}

export function detectHandHistoryAdapterSite(raw:string):HandHistoryAdapterSite{
 if(/^PokerStars Hand\s*#/mi.test(raw))return'pokerstars';
 if(/^Poker Hand\s*#/mi.test(raw))return'ggpoker';
 if(/^Winamax Poker\b/mi.test(raw))return'winamax';
 if(/^Game Hand\s*#/mi.test(raw))return'wpn';
 if(/^PartyPoker Hand\s*#|^\*{3,}\s*Hand History for Game\s+/mi.test(raw))return'partypoker';
 if(/^iPoker Hand\s*#|^Game\s*#\d+/mi.test(raw))return'ipoker';
 return'generic';
}

function extractId(raw:string,site:HandHistoryAdapterSite):string|undefined{
 const patterns:Record<HandHistoryAdapterSite,RegExp[]>={
  pokerstars:[/PokerStars Hand\s*#([^:\s]+)/i],ggpoker:[/Poker Hand\s*#([^:\s]+)/i],
  winamax:[/HandId:\s*#?([^\s-]+(?:-[^\s-]+)*)/i],wpn:[/Game Hand\s*#([^:\s-]+)/i],
  partypoker:[/PartyPoker Hand\s*#([^:\s]+)/i,/Hand History for Game\s+([^\s*]+)/i],
  ipoker:[/iPoker Hand\s*#([^:\s]+)/i,/^Game\s*#([^\s]+)/mi],generic:[],
 };
 for(const pattern of patterns[site]){const match=raw.match(pattern);if(match?.[1])return match[1];}return undefined;
}
function moneyPair(raw:string):string|undefined{const match=raw.match(/(?:[$€£¥]\s*)?([0-9]+(?:[.,][0-9]+)*)\s*\/\s*(?:[$€£¥]\s*)?([0-9]+(?:[.,][0-9]+)*)/);return match?`${match[1]}/${match[2]}`:undefined;}
function timestamp(raw:string):string|undefined{const match=raw.match(/(20\d{2}[\/-]\d{2}[\/-]\d{2})[ T](\d{2}:\d{2}:\d{2})/);return match?`${match[1].replace(/\//g,'-')} ${match[2]}`:undefined;}
function escapeRegex(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function playerNames(raw:string):string[]{return[...raw.matchAll(/^Seat\s+\d+:\s+(.+?)\s+\(/gmi)].map(match=>match[1].trim());}

function normalizeSeatLines(raw:string):string{
 return raw.split('\n').map(line=>{
  const match=line.match(/^(Seat\s+\d+:\s+.+?\s+\()([^)]*?)(\))$/i);if(!match)return line;
  if(/\bin chips\b/i.test(match[2]))return line;
  return`${match[1]}${match[2].trim()} in chips${match[3]}`;
 }).join('\n');
}
function normalizeActorLines(raw:string,names:string[]):string{
 return raw.split('\n').map(line=>{
  if(/^.+?:\s+/.test(line))return line;
  for(const name of names){const pattern=new RegExp(`^${escapeRegex(name)}\\s+(posts|folds|checks|calls|bets|raises)\\b`,'i');if(pattern.test(line))return`${name}: ${line.slice(name.length).trim()}`;}
  return line;
 }).join('\n');
}
function inferButtonSeat(raw:string):number|undefined{const match=raw.match(/Seat\s*#?(\d+)\s+is\s+the\s+button/i)||raw.match(/button(?:\s+is)?\s+seat\s*#?(\d+)/i);return match?Number(match[1]):undefined;}
function inferTableName(raw:string):string{const quoted=raw.match(/Table\s*[: ]\s*'([^']+)'/i)||raw.match(/Table\s+'([^']+)'/i);if(quoted?.[1])return quoted[1].trim();const plain=raw.match(/Table\s*[: ]\s*([^\n(]+?)(?:\s+\d+-max|\s*\(|$)/i);return plain?.[1]?.trim()||'Imported';}

function normalizeExternalBlock(raw:string,site:Exclude<HandHistoryAdapterSite,'pokerstars'|'ggpoker'|'generic'>):string{
 const id=extractId(raw,site);if(!id)return raw;
 const pair=moneyPair(raw)||'0.5/1';const time=timestamp(raw)||'1970-01-01 00:00:00';const tournament=/tournament/i.test(raw);const tournamentMarker=tournament?' Tournament #Imported':'';
 let lines=raw.split('\n');lines[0]=`PokerStars Hand #${id}:${tournamentMarker} Hold'em No Limit (${pair}) - ${time}`;
 let normalized=normalizeSeatLines(lines.join('\n'));const names=playerNames(normalized);normalized=normalizeActorLines(normalized,names);
 if(!/Table\s+'[^']+'[^\n]*?\d+-max[^\n]*?Seat\s*#\d+\s+is\s+the\s+button/i.test(normalized)){
  const button=inferButtonSeat(normalized),seatCount=[...normalized.matchAll(/^Seat\s+\d+:/gmi)].length;
  if(button&&seatCount>=2){const canonical=`Table '${inferTableName(normalized)}' ${Math.min(9,seatCount)}-max Seat #${button} is the button`;const rows=normalized.split('\n');rows.splice(1,0,canonical);normalized=rows.join('\n');}
 }
 const out=normalized.split('\n');out.splice(1,0,`# PCP_SOURCE:${site}`);return out.join('\n');
}

/** Converts recognized site exports into the conservative canonical grammar consumed by the existing replay engine. */
export function normalizeMultiSiteHandHistoryText(text:string):string{
 return splitAnyHands(text).map(block=>{const site=detectHandHistoryAdapterSite(block);if(site==='pokerstars'||site==='ggpoker'||site==='generic')return block;return normalizeExternalBlock(block,site);}).join('\n\n');
}
