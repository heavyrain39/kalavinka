declare module '@strudel/core/timespan.mjs' {
  export class TimeSpan {
    constructor(begin: number, end: number);
    begin: { valueOf(): number }; end: { valueOf(): number };
    intersection(other: TimeSpan): TimeSpan | undefined;
  }
}
declare module '@strudel/core/hap.mjs' {
  import { TimeSpan } from '@strudel/core/timespan.mjs';
  export class Hap {
    constructor(whole: TimeSpan, part: TimeSpan, value: unknown);
    whole: TimeSpan; part: TimeSpan; value: any; duration: { valueOf(): number };
    hasOnset(): boolean;
  }
}
declare module '@strudel/core/pattern.mjs' {
  import { TimeSpan } from '@strudel/core/timespan.mjs';
  import { Hap } from '@strudel/core/hap.mjs';
  export class Pattern {
    constructor(query: (state: { span: TimeSpan }) => Hap[]);
    queryArc(begin: number, end: number): Hap[];
  }
}
declare module '@strudel/core/cyclist.mjs' {
  import { Pattern } from '@strudel/core/pattern.mjs';
  import { Hap } from '@strudel/core/hap.mjs';
  export class Cyclist {
    constructor(options: { getTime: () => number; onTrigger: (hap: Hap, deadline: number, duration: number, cps: number, time: number) => void;
      onError?: (error: unknown) => void; interval?: number; latency?: number;
      setInterval?: (callback: () => void, ms: number) => number; clearInterval?: (id: number) => void });
    started: boolean; pattern: Pattern; cps: number;
    setPattern(pattern: Pattern): Promise<void>; setCps(cps: number): void;
    start(): Promise<void>; stop(): void; now(): number;
  }
}
declare module '*?url' { const url: string; export default url; }
