import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the app icons (PWA, maskable, Apple touch, favicon) from public/logo.svg:
// npx pwa-assets-generator
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
})
