import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // SECURITY: Remove source maps in production
    sourcemap: false,
    // SECURITY: Use terser for advanced minification
    minify: 'terser',
    terserOptions: {
      compress: {
        // SECURITY: Strip all console output in production
        drop_console: mode === 'production',
        drop_debugger: true,
        pure_funcs: mode === 'production'
          ? ['console.log', 'console.info', 'console.debug', 'console.table']
          : [],
        // Dead code elimination
        dead_code: true,
        // Collapse single-use variables
        collapse_vars: true,
        // Remove unreachable code
        unused: true,
      },
      mangle: {
        // SECURITY: Aggressively rename all variables
        toplevel: true,
        safari10: true,
        properties: {
          // Only mangle internal properties starting with _
          regex: /^_/,
        },
      },
      format: {
        // SECURITY: Strip ALL comments including copyright headers in output
        comments: false,
        // Minify as much as possible
        beautify: false,
        // Remove semicolons where possible
        semicolons: false,
      },
    },
    rollupOptions: {
      output: {
        // SECURITY: Randomized filenames — can't guess file structure
        chunkFileNames: 'assets/m-[hash].js',
        entryFileNames: 'assets/m-[hash].js',
        assetFileNames: 'assets/m-[hash].[ext]',
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          'vendor-utils': ['date-fns', 'zod', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // SECURITY: Set chunk size warning — keep bundles reasonable
    chunkSizeWarningLimit: 800,
  },
}));