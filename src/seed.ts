// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
export function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return value >>> 0;
}
export const random = (seed: string, label: string) => hash(`${seed}:${label}`) / 4294967296;
export function newSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(bytes, (n) => chars[n % chars.length]).join('');
}
