// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {ProfileId} from './music';

export const MAX_FAVORITE_NUMBER = 999;
export function validFavoriteNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= MAX_FAVORITE_NUMBER;
}
export function normalizeFavoriteCounter(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) > 0 ? (Number(value)-1)%MAX_FAVORITE_NUMBER+1 : 0;
}
export function nextFavoriteNumber(counter: number, used: ReadonlySet<number>): number {
  let candidate=normalizeFavoriteCounter(counter);
  for(let i=0;i<MAX_FAVORITE_NUMBER;i++){
    candidate=candidate%MAX_FAVORITE_NUMBER+1;
    if(!used.has(candidate))return candidate;
  }
  throw new Error('FAVORITE_NUMBERS_EXHAUSTED');
}

/** Items are newest first. Preserve every valid label; the oldest duplicate keeps its label. */
export function reconcileFavoriteNumbers<T extends {number:number;settings:{profile:ProfileId}}>(items:T[],rawCounters:Partial<Record<ProfileId,unknown>>|undefined):Record<ProfileId,number>{
  const counters={lofi:0,ambient:0,dub:0};
  for(const profile of ['lofi','ambient','dub'] as const){
    const group=items.filter(item=>item.settings.profile===profile);
    counters[profile]=normalizeFavoriteCounter(rawCounters?.[profile])||group.find(item=>validFavoriteNumber(item.number))?.number||0;
    const reserved=new Set(group.filter(item=>validFavoriteNumber(item.number)).map(item=>item.number));
    const seen=new Set<number>();
    for(const item of [...group].reverse()){
      if(!validFavoriteNumber(item.number)||seen.has(item.number)){
        item.number=nextFavoriteNumber(counters[profile],reserved);
        counters[profile]=item.number;reserved.add(item.number);
      }
      seen.add(item.number);
    }
  }
  return counters;
}
