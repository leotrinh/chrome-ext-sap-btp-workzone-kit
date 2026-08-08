import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/sidepanel",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
