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
        minify: false,
        terserOptions: {
            compress: false,
            mangle: false
        },
        reportCompressedSize: true,
        lib: {
            entry: path.resolve(__dirname, "src/main.ts"),
            name: "Sashi UI",
            fileName: "main",
            formats: ["cjs", "es"]
        },
        rollupOptions: {
            external: ["react", "react-dom"],
            plugins: [
                typescriptPaths({
                    preserveExtensions: true
                }),
                typescript({
                    sourceMap: true,
                    declaration: true,
                    outDir: "dist"
                })
            ]
        }
    }
})
