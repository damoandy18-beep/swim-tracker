import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change 'swim-tracker' to your GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: '/swim-tracker/',
})
