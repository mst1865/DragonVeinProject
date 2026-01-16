import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 捕获所有以 /api 开头的请求
      '/api': {
        target: 'http://localhost:5000', // 这里填你后端实际运行的地址 (注意 http/https)
        changeOrigin: true,
        secure: false, // 如果后端是 https 自签名证书，需要设为 false
        // rewrite: (path) => path.replace(/^\/api/, '') // 如果后端路由不包含 /api 前缀则开启此行，你的后端代码有 [Route("api/[controller]")] 所以不需要
      }
    }
  }
})