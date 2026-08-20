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
import { api } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
})

setLocale(getLocale())

api.get<{ user: any; memberships: any[] }>('/auth/me').then((data) => {
  useAuth.getState().setSession(data)
  render()
}).catch(() => render())

let rendered = false
function render() {
  if (rendered) return
  rendered = true
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )
}