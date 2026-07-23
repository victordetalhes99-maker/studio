import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Configuração do Vite para SPA estática.
 *
 * Variáveis obrigatórias no ambiente de build (produção):
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY
 *
 * Em produção (Cloudflare Pages) essas variáveis DEVEM ser fornecidas pelo
 * painel. Sem elas o build falha de forma explícita — não usamos fallback
 * hardcoded para evitar publicar uma aplicação silenciosamente quebrada
 * ou vazar credenciais no repositório.
 */
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isBuild = command === "build";
  const isProd = mode === "production";

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (isBuild && isProd) {
    const missing: string[] = [];
    if (!url) missing.push("VITE_SUPABASE_URL");
    if (!key) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY");
    if (missing.length) {
      throw new Error(
        `[vite] Variáveis públicas ausentes no build de produção: ${missing.join(
          ", ",
        )}. Configure-as em Cloudflare Pages → Settings → Environment variables ` +
          `(também precisam estar disponíveis no Preview environment) antes de publicar.`,
      );
    }
  }

  return {
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    server: {
      host: "::",
      port: 8080,
      strictPort: false,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "es2020",
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            query: ["@tanstack/react-query"],
          },
        },
      },
    },
  };
});
