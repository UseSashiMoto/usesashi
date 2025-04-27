import { defineConfig } from "tsup"

const isProduction = process.env.NODE_ENV === "production"
const isWatch = process.argv.includes("--watch")

export default defineConfig([
    {
        clean: true,
        dts: true,
        entry: ["src/index.ts"],
        format: ["cjs", "esm"],
        minify: isProduction,
        sourcemap: true,
        watch: isWatch ? ["src/**/*.ts"] : false,
        onSuccess: isWatch
            ? "echo '✅ Build succeeded - watching for changes...'"
            : undefined
    }
])
