import { defineConfig } from "vite"

export default defineConfig({
  server: {
    host: true,
    // Cross-origin isolation headers enable WebGPU / multi-threaded WASM for transformers.js
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  // transformers.js is large and dynamically imported; do not pre-bundle it eagerly
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  build: {
    target: "esnext",
  },
})
