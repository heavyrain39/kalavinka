// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
import type { Settings } from './music';
import { arrangementAt } from './arrangement';
import { hash } from './seed';
export function kickSteps(settings: Settings, bar: number): number[] {
  const a=arrangementAt(settings,bar), thin=a.section==='intro';
  if(a.beatless||a.section==='open')return [];
  if(settings.profile==='dub') {
    if(settings.groove==='dnb') {
      // A repeated two-bar break. Legacy scores retain their eighth-bar kick fill.
      if(thin)return [0,10];
      if(settings.generatorVersion<5&&a.localBar%8===7&&settings.energy>70)return [0,6,14];
      return a.localBar%2 ? [0,6,10] : [0,10];
    }
    return thin?[0,8]:[0,4,8,12];
  }
  const cells=[[0,8],[0,7,10],[0,6,11],[0,8,14],[0,5,10],[0,7,12]];
  const result=cells[(hash(`${settings.seed}:kick`)+Math.floor(bar%4/2)+a.variant+Math.floor(a.localBar/4)%2)%cells.length];
  return settings.energy<25||thin?result.slice(0,2):result;
}
