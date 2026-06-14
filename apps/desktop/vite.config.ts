import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function manualVendorChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("/@tiptap/") || id.includes("/prosemirror-")) return "vendor-editor";
  if (id.includes("/@radix-ui/")) return "vendor-radix";
  if (id.includes("/lucide-react/")) return "vendor-icons";
  if (id.includes("/@tanstack/") || id.includes("/zustand/")) return "vendor-state";
  return "vendor";
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: manualVendorChunk
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
