import path from "path"
import { defineConfig } from "tsup"

export default defineConfig({
    entry: ['src/**/*.ts'],
    format: ['cjs'],
    outDir : 'dist',
    sourcemap : true,
    clean : true,
    // dts : true,
    target : 'es2022',
    splitting : false,
    define :  {
        __APP__DIRNAME__ : JSON.stringify(path.resolve('./'))
    }
})