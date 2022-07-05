import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import {ElementPlusResolver} from 'unplugin-vue-components/resolvers'
import {resolve} from 'path'
import AutoImport from 'unplugin-auto-import/vite'
// https://vitejs.dev/config/
export default defineConfig({
  
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue'],
      dts: false // 使用静态编写好的类型，不自动生成
    }),
    Components({
      resolvers:[ElementPlusResolver()]
    })
  ],
  resolve:{
    alias:{
      '@':resolve(__dirname,'src')
    }
  },
  server:{
    proxy:{
      '/api/':{
        target:'http://localhost:7001',
        changeOrigin:true,
        rewrite: (path) =>  {
          console.log(path)
          return path.replace(/^\/api/,'')
        }
      }
    }
  }
  
})
