import { FgsProbabilityEvidence, TournamentRangeEvidence, validateFgsProbabilityEvidence, validateTournamentRangeEvidence } from './tournamentDecisionEvidence';

export type TournamentEvidenceProviderKind = 'verified-solver' | 'validated-population' | 'user-supplied-model';

export interface TournamentEvidenceProviderDescriptor {
  id:string;
  version:string;
  kind:TournamentEvidenceProviderKind;
  reference:string;
  generatedAt:string;
  methodology:string;
  capabilities:Array<'range'|'fgs-probabilities'>;
}
export interface TournamentRangeRequest { handId:string;heroCards:string[];board:string[];contextKey:string; }
export interface TournamentFgsRequest { handId:string;contextKey:string;edgeKeys:string[]; }
export interface TournamentEvidenceProvider {
  descriptor:TournamentEvidenceProviderDescriptor;
  provideRange?:(request:TournamentRangeRequest)=>Promise<TournamentRangeEvidence|undefined>|TournamentRangeEvidence|undefined;
  provideFgsProbabilities?:(request:TournamentFgsRequest)=>Promise<FgsProbabilityEvidence|undefined>|FgsProbabilityEvidence|undefined;
}
export interface StaticTournamentEvidenceProviderEnvelope {schemaVersion:1;descriptor:TournamentEvidenceProviderDescriptor;ranges?:TournamentRangeEvidence[];fgsProbabilities?:FgsProbabilityEvidence[];}
export interface ProviderResolution<T> { status:'unavailable'|'resolved'|'ambiguous';evidence?:T;providerKey?:string;candidateProviderKeys:string[];reasons:string[]; }

function providerKey(provider:TournamentEvidenceProvider){return`${provider.descriptor.id}@${provider.descriptor.version}`;}
export function validateTournamentEvidenceProvider(provider:TournamentEvidenceProvider):TournamentEvidenceProvider{
 const d=provider?.descriptor;if(!d||!d.id||!d.version||!d.reference||!d.methodology||!Number.isFinite(Date.parse(d.generatedAt))||!Array.isArray(d.capabilities)||!d.capabilities.length)throw new Error('Tournament evidence provider requires identity, provenance and capabilities.');
 if(!['verified-solver','validated-population','user-supplied-model'].includes(d.kind))throw new Error(`${d.id}: invalid provider kind.`);
 if(d.capabilities.includes('range')&&!provider.provideRange)throw new Error(`${d.id}: range capability requires provideRange.`);
 if(d.capabilities.includes('fgs-probabilities')&&!provider.provideFgsProbabilities)throw new Error(`${d.id}: FGS capability requires provideFgsProbabilities.`);
 return provider;
}
function uniqueProviders(providers:TournamentEvidenceProvider[]){const keys=new Set<string>();return providers.map(validateTournamentEvidenceProvider).map(provider=>{const key=providerKey(provider);if(keys.has(key))throw new Error(`Duplicate tournament evidence provider ${key}.`);keys.add(key);return provider;});}

/** Serializable provider package for solver/population/user-model evidence exported outside the app. */
export function staticTournamentEvidenceProvider(raw:StaticTournamentEvidenceProviderEnvelope):TournamentEvidenceProvider{
 if(!raw||raw.schemaVersion!==1||!raw.descriptor)throw new Error('Invalid static tournament evidence provider envelope.');const ranges=(raw.ranges||[]).map(validateTournamentRangeEvidence),fgs=(raw.fgsProbabilities||[]).map(validateFgsProbabilityEvidence),descriptor=JSON.parse(JSON.stringify(raw.descriptor)) as TournamentEvidenceProviderDescriptor;
 const provider:TournamentEvidenceProvider={descriptor};
 if(descriptor.capabilities.includes('range'))provider.provideRange=request=>{const matches=ranges.filter(row=>row.handId===request.handId&&row.heroCards.join('|')===request.heroCards.join('|')&&row.board.join('|')===request.board.join('|'));if(matches.length>1)throw new Error(`${descriptor.id}: static range package has multiple records for the exact request.`);return matches[0];};
 if(descriptor.capabilities.includes('fgs-probabilities'))provider.provideFgsProbabilities=request=>{const expected=[...request.edgeKeys].sort().join('|'),matches=fgs.filter(row=>row.handId===request.handId&&row.edges.map(edge=>`${edge.parentId}->${edge.childId}`).sort().join('|')===expected);if(matches.length>1)throw new Error(`${descriptor.id}: static FGS package has multiple records for the exact request.`);return matches[0];};
 return validateTournamentEvidenceProvider(provider);
}

async function select<T>(candidates:Array<{provider:TournamentEvidenceProvider;evidence:T}>,preferredProviderId?:string):Promise<ProviderResolution<T>>{
 const keys=candidates.map(item=>providerKey(item.provider));
 if(preferredProviderId){const selected=candidates.filter(item=>item.provider.descriptor.id===preferredProviderId);if(selected.length===1)return{status:'resolved',evidence:selected[0].evidence,providerKey:providerKey(selected[0].provider),candidateProviderKeys:keys,reasons:[]};return{status:'unavailable',candidateProviderKeys:keys,reasons:[`Preferred provider ${preferredProviderId} did not return exactly one evidence record.`]};}
 if(candidates.length===1)return{status:'resolved',evidence:candidates[0].evidence,providerKey:providerKey(candidates[0].provider),candidateProviderKeys:keys,reasons:[]};
 if(candidates.length>1)return{status:'ambiguous',candidateProviderKeys:keys,reasons:['Multiple providers returned evidence. Select one explicitly; provider priority must not silently decide a material tournament input.']};
 return{status:'unavailable',candidateProviderKeys:[],reasons:['No provider returned evidence for this request.']};
}

export async function resolveTournamentRangeEvidence(providers:TournamentEvidenceProvider[],request:TournamentRangeRequest,preferredProviderId?:string):Promise<ProviderResolution<TournamentRangeEvidence>>{
 const candidates:Array<{provider:TournamentEvidenceProvider;evidence:TournamentRangeEvidence}>=[];
 for(const provider of uniqueProviders(providers)){if(!provider.descriptor.capabilities.includes('range')||!provider.provideRange)continue;const raw=await provider.provideRange(request);if(!raw)continue;const evidence=validateTournamentRangeEvidence(raw);if(evidence.handId!==request.handId)throw new Error(`${providerKey(provider)} returned range evidence for the wrong hand.`);if(evidence.heroCards.join('|')!==request.heroCards.join('|')||evidence.board.join('|')!==request.board.join('|'))throw new Error(`${providerKey(provider)} returned cards/board that do not match the request.`);candidates.push({provider,evidence});}
 return select(candidates,preferredProviderId);
}

export async function resolveTournamentFgsProbabilityEvidence(providers:TournamentEvidenceProvider[],request:TournamentFgsRequest,preferredProviderId?:string):Promise<ProviderResolution<FgsProbabilityEvidence>>{
 const candidates:Array<{provider:TournamentEvidenceProvider;evidence:FgsProbabilityEvidence}>=[];const expected=new Set(request.edgeKeys);
 for(const provider of uniqueProviders(providers)){if(!provider.descriptor.capabilities.includes('fgs-probabilities')||!provider.provideFgsProbabilities)continue;const raw=await provider.provideFgsProbabilities(request);if(!raw)continue;const evidence=validateFgsProbabilityEvidence(raw);if(evidence.handId!==request.handId)throw new Error(`${providerKey(provider)} returned FGS evidence for the wrong hand.`);const actual=new Set(evidence.edges.map(edge=>`${edge.parentId}->${edge.childId}`));if(actual.size!==expected.size||[...expected].some(key=>!actual.has(key)))throw new Error(`${providerKey(provider)} returned an FGS edge set that does not match the request.`);candidates.push({provider,evidence});}
 return select(candidates,preferredProviderId);
}
