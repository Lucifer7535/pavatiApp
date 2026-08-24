import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script')))
      return
    }
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google script'))
    document.head.appendChild(script)
  })
}

interface Props {
  clientId: string
  onCredential: (credential: string) => void
  onError?: () => void
}

export default function GoogleSignInButton({ clientId, onCredential, onError }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const credentialRef = useRef(onCredential)
  const errorRef = useRef(onError)
  credentialRef.current = onCredential
  errorRef.current = onError

  useEffect(() => {
    let cancelled = false
    loadGsiScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) credentialRef.current(response.credential)
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 160,
        })
      })
      .catch(() => errorRef.current?.())
    return () => {
      cancelled = true
    }
  }, [clientId])

  return <div ref={buttonRef} className="flex justify-center" />
}
