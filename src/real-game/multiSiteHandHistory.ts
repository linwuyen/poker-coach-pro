import { HandHistorySite, ParsedHandHistory, parseHandHistoryText } from './handHistory';
import { HandHistoryAdapterSite, detectHandHistoryAdapterSite, normalizeMultiSiteHandHistoryText } from './handHistoryAdapters';

export type MultiSiteHandHistorySite = Exclude<HandHistoryAdapterSite,'generic'> | 'generic';

function sourceFromRaw(raw:string,parsed:HandHistorySite):MultiSiteHandHistorySite{
 const marker=raw.match(/^#\s*PCP_SOURCE:([a-z0-9-]+)/mi)?.[1] as MultiSiteHandHistorySite|undefined;
 return marker||parsed;
}

export interface MultiSiteParseResult {
  hands: Array<ParsedHandHistory & { source: MultiSiteHandHistorySite }>;
  detectedSites: MultiSiteHandHistorySite[];
  normalizedText: string;
  rejectedBlocks: number;
}

/**
 * P25 facade: site-specific syntax is normalized first, then every hand goes through the same
 * conservative ParsedHandHistory/replay contract used by PokerStars/GG. No site receives a looser truth path.
 */
export function parseMultiSiteHandHistoryText(text:string,heroOverride?:string):MultiSiteParseResult{
 const normalizedText=normalizeMultiSiteHandHistoryText(text);
 const expectedBlocks=normalizedText.trim()?normalizedText.split(/\n\s*\n(?=PokerStars Hand|Poker Hand)/i).length:0;
 const parsed=parseHandHistoryText(normalizedText,heroOverride).map(hand=>({...hand,source:sourceFromRaw(hand.raw,hand.source)}));
 const detectedSites=[...new Set(parsed.map(hand=>hand.source))];
 return{hands:parsed,detectedSites,normalizedText,rejectedBlocks:Math.max(0,expectedBlocks-parsed.length)};
}

export function detectMultiSiteHandHistorySite(text:string):MultiSiteHandHistorySite{return detectHandHistoryAdapterSite(text);}
