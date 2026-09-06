import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/mukta/400.css'
import '@fontsource/mukta/500.css'
import '@fontsource/mukta/600.css'
import '@fontsource/mukta/700.css'
import './styles/index.css'
import { router } from './app/router'
import { setLocale, getLocale } from './lib/i18n'
import { useAuth } from './lib/stores/auth'
import { api, getRefreshToken } from './lib/api'
import { ErrorBoundary } from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
})

setLocale(getLocale())

async function loadSession(attempt = 0) {
  try {
    const data = await api.get<{ user: any; memberships: any[] }>('/auth/me')
    useAuth.getState().setSession(data)
  } catch {
    if (attempt < 2 && getRefreshToken()) {
      await new Promise((r) => setTimeout(r, 750 * (attempt + 1)))
      return loadSession(attempt + 1)
    }
  }
  render()
}
loadSession()

let rendered = false
function render() {
  if (rendered) return
  rendered = true
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}