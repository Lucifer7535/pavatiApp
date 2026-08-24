export default function AppLogo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-maroon-700 ${className}`}>
      <img src="/logo.png" alt="Pāvati Pustak logo" className="h-full w-full object-cover" />
    </div>
  )
}
