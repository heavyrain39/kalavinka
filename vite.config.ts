import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0, rollupOptions: { output: { banner: '/*! Kalavinka - Copyright (C) 2026 Yakshawan. See LICENSE.txt and THIRD_PARTY_NOTICES.txt. */' } } },
});
