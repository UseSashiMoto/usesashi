import {defineConfig} from "tsup"

const isProduction = process.env.NODE_ENV === "production"

export default defineConfig([
    {
        clean: true,
        dts: true,
        entry: ["src/index.ts"],
        format: ["cjs", "esm"],
        minify: isProduction,
        sourcemap: true
    },
    {
        entry: ["src/frontend/index.tsx"], // Client-side entry point
        outDir: "dist/client",
        format: ["esm"],
        minify: isProduction,
        sourcemap: !isProduction,
        target: "es6", // Ensures compatibility with modern browsers
        outExtension: () => ({js: ".js"}),
        bundle: true, // Bundle all dependencies into the final file
        splitting: false, // Disable code splitting to keep it in one file
        external: [] // Don't mark anything as external, bundle everything
    }
])
