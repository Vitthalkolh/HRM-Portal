import axios from 'axios'

// In development this stays '/api' and Vite proxies it to the .NET project
// (see vite.config.js). For a deployed build, set VITE_API_BASE_URL to the
// full API URL, e.g. https://hrm-api.company.com/api
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const TOKEN_KEY = 'hrm.token'
export const USER_KEY = 'hrm.user'

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// A 401 means the token expired or was revoked: drop it and bounce to login.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)

      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

/** Pulls the API's { Message } out of an axios error. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) return data
  if (data?.message) return data.message
  if (data?.Message) return data.Message

  // ASP.NET model-validation payload
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0]
    if (first) return first
  }

  if (error?.message === 'Network Error') {
    return 'Cannot reach the API. Is it running, and is its certificate trusted?'
  }

  return fallback
}

export default client
