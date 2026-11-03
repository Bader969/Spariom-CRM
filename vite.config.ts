import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  envPrefix: ["VITE_", "SUPABASE_", "NEXT_PUBLIC_"],
  plugins: [
    tanstackStart({
      server: { 
        entry: "server",
      },
    }),
    nitro({
      preset: "vercel"
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: 3000,
  },
});
