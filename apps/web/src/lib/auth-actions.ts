import { useNavigate } from 'react-router-dom'
import { api, clearTokens, getRefreshToken } from './api'
import { useAuth } from './stores/auth'

export function performLogout() {
  const refreshToken = getRefreshToken()
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
