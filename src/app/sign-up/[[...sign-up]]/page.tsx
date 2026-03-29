'use client'

import '@fontsource/eb-garamond'
import { useSignUp, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const FRIENDLY: Record<string, string> = {
  form_identifier_exists:      'An account with this email already exists. Try logging in.',
  form_password_length_too_short: 'Password must be at least 8 characters.',
  too_many_requests:           'Too many attempts. Please wait a moment and try again.',
}

function GoogleLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29.44 16.32c0-1.01-.09-1.98-.25-2.91H16v5.51h7.54a6.44 6.44 0 0 1-2.79 4.23v3.52h4.52c2.64-2.43 4.17-6.01 4.17-10.35Z" fill="#4285F4"/>
      <path d="M16 30c3.78 0 6.95-1.25 9.27-3.39l-4.52-3.51c-1.25.84-2.85 1.34-4.75 1.34-3.65 0-6.74-2.46-7.84-5.77H3.49v3.62A14 14 0 0 0 16 30Z" fill="#34A853"/>
      <path d="M8.16 18.67A8.43 8.43 0 0 1 7.72 16c0-.93.16-1.83.44-2.67V9.71H3.49A14 14 0 0 0 2 16c0 2.26.54 4.4 1.49 6.29l4.67-3.62Z" fill="#FBBC05"/>
      <path d="M16 7.56c2.06 0 3.9.71 5.35 2.1l4.01-4.01C22.94 3.38 19.77 2 16 2A14 14 0 0 0 3.49 9.71l4.67 3.62C9.26 10.02 12.35 7.56 16 7.56Z" fill="#EA4335"/>
    </svg>
  )
}

export default function SignUpPage() {
  const { signUp, fetchStatus } = useSignUp()
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const loading = fetchStatus === 'fetching'
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isSignedIn === true) router.replace('/record')
  }, [isSignedIn, router])

  if (isSignedIn === true) return null

  async function handleSignUp(formData: FormData) {
    setErrorMsg(null)
    const emailAddress = formData.get('email') as string
    const password = formData.get('password') as string
    const { error } = await signUp.password({ emailAddress, password })
    if (error) {
      const codes = (error as unknown as { errors?: { code?: string }[] })?.errors?.map(e => e.code ?? '').filter(c => c !== 'form_password_pwned') ?? []
      if (codes.length > 0) {
        const msg = codes.map(c => FRIENDLY[c]).find(Boolean) ?? 'Something went wrong. Please try again.'
        setErrorMsg(msg)
      }
      return
    }
    if (signUp.status === 'complete') {
      router.push('/sign-in')
    } else {
      await signUp.verifications.sendEmailCode()
    }
  }

  async function handleVerify(formData: FormData) {
    setErrorMsg(null)
    const code = formData.get('code') as string
    await signUp.verifications.verifyEmailCode({ code })
    if (signUp.status === 'complete') router.push('/sign-in')
    else setErrorMsg('Could not verify code. Please try again.')
  }

  const isVerifying =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ backgroundImage: 'url(/paper-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/75" />

      <div className="relative z-10 flex flex-col items-center gap-16 w-[360px] px-4">
        {/* Title */}
        <div className="flex flex-col items-center">
          <h1 style={{ fontFamily: '"EB Garamond", Garamond, serif', fontSize: 48, lineHeight: 1 }} className="text-black font-normal">
            sign up
          </h1>
        </div>

        {!isVerifying ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSignUp(new FormData(e.currentTarget)) }} className="flex flex-col gap-10 w-full">
            <input
              name="email"
              type="email"
              placeholder="EMAIL"
              required
              className="bg-transparent border-0 border-b border-zinc-300 pb-1 text-[14px] text-zinc-400 placeholder-[#b8b8b8] outline-none focus:border-zinc-500 w-full"
              style={{ fontFamily: '"DM Mono", monospace' }}
            />

            <input
              name="password"
              type="password"
              placeholder="PASSWORD"
              required
              className="bg-transparent border-0 border-b border-zinc-300 pb-1 text-[14px] text-zinc-400 placeholder-[#b8b8b8] outline-none focus:border-zinc-500 w-full"
              style={{ fontFamily: '"DM Mono", monospace' }}
            />

            <div className="flex flex-col gap-3 items-center">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white border border-[rgba(127,127,127,0.5)] rounded-full py-3 flex items-center justify-center shadow-[2px_2px_5px_rgba(0,0,0,0.25)] text-black text-[20px] font-normal transition hover:shadow-md disabled:opacity-50"
                style={{ fontFamily: '"EB Garamond", Garamond, serif' }}
              >
                {loading ? 'signing up…' : 'sign up'}
              </button>

              {errorMsg && (
                <p className="text-[#ff7480] text-[14px] text-center" style={{ fontFamily: '"DM Mono", monospace' }}>
                  {errorMsg}
                </p>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-[#b8b8b8] text-[14px]" style={{ fontFamily: '"DM Mono", monospace' }}>or</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>

              {/* Google sign-up */}
              <button
                type="button"
                onClick={async () => {
                  const { error } = await signUp.sso({
                    strategy: 'oauth_google',
                    redirectCallbackUrl: '/sso-callback',
                    redirectUrl: '/record',
                  })
                  if (error) console.error('Google sign-up error:', error)
                }}
                className="w-full bg-white border border-[rgba(127,127,127,0.5)] rounded-full py-3 flex items-center justify-center shadow-[2px_2px_5px_rgba(0,0,0,0.25)] transition hover:shadow-md"
              >
                <GoogleLogo />
              </button>

              <div id="clerk-captcha" />

              <div className="flex gap-4 items-center text-[14px]" style={{ fontFamily: '"DM Mono", monospace' }}>
                <span className="text-[#7f7f7f]">have an account?</span>
                <a href="/sign-in" className="text-black underline">log in</a>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleVerify(new FormData(e.currentTarget)) }} className="flex flex-col gap-10 w-full">
            <p className="text-center text-[#7f7f7f]" style={{ fontFamily: '"DM Mono", monospace', fontSize: 16 }}>
              check your email for a verification code
            </p>
            <input
              name="code"
              type="text"
              placeholder="VERIFICATION CODE"
              required
              className="bg-transparent border-0 border-b border-zinc-300 pb-1 text-[18px] text-zinc-400 placeholder-[#b8b8b8] outline-none focus:border-zinc-500 w-full"
              style={{ fontFamily: '"DM Mono", monospace' }}
            />
            {errorMsg && (
              <p className="text-[#ff7480] text-[14px]" style={{ fontFamily: '"DM Mono", monospace' }}>{errorMsg}</p>
            )}
            <div className="flex flex-col gap-4 items-center">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white border border-[rgba(127,127,127,0.5)] rounded-full py-3 flex items-center justify-center shadow-[2px_2px_5px_rgba(0,0,0,0.25)] text-black text-[18px] font-normal transition hover:shadow-md disabled:opacity-50"
                style={{ fontFamily: '"EB Garamond", Garamond, serif' }}
              >
                {loading ? 'verifying…' : 'verify'}
              </button>
              <button
                type="button"
                onClick={() => signUp.verifications.sendEmailCode()}
                className="text-[#7f7f7f] underline text-sm"
                style={{ fontFamily: '"DM Mono", monospace' }}
              >
                resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
