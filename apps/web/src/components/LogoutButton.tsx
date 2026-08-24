import { LogOut } from 'lucide-react'
import { useLogout } from '../lib/auth-actions'

export default function LogoutButton() {
  const logout = useLogout()
  return (
    <button onClick={logout} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600">
      <LogOut className="h-4 w-4" /> Log out
    </button>
  )
}
