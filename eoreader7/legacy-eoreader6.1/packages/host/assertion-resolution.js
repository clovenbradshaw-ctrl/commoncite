// Adversarial assertion resolution: attack what the reader thinks it knows
// using the material it has already read before asking for outside evidence.
// This is resolution, not binary fact checking: a defeated assertion may
// split, re-scope, merge, reverse, or remain unresolved.

import { resolveRelations } from './graph.js';
import { sessionReferents } from './corpus.js';
import { sessionTerrains } from './terrains.js';

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = x => new Set(norm(x).split(/\s+/).filter(Boolean));
const overlap = (a,b) => { const A=tokens(a), B=tokens(b); let n=0; for(const x of A) if(B.has(x)) n++; return n; };
const scopeKey = s => s ? `${s.start ?? '?'}..${s.end ?? '?'}` : 'global';

const sectionFor = (sections, offset) => {
  if (!Number.isFinite(offset)) return null;
  let best=null;
  for (let i=0;i<sections.length;i++) { const s=sections[i]; if(offset >= s.byteStart && offset < s.byteEnd && (!best || s.byteEnd-s.byteStart < best.byteEnd-best.byteStart)) best={...s,index:i}; }
  return best ? freeze({index:best.index,label:best.label ?? best.heading ?? best.title ?? `section:${best.index}`,start:best.byteStart,end:best.byteEnd}) : null;
};

export function adversariallyResolveAssertions(session,{sourceId,priors=[]}={}) {
  if(!session) throw new TypeError('adversariallyResolveAssertions: session is required');
  const refs=sessionReferents(session,{sourceId,priors,limit:Infinity}).referents ?? [];
  const rels=resolveRelations(session,{sourceId,priors}).relations ?? [];
  const sections=sessionTerrains(session,{sourceId,priors}).terrains?.Field?.outline?.sections ?? [];
  const scoped=rels.map((r,i)=>({...r,_i:i,scope:sectionFor(sections,r.offset)}));
  const bySubject=new Map();
  for(const r of scoped){ const k=String(r.subject); if(!bySubject.has(k)) bySubject.set(k,[]); bySubject.get(k).push(r); }

  const cast=[];
  for(const ref of refs){
    const surfaces=(ref.surfaces??[]).map(s=>typeof s==='string'?s:s?.surface).filter(Boolean);
    const attacks=[];
    // Attack 1: can this alleged being be another discovered being?
    const rivals=refs.filter(x=>x!==ref).map(other=>({other,score:Math.max(overlap(ref.display,other.display),...surfaces.flatMap(s=>(other.surfaces??[]).map(o=>overlap(s,typeof o==='string'?o:o?.surface)))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(rivals.length) attacks.push(freeze({type:'identity_collision',rivals:freeze(rivals.slice(0,8).map(x=>({id:x.other.id,display:x.other.display,lexicalOverlap:x.score})))}));

    // Attack 2: do this referent's own surfaces imply multiple incompatible
    // relational neighbourhoods? If so, preserve ambiguity rather than SYN.
    const own=bySubject.get(String(ref.id)) ?? [];
    const perScope=new Map();
    for(const r of own){ const k=scopeKey(r.scope); if(!perScope.has(k)) perScope.set(k,new Set()); perScope.get(k).add(`${r.verb}\u0000${r.object}`); }
    if(perScope.size>1) attacks.push(freeze({type:'temporal_scope',scopes:freeze([...perScope].map(([scope,claims])=>({scope,claimCount:claims.size})))}));

    const ambiguousSurface=surfaces.filter(s=>refs.some(o=>o!==ref && (o.surfaces??[]).some(os=>norm(typeof os==='string'?os:os?.surface)===norm(s))));
    let disposition='survives';
    if(ambiguousSurface.length) disposition='unresolved_identity';
    else if(rivals.some(r=>r.score>=2)) disposition='needs_identity_attack';
    else if(perScope.size>1) disposition='survives_scoped';
    cast.push(freeze({kind:'Entity',referent:ref.id,display:ref.display,surfaces:freeze(surfaces),disposition,attacks:freeze(attacks)}));
  }

  const links=[];
  const groups=new Map();
  for(const r of scoped){ const k=`${r.subject}\u0000${r.verb}`; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r); }
  for(const r of scoped){
    const peers=groups.get(`${r.subject}\u0000${r.verb}`) ?? [];
    const competing=peers.filter(p=>p._i!==r._i && String(p.object)!==String(r.object));
    const opposed=peers.filter(p=>p._i!==r._i && String(p.object)===String(r.object) && p.polarity!==r.polarity);
    const sameScopeCompeting=competing.filter(p=>scopeKey(p.scope)===scopeKey(r.scope));
    let disposition='survives';
    if(opposed.length) disposition='polarity_contested';
    else if(sameScopeCompeting.length) disposition='nonfunctional_or_underdetermined';
    else if(competing.length) disposition='scope_split';
    links.push(freeze({kind:'Link',assertion:freeze({subject:r.subject,predicate:r.verb,object:r.object,polarity:r.polarity,scope:r.scope,offset:r.offset}),disposition,perturbations:freeze({oppositePolarity:opposed.map(p=>p.offset),competingObject:competing.slice(0,20).map(p=>({object:p.object,scope:p.scope,offset:p.offset})),scopeSplit:competing.some(p=>scopeKey(p.scope)!==scopeKey(r.scope))})}));
  }

  const summary={
    castAssertions:cast.length, linkAssertions:links.length,
    cast:[...new Set(cast.map(x=>x.disposition))].reduce((o,k)=>(o[k]=cast.filter(x=>x.disposition===k).length,o),{}),
    links:[...new Set(links.map(x=>x.disposition))].reduce((o,k)=>(o[k]=links.filter(x=>x.disposition===k).length,o),{}),
  };
  return freeze({schema:'AdversarialAssertionResolution@1',sourceId,summary:freeze(summary),cast:freeze(cast),links:freeze(links)});
}
