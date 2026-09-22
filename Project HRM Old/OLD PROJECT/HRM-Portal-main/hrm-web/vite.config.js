import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API is a separate project (../HRM). In development we proxy /api to it
// over plain HTTP, which sidesteps CORS and the self-signed HTTPS certificate.
// Ports come from HRM/Properties/launchSettings.json.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:5278'

export default defineConfig({
    plugins: [react()],

    server: {
        port: 5173,

        watch: {
            ignored: ['**/.vs/**'],
        },

        proxy: {
            '/api': {
                target: API_TARGET,
                changeOrigin: true,
                secure: false,
            },
        },
    },
})