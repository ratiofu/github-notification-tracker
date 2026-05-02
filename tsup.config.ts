import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  entry: {
    cli: "src/cli/index.ts",
  },
  format: ["esm"],
  minify: false,
  outDir: "dist",
  platform: "node",
  shims: false,
  sourcemap: true,
  splitting: false,
  target: "node25",
  treeshake: true,
});
