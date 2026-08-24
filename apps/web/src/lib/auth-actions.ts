import { useNavigate } from 'react-router-dom'
import { api, clearTokens } from './api'
import { useAuth } from './stores/auth'

export function performLogout() {
  const refreshToken = localStorage.getItem('pp_refresh')
  if (refreshToken) {
    api.post('/auth/logout', { refreshToken }).catch(() => {})
  }
  clearTokens()
  useAuth.getState().logout()
}

export function useLogout() {
  const navigate = useNavigate()
  return () => {
    performLogout()
    navigate('/login')
  }
}
