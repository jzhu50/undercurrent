'use client'

import { useClerk, useSignIn, useSignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function SSOCallbackPage() {
  const clerk = useClerk()
  const { signIn } = useSignIn()
  const { signUp } = useSignUp()
  const router = useRouter()
  const hasRun = useRef(false)

  useEffect(() => {
    ;(async () => {
      if (!clerk.loaded || hasRun.current) return
      hasRun.current = true

      const navigate = async ({ decorateUrl }: { session?: unknown; decorateUrl: (url: string) => string }) => {
        fetch('/api/user').catch(() => {})
        const url = decorateUrl('/record')
        window.location.href = url.startsWith('http')
          ? url
          : `${window.location.origin}${url}`
      }

      // Sign-in complete
      if (signIn.status === 'complete') {
        await signIn.finalize({ navigate })
        return
      }

      // Sign-up used existing account → transfer to sign-in
      if (signUp.isTransferable) {
        await signIn.create({ transfer: true })
        if ((signIn.status as string) === 'complete') {
          await signIn.finalize({ navigate })
        } else {
          router.push('/sign-in')
        }
        return
      }

      // Sign-in used new account → transfer to sign-up
      if (signIn.isTransferable) {
        await signUp.create({ transfer: true })
        if (signUp.status === 'complete') {
          await signUp.finalize({ navigate })
        } else {
          router.push('/sign-up')
        }
        return
      }

      // Sign-up complete
      if (signUp.status === 'complete') {
        await signUp.finalize({ navigate })
        return
      }

      // Existing session
      const sessionId = signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId
      if (sessionId) {
        await clerk.setActive({ session: sessionId, navigate })
        return
      }

      router.push('/sign-in')
    })()
  }, [clerk, signIn, signUp, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div id="clerk-captcha" />
      <div className="w-8 h-8 border-2 border-[#a8abfc] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
