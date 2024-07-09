import { defineConfig, PluginOption } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

import manifest from './src/manifest'

// vite plugin for ?compiled&raw
function compiledRawPlugin() {
  const compiledChunkIds = []

  const codeMap: Record<string, string> = {}

  return [
    {
      name: 'replace-virtual-module',
      enforce: 'pre',
      apply: 'build',
      transform(_, id) {
        if (id.includes('?compiled&raw')) {
          const targetId = id.replace('?compiled&raw', '')
          console.log('replace-compiled-raw', id, '=>', targetId)
          // mark target module as compiled
          compiledChunkIds.push(targetId)
          this.emitFile({
            id: targetId,
            type: 'chunk',
          })
          return `const rawContent = \`RAW_CONTENT_${targetId}\`;

export default rawContent`
        }
      },
      renderChunk(code, chunk) {
        if (compiledChunkIds.includes(chunk.facadeModuleId)) {
          // store compiled code
          codeMap[chunk.facadeModuleId] = code
        }
      },
      generateBundle(_, bundle) {
        Object.values(bundle).forEach((chunk) => {
          if (chunk.type === 'chunk' && chunk.code.includes('RAW_CONTENT_')) {
            chunk.code = chunk.code.replace(/"RAW_CONTENT_([^"]+)"/g, (_, id) => {
              // replace raw content with compiled code
              return codeMap[id] ? JSON.stringify(codeMap[id]) : '""'
            })
          }
        })
      },
    },
  ] as PluginOption[]
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: 'build',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/chunk-[hash].js',
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    plugins: [crx({ manifest }), compiledRawPlugin(), react()],
  }
})
