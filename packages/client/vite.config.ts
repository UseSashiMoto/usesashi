import typescript from "@rollup/plugin-typescript"
import react from "@vitejs/plugin-react"
import path from "path"
import {typescriptPaths} from "rollup-plugin-typescript-paths"
import {defineConfig} from "vite"

export default defineConfig({
    plugins: [react()],
    define: {
        "process.env.NODE_ENV": JSON.stringify("production")
    },
    build: {
        minify: true,
        reportCompressedSize: true,
        lib: {
            entry: path.resolve(__dirname, "src/main.tsx"),
            name: "Sashi Client",
            fileName: "main",
            formats: ["cjs", "es"]
        },
        rollupOptions: {
            plugins: [
                typescriptPaths({
                    preserveExtensions: true
                }),
                typescript({
                    sourceMap: false,
                    declaration: true,
                    outDir: "dist"
                })
            ]
        }
    }
})
