import { TournamentFieldSnapshot, TournamentMetadataV1, validateTournamentMetadata } from './tournamentReconstruction';

export interface TournamentLobbyCsvMapping {
  tournamentId:string; handId:string; playersRemaining:string; playerId:string; stack:string; bounty?:string;
  generatedAt:string; reference:string; methodology:string; utilityUnit:string; payoutVectorJson:string; tournamentName?:string;
}
export const NORMALIZED_TOURNAMENT_LOBBY_MAPPING:TournamentLobbyCsvMapping={tournamentId:'tournament_id',handId:'hand_id',playersRemaining:'players_remaining',playerId:'player_id',stack:'stack',bounty:'bounty',generatedAt:'generated_at',reference:'reference',methodology:'methodology',utilityUnit:'utility_unit',payoutVectorJson:'payout_vector_json',tournamentName:'tournament_name'};

function parseCsv(text:string):Record<string,string>[]{const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.length))rows.push(row);row=[];}else cell+=ch;}row.push(cell);if(row.some(v=>v.length))rows.push(row);if(quoted)throw new Error('Tournament CSV has unterminated quote.');if(rows.length<2)return[];const headers=rows[0].map(v=>v.trim());return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));}
function req(row:Record<string,string>,column:string,label=column){const v=row[column]?.trim();if(!v)throw new Error(`Tournament CSV missing ${label} (${column}).`);return v;}
function opt(row:Record<string,string>,column?:string){const v=column?row[column]?.trim():'';return v||undefined;}
function finite(value:string,label:string){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error(`${label} must be a non-negative number.`);return n;}

/** Converts a full-field lobby/snapshot export to reusable P12/P15 tournament metadata. */
export function tournamentLobbyCsvToMetadata(csv:string,mapping:TournamentLobbyCsvMapping=NORMALIZED_TOURNAMENT_LOBBY_MAPPING):TournamentMetadataV1[]{
 const rows=parseCsv(csv);if(!rows.length)throw new Error('Tournament lobby CSV has no rows.');
 const tournaments=new Map<string,{base:Omit<TournamentMetadataV1,'snapshots'>;snapshots:Map<string,TournamentFieldSnapshot>}>();
 for(const row of rows){const tournamentId=req(row,mapping.tournamentId),handId=req(row,mapping.handId),playersRemaining=Number(req(row,mapping.playersRemaining));if(!Number.isInteger(playersRemaining)||playersRemaining<2)throw new Error(`${tournamentId}:${handId} players_remaining is invalid.`);const playerId=req(row,mapping.playerId),stack=finite(req(row,mapping.stack),'stack'),bountyRaw=opt(row,mapping.bounty),generatedAt=req(row,mapping.generatedAt),reference=req(row,mapping.reference),methodology=req(row,mapping.methodology),unit=req(row,mapping.utilityUnit) as TournamentMetadataV1['utilityUnit'];if(!Number.isFinite(Date.parse(generatedAt)))throw new Error(`${tournamentId}: invalid generated_at.`);let payouts:unknown;try{payouts=JSON.parse(req(row,mapping.payoutVectorJson));}catch{throw new Error(`${tournamentId}: payout_vector_json must be JSON.`);}if(!Array.isArray(payouts))throw new Error(`${tournamentId}: payout vector must be an array.`);
  let entry=tournaments.get(tournamentId);if(!entry){entry={base:{schemaVersion:1,tournamentId,name:opt(row,mapping.tournamentName),generatedAt,reference,methodology,payouts:payouts.map(v=>finite(String(v),'payout')),utilityUnit:unit},snapshots:new Map()};tournaments.set(tournamentId,entry);}else{if(JSON.stringify(entry.base.payouts)!==JSON.stringify(payouts)||entry.base.reference!==reference||entry.base.utilityUnit!==unit)throw new Error(`${tournamentId}: rows disagree on tournament-level provenance/payouts.`);}
  let snap=entry.snapshots.get(handId);if(!snap){snap={handId,playersRemaining,players:[],bounties:bountyRaw!==undefined?{}:undefined};entry.snapshots.set(handId,snap);}if(snap.playersRemaining!==playersRemaining)throw new Error(`${tournamentId}:${handId} rows disagree on players_remaining.`);if(snap.players.some(p=>p.id===playerId))throw new Error(`${tournamentId}:${handId} duplicate player ${playerId}.`);snap.players.push({id:playerId,stack});if(bountyRaw!==undefined){snap.bounties||={};snap.bounties[playerId]=finite(bountyRaw,'bounty');}
 }
 return[...tournaments.values()].map(entry=>validateTournamentMetadata({...entry.base,snapshots:[...entry.snapshots.values()]}));
}

export interface ParsedTournamentSummary { tournamentId:string; name?:string; payouts:number[]; currency?:string; reference:string; methodology:string; generatedAt:string; }

/**
 * Conservative PokerStars-style summary parser. It extracts only explicit finishing-place prize lines;
 * it never invents stack snapshots or players remaining.
 */
export function parsePokerStarsTournamentSummary(text:string,provenance:{reference:string;generatedAt?:string}):ParsedTournamentSummary{
 const id=text.match(/PokerStars\s+Tournament\s+#?([A-Za-z0-9_-]+)/i)?.[1]||text.match(/Tournament\s+#([A-Za-z0-9_-]+)/i)?.[1];if(!id)throw new Error('Tournament summary does not contain a tournament ID.');
 const name=text.match(/Tournament\s+#?[A-Za-z0-9_-]+,?\s*([^\n]+)/i)?.[1]?.trim();const prizes:number[]=[];let currency:string|undefined;
 for(const line of text.split(/\r?\n/)){const match=line.match(/^\s*\d+(?:st|nd|rd|th)?\s*[:.-]\s*.+?\s+(?:won|received)?\s*([$€£])?\s*([0-9][0-9,]*(?:\.\d+)?)\s*$/i);if(!match)continue;prizes.push(Number(match[2].replace(/,/g,'')));currency ||= match[1];}
 if(!prizes.length)throw new Error('Tournament summary contains no explicit finishing-place prize lines.');
 return{tournamentId:id,name,payouts:prizes,currency,reference:provenance.reference,methodology:'Parsed explicit finishing-place prize amounts from a PokerStars-style tournament summary; no stack state inferred.',generatedAt:provenance.generatedAt||new Date().toISOString()};
}

export function mergeTournamentSummaryWithSnapshots(summary:ParsedTournamentSummary,snapshotMetadata:TournamentMetadataV1,utilityUnit:TournamentMetadataV1['utilityUnit']='dollar-ev'):TournamentMetadataV1{
 if(summary.tournamentId!==snapshotMetadata.tournamentId)throw new Error('Summary and snapshot tournament IDs differ.');
 return validateTournamentMetadata({...snapshotMetadata,name:snapshotMetadata.name||summary.name,generatedAt:summary.generatedAt,reference:`${summary.reference} + ${snapshotMetadata.reference}`,methodology:`${summary.methodology} ${snapshotMetadata.methodology}`,payouts:summary.payouts,utilityUnit});
}
