import { HistoryItem } from '../types';
import { HandHistorySite, ParsedHandHistory, handHistoriesToSessionImports, parseHandHistoryText } from './handHistory';
import { HandHistoryAdapterSite, detectHandHistoryAdapterSite, normalizeMultiSiteHandHistoryText } from './handHistoryAdapters';
import { sessionImportToHistory } from './sessionImport';

export type MultiSiteHandHistorySite = Exclude<HandHistoryAdapterSite,'generic'> | 'generic';

function sourceFromRaw(raw:string,parsed:HandHistorySite):MultiSiteHandHistorySite{
 const marker=raw.match(/^#\s*PCP_SOURCE:([a-z0-9-]+)/mi)?.[1] as MultiSiteHandHistorySite|undefined;
 return marker||parsed;
}

export interface MultiSiteParsedHand extends Omit<ParsedHandHistory,'source'>{source:MultiSiteHandHistorySite;}
export interface MultiSiteParseResult {
  hands: MultiSiteParsedHand[];
  detectedSites: MultiSiteHandHistorySite[];
  normalizedText: string;
  rejectedBlocks: number;
}
export interface MultiSiteHandHistoryImportResult extends MultiSiteParseResult { history:HistoryItem[];parsedHandIds:string[];skippedHandIds:string[];heroNames:string[];contexts:number; }

/**
 * P25 facade: site-specific syntax is normalized first, then every hand goes through the same
 * conservative ParsedHandHistory/replay contract used by PokerStars/GG. No site receives a looser truth path.
 */
export function parseMultiSiteHandHistoryText(text:string,heroOverride?:string):MultiSiteParseResult{
 const normalizedText=normalizeMultiSiteHandHistoryText(text);
 const expectedBlocks=normalizedText.trim()?normalizedText.split(/\n\s*\n(?=PokerStars Hand|Poker Hand)/i).length:0;
 const parsed=parseHandHistoryText(normalizedText,heroOverride).map(hand=>({...hand,source:sourceFromRaw(hand.raw,hand.source)})) as MultiSiteParsedHand[];
 const detectedSites=[...new Set(parsed.map(hand=>hand.source))];
 return{hands:parsed,detectedSites,normalizedText,rejectedBlocks:Math.max(0,expectedBlocks-parsed.length)};
}

/** Same exposure/history semantics as the original HH importer, but with site adapters in front. */
export function importMultiSiteHandHistoryText(text:string,options:{heroName?:string;batchId?:string;alreadyImportedIds?:Iterable<string>;importedAt?:number}={}):MultiSiteHandHistoryImportResult{
 const parsed=parseMultiSiteHandHistoryText(text,options.heroName),already=new Set(options.alreadyImportedIds||[]),hands=parsed.hands.filter(hand=>!already.has(hand.id)),skippedHandIds=parsed.hands.filter(hand=>already.has(hand.id)).map(hand=>hand.id),batchId=options.batchId||`hh-multisite-${options.importedAt||Date.now()}`;
 const history=handHistoriesToSessionImports(hands as unknown as ParsedHandHistory[],batchId).flatMap(payload=>sessionImportToHistory(payload,options.importedAt));
 return{...parsed,hands,history,parsedHandIds:hands.map(hand=>hand.id),skippedHandIds,heroNames:[...new Set(parsed.hands.map(hand=>hand.heroName).filter((name):name is string=>Boolean(name)))],contexts:history.length};
}

export function detectMultiSiteHandHistorySite(text:string):MultiSiteHandHistorySite{return detectHandHistoryAdapterSite(text);}
