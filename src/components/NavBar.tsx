'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'

const LINKS = [
  { href: '/record',  label: 'record' },
  { href: '/entries', label: 'history' },
  { href: '/colors',  label: 'colors' },
]

interface NavBarProps {
  /** Override which label is shown as active (e.g. on /entries/[id] → 'history') */
  activeOverride?: string
}

export default function NavBar({ activeOverride }: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useClerk()

  const isActive = (href: string, label: string) => {
    if (activeOverride) return label === activeOverride
    return pathname === href || pathname?.startsWith(href + '/')
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/sign-in')
  }

  return (
    <nav
      className="fixed left-7 top-1/2 -translate-y-1/2 flex flex-col gap-12 px-4 py-12"
      style={{ fontFamily: '"DM Mono", monospace' }}
    >
      {LINKS.map(({ href, label }) => {
        const active = isActive(href, label)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 text-[16px] whitespace-nowrap transition-colors ${active ? 'text-black' : 'text-[#7f7f7f] hover:text-zinc-500'}`}
          >
            {active && <span className="w-2 h-2 rounded-full bg-black flex-shrink-0" />}
            {label}
          </Link>
        )
      })}

      <button
        onClick={handleSignOut}
        className="text-left text-[16px] whitespace-nowrap text-[#ff7480] hover:text-[#ff5560] transition-colors"
      >
        logout
      </button>
    </nav>
  )
}
