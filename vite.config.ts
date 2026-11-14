import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0, rollupOptions: { input: { main: 'index.html', ko: 'ko/index.html' }, output: { banner: '/*! Kalavinka - Copyright (C) 2026 Yakshawan. See LICENSE.txt and THIRD_PARTY_NOTICES.txt. */' } } },
});
