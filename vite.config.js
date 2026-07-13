import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/daily-scheduler-app/",
  plugins: [react()],
});
