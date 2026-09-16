const DEV_TOKEN_KEY = 'pp_dev_token'

export function getDevToken(): string | null {
  return localStorage.getItem(DEV_TOKEN_KEY)
}

export function setDevToken(token: string) {
  localStorage.setItem(DEV_TOKEN_KEY, token)
}

export function clearDevToken() {
  localStorage.removeItem(DEV_TOKEN_KEY)
}