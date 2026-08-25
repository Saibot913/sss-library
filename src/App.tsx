import { useState, useMemo, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { fetchBooks, type Book } from './lib/books'
import { fetchThoughtForTheDay, type ThoughtForTheDay } from './lib/thoughtForTheDay'
import { useBookCover } from './lib/bookCovers'
import { VOLUNTEER_FORM_URL } from './lib/volunteers'
import { REVIEW_FORM_URL } from './lib/reviews'
import { SITE_PASSWORD, hasSiteAccess, grantSiteAccess } from './lib/siteAccess'
import { AUTH_REDIRECT_PATH, deleteAccount, getCurrentPatron, onAuthChange, requestSignInCode, signOut, updatePatronProfile, type Patron } from './lib/auth'
import { checkoutBookByCode, fetchMyActiveHolds, releaseReservation, reserveCopy, type ActiveHold } from './lib/checkouts'
import { SITE_NAME, SITE_ADDRESS, MEETING_ROOM } from './lib/siteInfo'
import { invalidateBooksCache } from './lib/books'
import { recordPageView } from './lib/analytics'
import { fetchStaffAnalytics, fetchStaffDashboard, fetchStaffInventory, isCurrentUserStaff, type StaffAnalytics, type StaffDashboard } from './lib/staff'

// ── Types ─────────────────────────────────────────────────────────────────────

type Page = 'home' | 'catalog' | 'thought' | 'about'

// Each page has a real URL, so pages can be linked to, bookmarked, and
// refreshed, and the back button moves between them instead of leaving the
// site. `Page` is kept because the nav highlights the active one — it's now
// derived from the URL rather than being the source of truth.
//
// Book detail is deliberately still component state, not a route, so there's
// no URL for an individual book yet.
const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  catalog: '/catalog',
  thought: '/thought',
  about: '/community',
}

function pageFromPath(pathname: string): Page {
  const match = (Object.keys(PAGE_PATHS) as Page[]).find(p => PAGE_PATHS[p] === pathname)
  return match ?? 'home'
}

type Filters = {
  query: string
  category: string
  yearFrom: string
  yearTo: string
  availability: 'all' | 'available' | 'checkedout'
  keywords: string
}

const EMPTY_FILTERS: Filters = {
  query: '',
  category: 'All Categories',
  yearFrom: '',
  yearTo: '',
  availability: 'all',
  keywords: '',
}

// ── Data ──────────────────────────────────────────────────────────────────────

const EVENTS = [
  { date: 'Jul 22', title: 'Summer Reading Circle', time: '6:00 PM', room: 'Reading Room B' },
  { date: 'Jul 25', title: "Children's Story Hour", time: '10:30 AM', room: "Children's Wing" },
  { date: 'Aug 03', title: 'Local Author Talk: Mira Salden', time: '7:00 PM', room: 'Main Hall' },
  { date: 'Aug 10', title: 'Genealogy Research Workshop', time: '2:00 PM', room: 'Archive Room' },
]

// ── Book cover ────────────────────────────────────────────────────────────────
// Cover art isn't stored in Supabase yet, so it's resolved client-side via the
// Google Books API (see lib/bookCovers.ts) and cached. Falls back to a plain
// placeholder box when no cover is found.

function BookCover({ book, style, fallback }: { book: Book; style?: React.CSSProperties; fallback?: React.ReactNode }) {
  const cover = useBookCover(book.title, book.author)
  if (cover) {
    return <img src={cover} alt={book.title} style={{ objectFit: 'cover', display: 'block', width: '100%', height: '100%', ...style }} />
  }
  return (
    <>
      {fallback ?? (
        <div style={{ width: '100%', height: '100%', background: '#D4B896', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: 0.35, ...style }}>
          📖
        </div>
      )}
    </>
  )
}

// ── Top nav ───────────────────────────────────────────────────────────────────

function TopNav({
  active,
  onNav,
  cartCount,
  onCart,
  onLogin,
  onProfile,
  onLogout,
  onToggleUserMenu,
  loggedIn,
  userName,
  showUserMenu,
  onCloseUserMenu,
  isStaff,
  onAdmin,
  onHolds,
}: {
  active: Page
  onNav: (p: Page) => void
  cartCount: number
  onCart: () => void
  onLogin: () => void
  onProfile: () => void
  onLogout: () => void
  onToggleUserMenu: () => void
  loggedIn: boolean
  userName: string
  showUserMenu: boolean
  onCloseUserMenu: () => void
  isStaff: boolean
  onAdmin: () => void
  onHolds: () => void
}) {
  const accountRef = useRef<HTMLDivElement>(null)

  // Close the account menu on an outside click or Escape — without this it
  // stays open until the button is pressed again, including while you're
  // reading the page behind it. The listener ignores clicks inside
  // `accountRef` so the button's own toggle stays in charge; otherwise
  // mousedown would close it a moment before click reopened it.
  useEffect(() => {
    if (!showUserMenu) return
    function onPointerDown(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) onCloseUserMenu()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseUserMenu()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showUserMenu, onCloseUserMenu])

  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#2C1810', borderBottom: '1px solid rgba(200,82,26,0.35)', height: 60, display: 'flex', alignItems: 'center', padding: '0 40px', gap: 0 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 48, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, border: '1.5px solid #C8521A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', color: '#C8521A', fontSize: 16, fontWeight: 700 }}>S</span>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', color: '#FAF3E4', fontSize: 16, fontWeight: 700, letterSpacing: '0.02em' }}>Sai Library</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#9B7B6A', fontSize: 8, letterSpacing: '0.1em', marginLeft: 4 }}>Est. 1923</span>
      </div>

      {/* Page links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        {([['home', '01', 'Home'], ['catalog', '02', 'Catalog'], ['thought', '03', 'Daily Thought'], ['about', '04', 'Community']] as const).map(([id, num, label]) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: active === id ? 'rgba(200,82,26,0.18)' : 'transparent', border: active === id ? '1px solid rgba(200,82,26,0.4)' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { if (active !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (active !== id) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: active === id ? '#C8521A' : '#9B7B6A', letterSpacing: '0.1em' }}>{num}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: active === id ? 600 : 400, color: active === id ? '#FAF3E4' : '#9B7B6A', letterSpacing: '0.06em' }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Login / user menu */}
        {loggedIn ? (
          <div ref={accountRef} style={{ position: 'relative' }}>
            <button
              onClick={onToggleUserMenu}
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: '#FAF3E4', background: 'rgba(200,82,26,0.25)', border: '1px solid rgba(200,82,26,0.5)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#C8521A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(200,82,26,0.5)')}
            >
              <span style={{ fontSize: 14 }}>👤</span>
              <span>{userName}</span>
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#FAF3E4', border: '1px solid #D4B896', boxShadow: '0 10px 30px rgba(44,24,16,0.15)', minWidth: 180, zIndex: 50 }}>
                <button onClick={onProfile} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid #E7D7B0', color: '#2C1810', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Profile
                </button>
                {isStaff && <button onClick={onAdmin} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid #E7D7B0', color: '#C8521A', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Admin Panel
                </button>}
                <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', color: '#2C1810', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onLogin}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: '#D4B896', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#C8521A')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
          >
            <span style={{ fontSize: 14 }}>⊙</span>
            <span>Log In</span>
          </button>
        )}

        {/* Cart */}
        {loggedIn && <button onClick={onHolds} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: '#FAF3E4', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}>
          Holds
        </button>}
        <button
          onClick={onCart}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: '#FAF3E4', background: cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.06)', border: `1px solid ${cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E8693A'; e.currentTarget.style.borderColor = '#E8693A' }}
          onMouseLeave={e => { e.currentTarget.style.background = cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.15)' }}
        >
          <span style={{ fontSize: 15 }}>⊡</span>
          <span>Cart</span>
          {cartCount > 0 && (
            <span style={{ background: '#FAF3E4', color: '#C8521A', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cartCount}</span>
          )}
        </button>
      </div>
    </header>
  )
}

// ── Site gate ─────────────────────────────────────────────────────────────────
// See src/lib/siteAccess.ts for what this is and isn't protecting.

function SiteGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.trim().toLowerCase() === SITE_PASSWORD.toLowerCase()) {
      onUnlock()
    } else {
      setError('That password is incorrect.')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2C1810' }}>
      <div style={{ background: '#FAF3E4', padding: '44px 44px', maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: '#C8521A', marginBottom: 6 }}>Sairam</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#2C1810', marginBottom: 20 }}>Welcome to SSS-Library</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', marginBottom: 24 }}>Please enter password to access the site.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            autoFocus
            style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }}
            onFocus={e => (e.target.style.borderColor = '#C8521A')}
            onBlur={e => (e.target.style.borderColor = '#D4B896')}
          />
          {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A' }}>{error}</p>}
          <button type="submit" style={{ padding: '12px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Login modal ───────────────────────────────────────────────────────────────

// No onLogin callback: with magic links the session appears when Supabase
// redirects back, not when this form is submitted, so there's nothing for the
// modal to hand back. onAuthChange() in App is what notices.
function LoginModal({ onClose, mode, setMode }: { onClose: () => void; mode: 'login' | 'signup'; setMode: (mode: 'login' | 'signup') => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Please enter your email address.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccessMessage('')
      await requestSignInCode(trimmed, mode)
      setEmail('')
      setSuccessMessage(
        mode === 'signup'
          ? 'Account created. Check your email for the magic link to finish signing in.'
          : 'Check your email for the magic link to sign in.'
      )
      // IMPORTANT: do not set the app as logged in here. The real session is created only
      // after the magic-link redirect is completed in Supabase.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not send your sign-in link.'
      if (mode === 'login' && /user not found|no user|not found/i.test(message)) {
        setError('There is no account with this email. Please sign up instead.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(44,24,16,0.7)' }} onClick={onClose}>
      <div style={{ background: '#FAF3E4', padding: '40px 44px', maxWidth: 430, width: '90%', boxShadow: '0 24px 64px rgba(44,24,16,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Member Access</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#2C1810' }}>{mode === 'signup' ? 'Sign Up' : 'Log In'}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B7B6A', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {(['login', 'signup'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              style={{ flex: 1, padding: '10px 12px', background: mode === option ? '#C8521A' : '#E9DCC3', color: mode === option ? '#FAF3E4' : '#2C1810', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}
            >
              {option === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#C8521A')}
              onBlur={e => (e.target.style.borderColor = '#D4B896')}
            />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', margin: 0 }}>
            {mode === 'signup'
              ? 'Create a library account with your email. We’ll send a magic link that takes you to your profile form.'
              : 'We’ll send a magic link to your email. If it lands in spam, please check there.'}
          </p>
          {successMessage && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#2C7A2C', margin: 0 }}>{successMessage}</p>}
          {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px', background: loading ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Sending…' : mode === 'signup' ? 'Create Account' : 'Send Link'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Cart overlay ──────────────────────────────────────────────────────────────

function CartOverlay({
  books,
  cartIds,
  onClose,
  onRemove,
  onViewBook,
  onCheckout,
}: {
  books: Book[]
  cartIds: string[]
  onClose: () => void
  onRemove: (id: string) => void
  onViewBook: (book: Book) => void
  onCheckout: () => void
}) {
  const cartBooks = cartIds.map(id => books.find(b => b.id === id)).filter(Boolean) as Book[]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={onClose}>
      <div style={{ flex: 1 }} />
      <div
        style={{ width: 400, background: '#FAF3E4', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-16px 0 48px rgba(44,24,16,0.2)', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: '#2C1810', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Hold Requests</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#FAF3E4' }}>Your Cart</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B7B6A', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {cartBooks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <span style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>⊡</span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', color: '#9B7B6A', marginBottom: 8 }}>Your cart is empty</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A' }}>Browse the catalog and add books to request a hold.</p>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, padding: '16px 0' }}>
              {cartBooks.map(book => {
                const avail = book.copiesAvailable
                return (
                  <div key={book.id} style={{ display: 'flex', gap: 14, padding: '16px 28px', borderBottom: '1px solid #D4B896' }}>
                    <div style={{ width: 48, height: 62, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                      <BookCover book={book} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button onClick={() => { onClose(); onViewBook(book) }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: '#2C1810', lineHeight: 1.3, marginBottom: 2 }}>{book.title}</h3>
                      </button>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#5C3D2E', marginBottom: 6 }}>{book.author}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: avail > 0 ? '#4CAF50' : '#C8521A' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: avail > 0 ? '#4CAF50' : '#C8521A' }}>{avail > 0 ? `${avail} of ${book.copiesTotal} available` : 'All copies on loan'}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemove(book.id)} style={{ background: 'none', border: 'none', color: '#9B7B6A', cursor: 'pointer', fontSize: 16, flexShrink: 0, alignSelf: 'flex-start', padding: '0 4px' }} title="Remove">✕</button>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 28px', borderTop: '1px solid #D4B896', background: '#F4E9D0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E' }}>{cartBooks.length} book{cartBooks.length !== 1 ? 's' : ''} in your cart</span>
              </div>
              <button onClick={onCheckout} style={{ width: '100%', padding: '13px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                Check Out {cartBooks.length} Book{cartBooks.length !== 1 ? 's' : ''}
              </button>
              {/* Nothing sends a notification, so don't promise one. */}
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#9B7B6A', textAlign: 'center', marginTop: 10 }}>Collect your books from the center during opening times.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ProfilePage({
  patron,
  onSaved,
  onDeleted,
  onboarding = false,
}: {
  patron: Patron | null
  onSaved: (updatedPatron: Patron) => void
  onDeleted: () => void
  onboarding?: boolean
}) {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState(patron?.firstName ?? '')
  const [lastName, setLastName] = useState(patron?.lastName ?? '')
  const [phone, setPhone] = useState(patron?.phone ?? '')
  const [email, setEmail] = useState(patron?.email ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setFirstName(patron?.firstName ?? '')
    setLastName(patron?.lastName ?? '')
    setPhone(patron?.phone ?? '')
    setEmail(patron?.email ?? '')
  }, [patron])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail || !trimmedFirst || !trimmedLast || !trimmedPhone) {
      setError('Please enter your email, first name, last name, and phone number.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const updatedPatron = await updatePatronProfile({ email: trimmedEmail, firstName: trimmedFirst, lastName: trimmedLast, phone: trimmedPhone })
      localStorage.setItem(`sss-library:patron-profile:${(patron?.email ?? updatedPatron.email).toLowerCase()}`, JSON.stringify({ firstName: updatedPatron.firstName, lastName: updatedPatron.lastName, phone: updatedPatron.phone }))
      onSaved(updatedPatron)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save your contact details.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('This action is irreversible. Your account, profile, and checkout history will be permanently deleted. Continue?')) return

    try {
      setDeleting(true)
      setError('')
      await deleteAccount()
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not delete your account.')
      setDeleting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '120px auto 80px', padding: '0 20px' }}>
      <div style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: '32px 28px', boxShadow: '0 20px 50px rgba(44,24,16,0.08)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{onboarding ? 'Finish sign up' : 'Profile'}</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#2C1810', margin: '0 0 16px' }}>{onboarding ? 'Create your library profile' : 'Your contact details'}</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', marginBottom: 20 }}>{onboarding ? 'Add your name and phone number to finish creating your account. You can edit these details later from Profile.' : 'This information is saved to your account. Changing your email may require confirmation from the new address.'}</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="submit" disabled={saving} style={{ padding: '12px 18px', background: saving ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <button type="button" onClick={() => navigate(PAGE_PATHS.catalog)} style={{ padding: '12px 18px', background: '#E9DCC3', color: '#2C1810', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
              Continue to catalog
            </button>
          </div>
          {!onboarding && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #D4B896' }}>
              <button type="button" onClick={handleDelete} disabled={saving || deleting} style={{ padding: '10px 14px', background: 'transparent', color: '#A52A2A', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, border: '1px solid #A52A2A', cursor: saving || deleting ? 'not-allowed' : 'pointer', opacity: saving || deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting account…' : 'Delete account'}
              </button>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#9B7B6A', marginTop: 8 }}>This action is irreversible.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function StaffDashboardPage() {
  const [dashboard, setDashboard] = useState<StaffDashboard | null>(null)
  const [inventory, setInventory] = useState<StaffDashboard['inventory']>([])
  const [analytics, setAnalytics] = useState<StaffAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function loadDashboard() {
    try {
      setLoading(true)
      setError('')
      const [nextDashboard, nextInventory, nextAnalytics] = await Promise.all([fetchStaffDashboard(), fetchStaffInventory(), fetchStaffAnalytics()])
      setDashboard(nextDashboard)
      setInventory(nextInventory)
      setAnalytics(nextAnalytics)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load the staff dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadDashboard()
  }

  useEffect(() => { void loadDashboard() }, [])

  if (loading) return <div style={{ padding: '120px 40px', textAlign: 'center', color: '#9B7B6A' }}>Loading staff dashboard…</div>
  if (error) return <div style={{ maxWidth: 700, margin: '120px auto', padding: 24, color: '#A52A2A' }}>{error}</div>
  if (!dashboard || !analytics) return null

  return (
    <div style={{ maxWidth: 1180, margin: '100px auto 80px', padding: '0 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '1px solid #D4B896', paddingBottom: 16, marginBottom: 24 }}>
        <div><p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Staff only</p><h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#2C1810' }}>Library operations</h1></div>
        <button onClick={handleRefresh} disabled={loading || refreshing} style={{ padding: '9px 14px', background: loading || refreshing ? '#A56A44' : '#C8521A', color: '#FAF3E4', border: 0, cursor: loading || refreshing ? 'not-allowed' : 'pointer' }}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Quick Stats</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatCard label="Open checkouts" value={dashboard.openCheckouts.length} icon="📚" />
          <StatCard label="Active holds" value={dashboard.activeHolds.length} icon="⏳" />
          <StatCard label="Checkouts (30d)" value={dashboard.traffic.reduce((sum, day) => sum + day.checkouts, 0)} icon="✅" />
          <StatCard label="Visitors (30d)" value={analytics.visitorTraffic.reduce((sum, day) => sum + day.visitors, 0)} icon="👥" />
          <StatCard label="Page views (30d)" value={analytics.visitorTraffic.reduce((sum, day) => sum + day.pageViews, 0)} icon="📄" />
          <StatCard label="Copies in collection" value={analytics.inventoryTotals.total} icon="📦" />
          <StatCard label="Available copies" value={analytics.inventoryTotals.available} icon="✅" />
          <StatCard label="Held copies" value={analytics.inventoryTotals.held} icon="🔒" />
          <StatCard label="Checked out copies" value={analytics.inventoryTotals.checkedOut} icon="📤" />
          <StatCard label="Active sessions (5m)" value={analytics.activeSessions} icon="🟢" />
        </div>
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Circulation Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <DashboardList title="Most checked out" items={dashboard.popularBooks} />
          <DashboardList title="Least checked out" items={dashboard.leastPopularBooks} />
          <DashboardList title="Top authors by checkouts" items={analytics.topAuthors.map(item => ({ bookCode: item.author, title: item.author, checkouts: item.checkouts }))} />
          <DashboardList title="Checkout categories" items={analytics.categories.map(item => ({ bookCode: item.category, title: `${item.category} · ${item.books} titles (${item.checkouts} checkouts)`, checkouts: item.checkouts }))} />
          <DashboardList title="Daily checkouts (30d)" items={dashboard.traffic.map(day => ({ bookCode: day.date, title: day.date, checkouts: day.checkouts }))} />
          <DashboardList title="Daily visitors (30d)" items={analytics.visitorTraffic.map(day => ({ bookCode: day.date, title: `${day.date} · ${day.pageViews} page views`, checkouts: day.visitors }))} />
        </div>
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Recent Activity (Last Hour)</h2>
        {analytics.recentActivity.length === 0 ? (
          <p style={{ color: '#9B7B6A' }}>No recent checkouts in the last hour.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {analytics.recentActivity.map((activity, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: '#F4E9D0', border: '1px solid #D4B896', borderRadius: 4 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#2C1810', fontSize: 14 }}>{activity.title}</strong>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: '#9B7B6A' }}>
                    <span>{activity.copy}</span>
                    <span>{activity.patron || 'Unknown patron'}</span>
                    <span>{new Date(activity.time).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Inventory by Title</h2>
        <InventoryTable items={inventory} />
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Active Holds</h2>
        <DashboardLoans title="Current holds" items={dashboard.activeHolds} />
      </section>
      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Open Checkouts</h2>
        <DashboardLoans title="Open checkouts" items={dashboard.openCheckouts} />
      </section>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: '#C8521A' }}>{value}</div>
    </div>
  )
}

function InventoryTable({ items }: { items: StaffDashboard['inventory'] }) {
  return (
    <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20, overflowX: 'auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Inventory by Title</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Book', 'Total', 'Available', 'Held', 'Checked Out'].map(label => (
              <th key={label} style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid #D4B896', color: '#9B7B6A', fontWeight: 600 }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.bookCode} style={{ background: item.checkedOutCopies > 0 ? '#FFF8F0' : 'transparent' }}>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #E7D7B0', color: '#2C1810', fontWeight: 500 }}>{item.title}</td>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #E7D7B0', color: '#C8521A', fontWeight: 700 }}>{item.totalCopies}</td>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #E7D7B0', color: '#4CAF50', fontWeight: 700 }}>{item.availableCopies}</td>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #E7D7B0', color: '#FF9800', fontWeight: 700 }}>{item.heldCopies}</td>
              <td style={{ padding: '9px 6px', borderBottom: '1px solid #E7D7B0', color: '#F44336', fontWeight: 700 }}>{item.checkedOutCopies}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function HoldsPage() {
  const [holds, setHolds] = useState<ActiveHold[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadHolds() {
    try {
      setLoading(true)
      setError('')
      setHolds(await fetchMyActiveHolds())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load your holds.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadHolds() }, [])

  return <div style={{ maxWidth: 820, margin: '110px auto 80px', padding: '0 28px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '1px solid #D4B896', paddingBottom: 16, marginBottom: 24 }}><div><p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Your account</p><h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#2C1810' }}>Active holds</h1></div><button onClick={() => void loadHolds()} style={{ padding: '9px 14px', background: '#C8521A', color: '#FAF3E4', border: 0, cursor: 'pointer' }}>Refresh</button></div>{loading ? <p style={{ color: '#9B7B6A' }}>Loading your holds…</p> : error ? <p style={{ color: '#A52A2A' }}>{error}</p> : holds.length === 0 ? <div style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 28 }}><h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#2C1810' }}>No active holds</h2><p style={{ color: '#9B7B6A', marginTop: 8 }}>Books you place on hold will appear here with their expiry time.</p></div> : <div style={{ display: 'grid', gap: 12 }}>{holds.map(hold => <div key={hold.fullLabel} style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 18, display: 'flex', justifyContent: 'space-between', gap: 18 }}><div><h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: '#2C1810' }}>{hold.title}</h2><p style={{ color: '#9B7B6A', fontSize: 12, marginTop: 4 }}>{hold.fullLabel}</p></div><div style={{ textAlign: 'right' }}><p style={{ color: '#C8521A', fontWeight: 700 }}>Held until</p><p style={{ color: '#5C3D2E', fontSize: 13, marginTop: 4 }}>{new Date(hold.reservedUntil).toLocaleString()}</p></div></div>)}</div>}</div>
}

function DashboardList({ title, items }: { title: string; items: Array<{ bookCode: string; title: string; checkouts: number }> }) {
  return (
    <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>{title}</h2>
      {items.length === 0 ? (
        <p style={{ color: '#9B7B6A', fontSize: 13 }}>No data yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(item => (
            <div key={item.bookCode} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', background: '#F4E9D0', border: '1px solid #D4B896', borderRadius: 4 }}>
              <span style={{ fontSize: 13, color: '#2C1810' }}>{item.title}</span>
              <strong style={{ color: '#C8521A', fontFamily: 'var(--font-mono)' }}>{item.checkouts}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DashboardLoans({ title, items }: { title: string; items: Array<{ fullLabel: string; title: string; email: string; reservedUntil?: string; checkedOutAt?: string }> }) {
  return (
    <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>{title}</h2>
      {items.length === 0 ? (
        <p style={{ color: '#9B7B6A', fontSize: 13 }}>None right now.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(item => (
            <div key={item.fullLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: '#F4E9D0', border: '1px solid #D4B896', borderRadius: 4 }}>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#2C1810', fontSize: 14 }}>{item.title}</strong>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: '#9B7B6A' }}>
                  <span>{item.fullLabel}</span>
                  <span>{item.email}</span>
                  {item.reservedUntil && <span>Expires: {new Date(item.reservedUntil).toLocaleString()}</span>}
                  {item.checkedOutAt && <span>Checked out: {new Date(item.checkedOutAt).toLocaleString()}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function StaffRoute() {
  return <StaffDashboardPage />
}

// ── Book Detail Page (full screen) ────────────────────────────────────────────

function BookDetailPage({
  book,
  allBooks,
  onBack,
  cartIds,
  onAddToCart,
  onRemoveFromCart,
  onViewBook,
}: {
  book: Book
  allBooks: Book[]
  onBack: () => void
  cartIds: string[]
  onAddToCart: (id: string) => void
  onRemoveFromCart: (id: string) => void
  onViewBook: (book: Book) => void
}) {
  const avail = book.copiesAvailable
  const inCart = cartIds.includes(book.id)

  const similar = useMemo(() => {
    return allBooks
      .filter(b => b.id !== book.id)
      .map(b => ({
        book: b,
        score:
          (b.category === book.category ? 1 : 0) +
          b.keywords.filter(k => book.keywords.includes(k)).length * 2,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ book }) => book)
  }, [book, allBooks])

  return (
    <div style={{ minHeight: '100vh', background: '#F4E9D0' }}>
      {/* Hero banner */}
      <div style={{ position: 'relative', height: 340, overflow: 'hidden' }}>
        <BookCover book={book} fallback={<div style={{ position: 'absolute', inset: 0, background: '#2C1810' }} />} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(44,24,16,0.92) 45%, rgba(44,24,16,0.4) 100%)' }} />

        {/* Back button */}
        <button
          onClick={onBack}
          style={{ position: 'absolute', top: 28, left: 40, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D4B896', background: 'rgba(44,24,16,0.5)', border: '1px solid rgba(212,184,150,0.35)', padding: '8px 18px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FAF3E4'; e.currentTarget.style.borderColor = '#C8521A' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#D4B896'; e.currentTarget.style.borderColor = 'rgba(212,184,150,0.35)' }}
        >
          ← Back
        </button>

        {/* Title block */}
        <div style={{ position: 'absolute', bottom: 40, left: 40, right: 40 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
            {book.category}
          </span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: '#FAF3E4', lineHeight: 1.15, marginBottom: 8, maxWidth: 700 }}>
            {book.title}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#D4B896' }}>
            {book.author} · {book.year}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48 }}>

        {/* Left column */}
        <div>
          {/* Summary */}
          <section style={{ marginBottom: 48 }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>About this Book</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#2C1810', lineHeight: 1.8 }}>{book.summary}</p>
          </section>

          {/* Details grid */}
          <section style={{ marginBottom: 48, padding: '24px 28px', background: '#FAF3E4', border: '1px solid #D4B896' }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Publication Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
              {[
                { label: 'Publisher', val: book.publisher },
                { label: 'Year', val: book.year },
                { label: 'Category', val: book.category },
              ].map(m => (
                <div key={m.label}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{m.label}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810' }}>{m.val}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #D4B896' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Keywords</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {book.keywords.map(k => (
                  <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#5C3D2E', background: '#F0C9A8', padding: '3px 9px', letterSpacing: '0.06em' }}>{k}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Similar titles */}
          {similar.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Similar Titles</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {similar.map(s => {
                  const sAvail = s.copiesAvailable
                  return (
                    <div
                      key={s.id}
                      onClick={() => onViewBook(s)}
                      style={{ display: 'flex', gap: 12, padding: '14px 16px', background: '#FAF3E4', border: '1px solid #D4B896', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F0C9A8'; e.currentTarget.style.borderColor = '#C8521A' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FAF3E4'; e.currentTarget.style.borderColor = '#D4B896' }}
                    >
                      <div style={{ width: 40, height: 52, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                        <BookCover book={s} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: '#2C1810', lineHeight: 1.3, marginBottom: 2 }}>{s.title}</h3>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#5C3D2E', marginBottom: 4 }}>{s.author}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: sAvail > 0 ? '#4CAF50' : '#C8521A' }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: sAvail > 0 ? '#4CAF50' : '#C8521A' }}>{sAvail > 0 ? `${sAvail} available` : 'On loan'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right column — sticky availability + cart */}
        <div>
          <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Availability card */}
            <div style={{ background: '#FAF3E4', border: `2px solid ${avail > 0 ? '#4CAF50' : '#C8521A'}`, padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: avail > 0 ? '#4CAF50' : '#C8521A', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: avail > 0 ? '#2C7A2C' : '#C8521A' }}>
                  {avail > 0 ? `${avail} of ${book.copiesTotal} Available` : 'All Copies on Loan'}
                </span>
              </div>

              {/* Add to cart */}
              <button
                onClick={() => inCart ? onRemoveFromCart(book.id) : onAddToCart(book.id)}
                style={{ width: '100%', padding: '13px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', transition: 'background 0.2s', marginBottom: 10 }}
                onMouseEnter={e => (e.currentTarget.style.background = inCart ? '#5C3D2E' : '#E8693A')}
                onMouseLeave={e => (e.currentTarget.style.background = inCart ? '#2C1810' : '#C8521A')}
              >
                {inCart ? '✓ Added to Cart' : '+ Add to Cart'}
              </button>

              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#9B7B6A', textAlign: 'center' }}>
                {avail > 0 ? 'Reserve your copy for pickup.' : 'Join the waitlist — we\'ll notify you when available.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Filter tag ─────────────────────────────────────────────────────────────────

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#FAF3E4', background: 'rgba(200,82,26,0.5)', padding: '3px 8px', letterSpacing: '0.06em' }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#FAF3E4', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0, opacity: 0.7 }}>✕</button>
    </span>
  )
}

// ── Catalog page ──────────────────────────────────────────────────────────────

function CatalogPage({
  books,
  filters,
  setFilters,
  onViewBook,
  cartIds,
  onAddToCart,
}: {
  books: Book[]
  filters: Filters
  setFilters: (f: Filters) => void
  onViewBook: (book: Book) => void
  cartIds: string[]
  onAddToCart: (id: string) => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Built from the catalog rather than hardcoded. The list was the Figma
  // placeholder ['All Categories', 'Fiction', 'Non-Fiction'], and the library
  // has neither Fiction nor Non-Fiction — so picking either filtered every
  // book out, which made the dropdown worse than useless.
  //
  // Deliberately not merging near-identical names: the data really does carry
  // "Books By N Kasturi", "Books by N.Kasturi" and "Books by N. Kasuri" as
  // three separate categories. Collapsing them here would hide a data problem
  // being fixed at the source, and guessing which spellings mean the same
  // thing is the kind of thing that goes quietly wrong. Books with no category
  // are left out of the list; they're still reachable via search and
  // "All Categories".
  const categories = useMemo(() => {
    const distinct = new Set<string>()
    for (const book of books) {
      const name = book.category.trim()
      if (name) distinct.add(name)
    }
    return ['All Categories', ...[...distinct].sort((a, b) => a.localeCompare(b))]
  }, [books])

  const hasSearched = Object.entries(filters).some(([k, v]) => {
    if (k === 'category') return v !== 'All Categories'
    if (k === 'availability') return v !== 'all'
    return v !== ''
  })

  function setF<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters({ ...filters, [key]: val })
  }

  const results = useMemo(() => {
    return books.filter(b => {
      const q = filters.query.toLowerCase().trim()
      const kw = filters.keywords.toLowerCase().trim()
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false
      if (kw && !b.keywords.some(k => k.includes(kw)) && !b.title.toLowerCase().includes(kw) && !b.summary.toLowerCase().includes(kw)) return false
      if (filters.category !== 'All Categories' && b.category !== filters.category) return false
      if (filters.yearFrom && parseInt(b.year) < parseInt(filters.yearFrom)) return false
      if (filters.yearTo && parseInt(b.year) > parseInt(filters.yearTo)) return false
      if (filters.availability === 'available' && b.copiesAvailable === 0) return false
      if (filters.availability === 'checkedout' && b.copiesAvailable === b.copiesTotal) return false
      return true
    })
  }, [books, filters])

  const unavailableResults = results.filter(b => b.copiesAvailable === 0)

  const recommendations = useMemo(() => {
    if (!hasSearched || unavailableResults.length === 0) return []
    const resultIds = new Set(results.map(b => b.id))
    const seedKeywords = new Set(unavailableResults.flatMap(b => b.keywords))
    const seedCategories = new Set(unavailableResults.map(b => b.category))
    const seedWords = new Set(unavailableResults.flatMap(b => b.summary.toLowerCase().split(/\W+/).filter(w => w.length > 4)))

    return books
      .filter(b => !resultIds.has(b.id) && b.copiesAvailable > 0)
      .map(b => {
        let score = 0
        b.keywords.forEach(k => { if (seedKeywords.has(k)) score += 3 })
        if (seedCategories.has(b.category)) score += 1
        b.summary.toLowerCase().split(/\W+/).filter(w => w.length > 4).forEach(w => { if (seedWords.has(w)) score += 0.5 })
        return { book: b, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ book }) => book)
  }, [books, results, hasSearched])

  const activeFilterCount = [
    filters.query,
    filters.keywords,
    filters.category !== 'All Categories' ? filters.category : '',
    filters.yearFrom,
    filters.yearTo,
    filters.availability !== 'all' ? filters.availability : '',
  ].filter(Boolean).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left filter sidebar */}
      <aside style={{ width: 240, flexShrink: 0, background: '#FAF3E4', borderRight: '1px solid #D4B896', display: 'flex', flexDirection: 'column', position: 'sticky', top: 60, height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #D4B896' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={() => setFilters(EMPTY_FILTERS)} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', letterSpacing: '0.06em' }}>Clear ({activeFilterCount})</button>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A' }}>{hasSearched ? `${results.length} result${results.length !== 1 ? 's' : ''}` : `${books.length} total items`}</p>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { label: 'Title or Author', key: 'query' as const, placeholder: 'e.g. Tolstoy, Karenina…', type: 'text' },
            { label: 'Keywords', key: 'keywords' as const, placeholder: 'e.g. memory, love…', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={filters[f.key] as string} onChange={e => setF(f.key, e.target.value)} style={{ width: '100%', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
            </div>
          ))}

          {[
            { label: 'Category', key: 'category' as const, opts: categories },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <select value={filters[f.key] as string} onChange={e => setF(f.key, e.target.value)} style={{ width: '100%', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                {f.opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Year Range</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" placeholder="From" value={filters.yearFrom} onChange={e => setF('yearFrom', e.target.value)} style={{ width: '50%', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
              <span style={{ color: '#9B7B6A' }}>—</span>
              <input type="number" placeholder="To" value={filters.yearTo} onChange={e => setF('yearTo', e.target.value)} style={{ width: '50%', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
            </div>
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Availability</label>
            {([['all', 'All items'], ['available', 'Available now'], ['checkedout', 'On loan']] as const).map(([val, label]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                <div onClick={() => setF('availability', val)} style={{ width: 14, height: 14, border: `1.5px solid ${filters.availability === val ? '#C8521A' : '#D4B896'}`, background: filters.availability === val ? '#C8521A' : 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {filters.availability === val && <span style={{ color: '#FAF3E4', fontSize: 9 }}>✓</span>}
                </div>
                <span onClick={() => setF('availability', val)} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', cursor: 'pointer' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* Main results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top search bar */}
        <div style={{ background: '#2C1810', padding: '18px 28px 16px', position: 'sticky', top: 60, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: filtersOpen ? 14 : 0 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#FAF3E4', flexShrink: 0 }}>The Catalog</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#FAF3E4', maxWidth: 480 }} onFocusCapture={e => (e.currentTarget.style.outline = '2px solid #C8521A')} onBlurCapture={e => (e.currentTarget.style.outline = 'none')}>
              <span style={{ padding: '0 12px', color: '#9B7B6A', fontSize: 16 }}>⌕</span>
              <input type="text" placeholder="Search title, author…" value={filters.query} onChange={e => setF('query', e.target.value)} style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: 'transparent', border: 'none', outline: 'none' }} />
              {filters.query && <button onClick={() => setF('query', '')} style={{ padding: '0 10px', color: '#9B7B6A', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>}
            </div>
            <button onClick={() => setFiltersOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, padding: '9px 14px', background: filtersOpen ? '#C8521A' : 'rgba(255,255,255,0.1)', color: '#FAF3E4', border: `1px solid ${filtersOpen ? '#C8521A' : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer' }}>
              Filters {activeFilterCount > 0 && <span style={{ background: '#C8521A', color: '#FAF3E4', fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>}
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#9B7B6A', flexShrink: 0 }}>{results.length} results</span>
          </div>

          {filtersOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', alignItems: 'flex-end' }}>
              {[
                { label: 'Category', key: 'category' as const, opts: categories, type: 'select' },
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{f.label}</span>
                  <select value={filters[f.key] as string} onChange={e => setF(f.key, e.target.value)} style={{ padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: 12, color: '#2C1810', background: '#FAF3E4', border: 'none', outline: 'none', cursor: 'pointer' }}>
                    {f.opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Availability</span>
                <select value={filters.availability} onChange={e => setF('availability', e.target.value as Filters['availability'])} style={{ padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: 12, color: '#2C1810', background: '#FAF3E4', border: 'none', outline: 'none', cursor: 'pointer' }}>
                  <option value="all">All</option>
                  <option value="available">Available</option>
                  <option value="checkedout">On Loan</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['yearFrom', 'yearTo'] as const).map((key, i) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{i === 0 ? 'Year from' : 'Year to'}</span>
                    <input type="number" placeholder={i === 0 ? 'e.g. 1900' : 'e.g. 2024'} value={filters[key]} onChange={e => setF(key, e.target.value)} style={{ padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: 12, color: '#2C1810', background: '#FAF3E4', border: 'none', outline: 'none', width: 88 }} />
                  </div>
                ))}
              </div>
              {activeFilterCount > 0 && <button onClick={() => setFilters(EMPTY_FILTERS)} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', background: 'none', border: '1px solid rgba(255,255,255,0.15)', padding: '7px 12px', cursor: 'pointer', alignSelf: 'flex-end' }}>Clear all</button>}
            </div>
          )}

          {!filtersOpen && activeFilterCount > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {filters.query && <FilterTag label={`"${filters.query}"`} onRemove={() => setF('query', '')} />}
              {filters.keywords && <FilterTag label={`keywords: ${filters.keywords}`} onRemove={() => setF('keywords', '')} />}
              {filters.category !== 'All Categories' && <FilterTag label={filters.category} onRemove={() => setF('category', 'All Categories')} />}
              {filters.yearFrom && <FilterTag label={`from ${filters.yearFrom}`} onRemove={() => setF('yearFrom', '')} />}
              {filters.yearTo && <FilterTag label={`to ${filters.yearTo}`} onRemove={() => setF('yearTo', '')} />}
              {filters.availability !== 'all' && <FilterTag label={filters.availability === 'available' ? 'Available now' : 'On loan'} onRemove={() => setF('availability', 'all')} />}
            </div>
          )}
        </div>

        <div style={{ padding: '24px 28px', flex: 1 }}>
          {results.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: '#9B7B6A', marginBottom: 8 }}>No items match your filters</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#9B7B6A', marginBottom: 20 }}>Try broadening your search or clearing some filters.</p>
              <button onClick={() => setFilters(EMPTY_FILTERS)} style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 22px', background: '#C8521A', color: '#FAF3E4', border: 'none', cursor: 'pointer' }}>Clear All Filters</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 1, background: '#D4B896' }}>
              {results.map(book => {
                const avail = book.copiesAvailable
                const inCart = cartIds.includes(book.id)
                return (
                  <div key={book.id} style={{ background: '#FAF3E4', padding: 18, display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div
                      onClick={() => onViewBook(book)}
                      style={{ cursor: 'pointer', flex: 1 }}
                    >
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 44, height: 56, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                          <BookCover book={book} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: '#2C1810', lineHeight: 1.3, marginBottom: 2 }}>{book.title}</h3>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#5C3D2E' }}>{book.author} · {book.year}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: avail > 0 ? '#4CAF50' : '#C8521A' }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: avail > 0 ? '#4CAF50' : '#C8521A' }}>{avail > 0 ? `${avail}/${book.copiesTotal} available` : 'All on loan'}</span>
                          </div>
                        </div>
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#9B7B6A', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 10 }}>
                        {book.summary}
                      </p>
                    </div>
                    <div style={{ borderTop: '1px solid #D4B896', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#9B7B6A' }}>{book.category}</span>
                      <button
                        onClick={() => onAddToCart(book.id)}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', padding: '4px 10px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        {inCart ? '✓ Added' : '+ Cart'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div style={{ marginTop: 40, padding: '28px', background: '#FAF3E4', border: '1px solid #D4B896', borderLeft: '3px solid #C8521A' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Not available?</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: '#2C1810' }}>You might also enjoy</h3>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A', marginLeft: 'auto' }}>Similar themes · Available now</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {recommendations.map(book => {
                  const avail = book.copiesAvailable
                  const inCart = cartIds.includes(book.id)
                  const sharedKw = book.keywords.filter(k => unavailableResults.some(u => u.keywords.includes(k)))
                  return (
                    <div key={book.id} style={{ background: '#F4E9D0', border: '1px solid #D4B896', padding: 14 }}>
                      <div onClick={() => onViewBook(book)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 36, height: 48, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                            <BookCover book={book} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: '#2C1810', lineHeight: 1.3, marginBottom: 2 }}>{book.title}</h4>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#5C3D2E', marginBottom: 4 }}>{book.author}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4CAF50' }} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4CAF50' }}>{avail} available</span>
                            </div>
                          </div>
                        </div>
                        {sharedKw.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                            {sharedKw.slice(0, 3).map(k => <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#C8521A', background: 'rgba(200,82,26,0.1)', padding: '2px 5px', border: '1px solid rgba(200,82,26,0.2)' }}>{k}</span>)}
                          </div>
                        )}
                      </div>
                      <button onClick={() => onAddToCart(book.id)} style={{ marginTop: 6, width: '100%', padding: '5px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em', border: 'none', cursor: 'pointer' }}>
                        {inCart ? '✓ Added' : '+ Add to Cart'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Home page ─────────────────────────────────────────────────────────────────

function HomePage({ books, onSearch, onViewBook, cartIds, onAddToCart }: {
  books: Book[]
  onSearch: (q: string) => void
  onViewBook: (book: Book) => void
  cartIds: string[]
  onAddToCart: (id: string) => void
}) {
  const [heroQuery, setHeroQuery] = useState('')

  // The four categories with the most books, so the shortcuts under the search
  // box point at real shelves rather than invented ones.
  const topCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const book of books) {
      const name = book.category.trim()
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name)
  }, [books])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    onSearch(heroQuery.trim())
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ position: 'relative', height: 580, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1400&h=580&fit=crop&auto=format" alt="Library reading room" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(44,24,16,0.88) 50%, rgba(44,24,16,0.4) 100%)' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 64px 56px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', color: '#C8521A', textTransform: 'uppercase', marginBottom: 12, display: 'block' }}>Sai Library</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,6vw,72px)', fontWeight: 700, color: '#FAF3E4', lineHeight: 1.1, maxWidth: 520 }}>Sai Library</h1>
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: '#D4B896', fontSize: 15, maxWidth: 500, marginTop: 14, lineHeight: 1.7 }}>
            "Resolve to act, to mix only in good company, to read only elevating books, to form the habit of remembering the Lord's name and, then ignorance will vanish automatically."
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: '#C8521A', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>— Baba</p>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ marginTop: 28, display: 'flex', maxWidth: 520 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#FAF3E4' }}>
              <span style={{ padding: '0 14px', color: '#9B7B6A', fontSize: 18 }}>⌕</span>
              <input type="text" placeholder="Search by title, author, keyword…" value={heroQuery} onChange={e => setHeroQuery(e.target.value)} style={{ flex: 1, padding: '13px 0', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: 'transparent', border: 'none', outline: 'none' }} />
            </div>
            <button type="submit" style={{ padding: '13px 24px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Search</button>
          </form>

          {/* The four biggest real categories, not the Figma placeholders
              ('Fiction', 'Non-Fiction', 'Spiritual', 'History' — none of which
              exist here). These also used to just dump you on the catalog with
              no filter applied; they now search for the category. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {topCategories.map(cat => (
              <button key={cat} onClick={() => onSearch(cat)} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', background: 'rgba(250,243,228,0.1)', color: '#D4B896', border: '1px solid rgba(250,243,228,0.2)', cursor: 'pointer' }}>{cat}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Hours */}
      <div style={{ background: '#2C1810', padding: '14px 64px', display: 'flex', gap: 48 }}>
        {[{ day: 'Mon – Thu', hours: '9:00 AM – 8:00 PM' }, { day: 'Fri – Sat', hours: '9:00 AM – 6:00 PM' }, { day: 'Sunday', hours: '12:00 PM – 5:00 PM' }].map(h => (
          <div key={h.day} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: '#C8521A', textTransform: 'uppercase' }}>{h.day}</span>
            <span style={{ color: '#9B7B6A', fontSize: 11 }}>—</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#D4B896' }}>{h.hours}</span>
          </div>
        ))}
      </div>

      {/* Recommended books */}
      <section style={{ padding: '56px 64px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32, borderBottom: '1px solid #D4B896', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>§ 01</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: '#2C1810' }}>Recommended Books</h2>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#9B7B6A', letterSpacing: '0.1em' }}>July 2026</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {books.slice(0, 3).map(book => {
            const avail = book.copiesAvailable
            const inCart = cartIds.includes(book.id)
            return (
              <div key={book.id} style={{ background: '#FAF3E4', border: '1px solid #D4B896' }}>
                <div onClick={() => onViewBook(book)} style={{ cursor: 'pointer' }}>
                  <div style={{ overflow: 'hidden', height: 160 }}>
                    <BookCover book={book} />
                  </div>
                  <div style={{ padding: '16px 18px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{book.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: avail > 0 ? '#4CAF50' : '#C8521A' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: avail > 0 ? '#4CAF50' : '#C8521A' }}>{avail > 0 ? 'Available' : 'On Loan'}</span>
                      </div>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#2C1810', lineHeight: 1.25, marginBottom: 3 }}>{book.title}</h3>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', marginBottom: 8 }}>{book.author} · {book.year}</p>
                  </div>
                </div>
                <div style={{ padding: '0 18px 16px' }}>
                  <button onClick={() => onAddToCart(book.id)} style={{ width: '100%', padding: '8px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', border: 'none', cursor: 'pointer' }}>
                    {inCart ? '✓ Added to Cart' : '+ Add to Cart'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Events */}
      <section style={{ padding: '0 64px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 28, borderBottom: '1px solid #D4B896', paddingBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>§ 02</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: '#2C1810' }}>Upcoming Events</h2>
        </div>
        {EVENTS.map((ev, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '18px 14px', borderBottom: '1px solid #D4B896', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#FAF3E4')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#C8521A', minWidth: 56 }}>{ev.date}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#2C1810', marginBottom: 2 }}>{ev.title}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#9B7B6A' }}>{ev.room}</p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5C3D2E' }}>{ev.time}</span>
          </div>
        ))}
      </section>

      <section style={{ background: '#C8521A', padding: '44px 64px' }}>
        <blockquote style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px,3vw,32px)', fontStyle: 'italic', color: '#FAF3E4', lineHeight: 1.4, maxWidth: 680 }}>
          "A library is not a luxury but one of the necessities of life."
        </blockquote>
        <cite style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#F0C9A8', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginTop: 14 }}>— Henry Ward Beecher</cite>
      </section>
    </div>
  )
}

// ── About page ────────────────────────────────────────────────────────────────

type BookClubEntry = {
  date: string
  day: string
  time: string
  title: string
  description: string
  book: string
  host: string
  room: string
  spots: number
  spotsLeft: number
}

// Emptied on purpose. These were Figma placeholders - a "World Fiction
// Evening" on Calvino's Invisible Cities, "Science & Ideas" on Sapiens,
// Dostoevsky - hosted by the invented staff from the mockup, and nothing to do
// with this center. Showing made-up sessions with live "Reserve a Spot"
// buttons is worse than showing none.
//
// Real sessions arrive when src/lib/bookClub.ts is implemented; it needs two
// new tables and a capacity check, see the TODO in that file. The section
// below renders an empty state until then.
const BOOK_CLUBS: BookClubEntry[] = []

const VOLUNTEER_ROLES = [
  {
    title: 'Shelving & Collection Care',
    commitment: '3 hrs / week',
    description: 'Help keep our shelves organised, spine labels intact, and damaged books flagged for repair. Perfect for those who love spending quiet time among books.',
    skills: ['Attention to detail', 'Physical mobility', 'Reliability'],
  },
  {
    title: 'Children\'s Programme Assistant',
    commitment: '2 hrs / week',
    description: 'Support our Children\'s Librarian during Story Hour and after-school reading sessions. Help children find books they\'ll love and assist with craft activities.',
    skills: ['Patience', 'Enthusiasm', 'Works well with children'],
  },
  {
    title: 'Digital Catalogue Project',
    commitment: 'Flexible',
    description: 'We are digitising our pre-1990 card catalogue and archival photographs. Volunteers help with data entry, scanning, and tagging. Can be done in short sessions.',
    skills: ['Computer literacy', 'Accuracy', 'Patience'],
  },
  {
    title: 'Community Outreach',
    commitment: '4 hrs / month',
    description: 'Represent Sai Library at local fairs, schools, and community events. Help spread awareness of our programmes and assist with flyer distribution and social media.',
    skills: ['Communication', 'Friendly demeanour', 'Organised'],
  },
  {
    title: 'Book Club Facilitator',
    commitment: '2 hrs / session',
    description: 'Lead or co-lead one of our monthly book club sessions. Facilitators prepare 4–6 discussion questions and guide the group through a 90-minute conversation.',
    skills: ['Love of reading', 'Public speaking', 'Preparation'],
  },
  {
    title: 'General Maintenance & Events',
    commitment: 'As needed',
    description: 'Help set up and pack down for library events, assist with minor repairs, furniture moving, and general upkeep of the building and grounds.',
    skills: ['Practical skills', 'Teamwork', 'Availability on weekends'],
  },
]

// ── Thought for the Day ───────────────────────────────────────────────────────

// 'YYYY-MM-DD' -> "Thursday, August 13, 2026".
//
// Built from the parts rather than new Date(iso): that form is parsed as UTC
// midnight, which renders as the *previous* day anywhere west of Greenwich —
// including here. new Date(y, m, d) is local midnight, so the date shown is the
// date stored.
function formatThoughtDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function ThoughtPage() {
  const [thought, setThought] = useState<ThoughtForTheDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchThoughtForTheDay()
      .then(t => { if (!cancelled) setThought(t) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the thought') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header band */}
      <section style={{ background: '#2C1810', padding: '48px 64px 40px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: '#C8521A', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
          Sai Inspires · From Prasanthi Nilayam
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4.5vw,44px)', fontWeight: 700, color: '#FAF3E4', lineHeight: 1.1 }}>
          Thought for the Day
        </h1>
        {/* Deliberately not labelled "today": the daily mail is published on
            India time, so from early afternoon the newest thought carries
            tomorrow's date. Showing the date plainly avoids contradicting it. */}
        {thought && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#D4B896', marginTop: 10 }}>
            {formatThoughtDate(thought.date)}
          </p>
        )}
      </section>

      <section style={{ padding: '56px 64px 72px', maxWidth: 900, margin: '0 auto' }}>
        {loading ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Loading…
          </p>
        ) : error ? (
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#C8521A', marginBottom: 6 }}>Couldn't load the thought</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A' }}>{error}</p>
          </div>
        ) : !thought ? (
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2C1810', marginBottom: 6 }}>Nothing here yet</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E' }}>
              Today's thought hasn't arrived. It's imported once a day — please check back later.
            </p>
          </div>
        ) : (
          <>
            {/* Teaser above the discourse */}
            {thought.intro && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: '#C8521A', lineHeight: 1.7, marginBottom: 24 }}>
                {thought.intro}
              </p>
            )}

            {/* The discourse extract. Paragraph breaks are stored as blank
                lines by the importer, so split rather than dumping one block. */}
            {thought.passage.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#2C1810', lineHeight: 1.85, marginBottom: 20, textAlign: 'justify' }}>
                {para}
              </p>
            ))}

            {thought.attribution && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: '#5C3D2E', textAlign: 'right', marginTop: 28 }}>
                {thought.attribution}
              </p>
            )}

            {/* The short highlighted line, closing the page — same order the
                email itself uses, where it sits in a band below the discourse
                rather than above it. */}
            {thought.quote && (
              <blockquote style={{ margin: '48px 0 0', background: '#2C1810', padding: '32px 36px' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px,2.2vw,24px)', fontStyle: 'italic', fontWeight: 500, color: '#FAF3E4', lineHeight: 1.55, textAlign: 'center' }}>
                  {thought.quote}
                </p>
              </blockquote>
            )}

            <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid #D4B896' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Source ·{' '}
                <a href="https://www.sssmediacentre.org/sai-inspires/" target="_blank" rel="noreferrer" style={{ color: '#C8521A' }}>
                  Sai Inspires, Radio Sai
                </a>
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function AboutPage() {
  const sectionHead = (num: string, title: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 36, borderBottom: '1px solid #D4B896', paddingBottom: 12 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{num}</span>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: '#2C1810' }}>{title}</h2>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1400&h=260&fit=crop&auto=format" alt="Community gathering at the library" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(44,24,16,0.70)' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 64px 36px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: '#C8521A', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Sai Library · Community</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, color: '#FAF3E4', lineHeight: 1.1 }}>Get Involved</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#D4B896', marginTop: 8 }}>Book clubs · Volunteering</p>
        </div>
      </section>

      {/* ── § 01 Book Clubs ── */}
      <section style={{ padding: '56px 64px 48px' }}>
        {sectionHead('§ 01', 'Upcoming Book Clubs')}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {BOOK_CLUBS.length === 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.7, maxWidth: 580 }}>
              No sessions are scheduled just yet. Book club dates will appear here once they're set — ask at the center in the meantime.
            </p>
          )}
          {BOOK_CLUBS.map((club, i) => {
            const full = club.spotsLeft === 0
            const almost = club.spotsLeft <= 4 && !full
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 32, padding: '28px 0', borderBottom: '1px solid #D4B896', alignItems: 'start' }}>
                {/* Date */}
                <div style={{ flexShrink: 0 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#C8521A', lineHeight: 1, marginBottom: 4 }}>{club.date.split(',')[0]}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{club.day}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E' }}>{club.time}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', marginTop: 6, letterSpacing: '0.06em' }}>{club.room}</p>
                </div>

                {/* Info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2C1810' }}>{club.title}</h3>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.06em' }}>— Hosted by {club.host}</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Reading: {club.book}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', lineHeight: 1.7, maxWidth: 580 }}>{club.description}</p>
                </div>

                {/* Spots */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: full ? '#C8521A' : almost ? '#D4841A' : '#4CAF50', lineHeight: 1 }}>
                      {full ? 'Full' : club.spotsLeft}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {full ? 'No spots left' : `of ${club.spots} spots left`}
                    </p>
                  </div>
                  <button
                    disabled={full}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', padding: '8px 18px', background: full ? 'transparent' : '#C8521A', color: full ? '#9B7B6A' : '#FAF3E4', border: `1px solid ${full ? '#D4B896' : '#C8521A'}`, cursor: full ? 'default' : 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => { if (!full) e.currentTarget.style.background = '#E8693A' }}
                    onMouseLeave={e => { if (!full) e.currentTarget.style.background = '#C8521A' }}
                  >
                    {full ? 'Join Waitlist' : 'Reserve a Spot'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── § 02 Volunteers ── */}
      <section style={{ padding: '56px 64px 64px', borderTop: '1px solid #D4B896' }}>
        {sectionHead('§ 02', 'Volunteer With Us')}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, marginBottom: 56 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', color: '#2C1810', lineHeight: 1.5, marginBottom: 18 }}>
              "The library runs on the love of its community. We'd love yours."
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.75, marginBottom: 14 }}>
              Sai Library relies on a team of dedicated volunteers to deliver programmes, maintain the collection, and serve our members. Whether you can spare a few hours a week or just a few hours a month, there is a role for you.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.75 }}>
              All volunteers receive a library membership, invitations to staff events, and the quiet satisfaction of knowing your time made a real difference to real readers.
            </p>
          </div>

          {/* Volunteer interest — hands off to an external Google Form,
              see src/lib/volunteers.ts for why and how it's set up. */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Express your interest</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', lineHeight: 1.7, marginBottom: 20 }}>
              Tell us your name, how to reach you, and what kind of volunteering interests you — takes a minute, and someone from our team will follow up.
            </p>
            {VOLUNTEER_FORM_URL ? (
              <a
                href={VOLUNTEER_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', padding: '12px 20px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', border: 'none', cursor: 'pointer' }}
              >
                Open Volunteer Interest Form ↗
              </a>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', fontStyle: 'italic' }}>
                Sign-up form coming soon — check back shortly.
              </p>
            )}
          </div>
        </div>

        {/* Roles grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {VOLUNTEER_ROLES.map(role => (
            <div key={role.title} style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: '#2C1810', lineHeight: 1.3 }}>{role.title}</h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#C8521A', background: 'rgba(200,82,26,0.1)', padding: '3px 8px', letterSpacing: '0.08em', flexShrink: 0, marginLeft: 8, whiteSpace: 'nowrap' }}>{role.commitment}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', lineHeight: 1.65, marginBottom: 12 }}>{role.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {role.skills.map(s => (
                  <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', background: '#F4E9D0', padding: '2px 7px', letterSpacing: '0.05em' }}>{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── § 03 Reviews & Feedback ── */}
      <section style={{ padding: '0 64px 64px' }}>
        {sectionHead('§ 03', 'Reviews & Feedback')}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', color: '#2C1810', lineHeight: 1.5, marginBottom: 18 }}>
              "Tell us what you think — of a book, or of the library itself."
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.75 }}>
              Loved something you borrowed? Have a thought on how the library or this site could serve you better? We read every submission.
            </p>
          </div>

          {/* Reviews/feedback — hands off to an external Google Form,
              see src/lib/reviews.ts for why and how it's set up. */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Share a review</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', lineHeight: 1.7, marginBottom: 20 }}>
              Name, how to reach you, whether it's about a book or the library/website itself, and your review — takes a minute.
            </p>
            {REVIEW_FORM_URL ? (
              <a
                href={REVIEW_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', padding: '12px 20px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', border: 'none', cursor: 'pointer' }}
              >
                Open Review Form ↗
              </a>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', fontStyle: 'italic' }}>
                Review form coming soon — check back shortly.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Contact footer */}
      <div style={{ background: '#2C1810', padding: '36px 64px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
        {/* Real details from siteInfo.ts, replacing the Figma placeholders
            ('418 Elm Street', '(614) 555-0187', 'hello@sailibrary.org').
            No Phone or Email column: the center hasn't given a public number
            or address to publish, and an invented one on a real site is worse
            than none. Add them here once someone supplies them. */}
        {[{ label: 'Center', value: SITE_NAME }, { label: 'Address', value: SITE_ADDRESS }, { label: 'Room', value: MEETING_ROOM }].map(c => (
          <div key={c.label}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{c.label}</span>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#D4B896', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [siteUnlocked, setSiteUnlocked] = useState(() => hasSiteAccess())
  const [books, setBooks] = useState<Book[]>([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [booksError, setBooksError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [viewingBook, setViewingBook] = useState<Book | null>(null)
  const [cartIds, setCartIds] = useState<string[]>([])
  const [cartCopies, setCartCopies] = useState<Record<string, string>>({})
  const [showCart, setShowCart] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [loginMode, setLoginMode] = useState<'login' | 'signup'>('login')
  const [loggedIn, setLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')
  const [currentPatron, setCurrentPatron] = useState<Patron | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authLoading, setAuthLoading] = useState<{type: 'login' | 'logout'; message: string} | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const page = pageFromPath(location.pathname)
  const authReturnMode = new URLSearchParams(location.search).get('auth')

  // Routers don't reset scroll on navigation, so without this you land
  // part-way down a new page after scrolling the previous one.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    void recordPageView(location.pathname).catch(() => {})
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    fetchBooks()
      .then(data => { if (!cancelled) setBooks(data) })
      .catch(err => { if (!cancelled) setBooksError(err instanceof Error ? err.message : 'Failed to load books') })
      .finally(() => { if (!cancelled) setBooksLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'done') {
      setAuthLoading({ type: 'login', message: 'Logging you in...' })
      const timer = window.setTimeout(() => {
        setAuthLoading(null)
      }, 500)
      return () => window.clearTimeout(timer)
    }
  }, [location.pathname])

  useEffect(() => {
    let unsub = () => {}

    getCurrentPatron()
      .then(patron => {
        setCurrentPatron(patron)
        setLoggedIn(Boolean(patron))
        setUserName(patron?.name ?? '')
      })
      .catch(() => {
        setCurrentPatron(null)
        setLoggedIn(false)
        setUserName('')
      })

    unsub = onAuthChange(patron => {
      setCurrentPatron(patron)
      setLoggedIn(Boolean(patron))
      setUserName(patron?.name ?? '')
      setAuthReady(true)
    })

    return () => unsub()
  }, [])

  const hasProfile = Boolean(
    currentPatron &&
    currentPatron.firstName &&
    currentPatron.lastName &&
    currentPatron.phone
  )

  useEffect(() => {
    if (!currentPatron) {
      setIsStaff(false)
      return
    }

    isCurrentUserStaff()
      .then(setIsStaff)
      .catch(() => setIsStaff(false))
  }, [currentPatron?.id])

  useEffect(() => {
    if (!loggedIn || !currentPatron) return

    const magicLinkMode = authReturnMode
    if (magicLinkMode) {
      if (magicLinkMode === 'login' || hasProfile) {
        navigate(PAGE_PATHS.catalog, { replace: true })
      } else if (location.pathname !== AUTH_REDIRECT_PATH) {
        navigate(AUTH_REDIRECT_PATH, { replace: true })
      }
      return
    }

  }, [loggedIn, currentPatron, hasProfile, authReturnMode, location.pathname, navigate])

  function handleNav(p: Page) {
    setViewingBook(null)
    navigate(PAGE_PATHS[p])
  }

  function handleSearch(q: string) {
    setFilters({ ...EMPTY_FILTERS, query: q })
    setViewingBook(null)
    navigate(PAGE_PATHS.catalog)
  }

  function handleViewBook(book: Book) {
    setViewingBook(book)
    window.scrollTo(0, 0)
  }

  // Book detail renders over whichever route you're on, so closing it just
  // clears the book — no need to remember which page you came from.
  function handleBack() {
    setViewingBook(null)
    window.scrollTo(0, 0)
  }

  async function addToCart(id: string) {
    if (!loggedIn) {
      setLoginMode('login')
      setShowLogin(true)
      return
    }

    if (cartIds.includes(id)) return
    const book = books.find(candidate => candidate.id === id)
    const copy = book?.copies.find(candidate => candidate.status === 'available')
    if (!copy) {
      setCheckoutError('No copy is available for this book right now.')
      return
    }

    try {
      await reserveCopy(copy.fullLabel)
      setCartIds(ids => ids.includes(id) ? ids : [...ids, id])
      setCartCopies(copies => ({ ...copies, [id]: copy.fullLabel }))
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'We could not place a hold on this book.')
    }
  }

  async function removeFromCart(id: string) {
    const copyLabel = cartCopies[id]
    if (copyLabel) {
      try {
        await releaseReservation(copyLabel)
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'We could not release this hold.')
        return
      }
    }
    setCartIds(ids => ids.filter(i => i !== id))
    setCartCopies(copies => {
      const next = { ...copies }
      delete next[id]
      return next
    })
  }

  function toggleCart(id: string) {
    if (!loggedIn) {
      setLoginMode('login')
      setShowLogin(true)
      return
    }

    if (cartIds.includes(id)) {
      void removeFromCart(id)
    } else {
      void addToCart(id)
    }
  }

  function getStoredProfile(email: string | null | undefined) {
    if (!email) return null
    try {
      const raw = localStorage.getItem(`sss-library:patron-profile:${email.toLowerCase()}`)
      if (!raw) return null
      return JSON.parse(raw) as { firstName: string; lastName: string; phone: string }
    } catch {
      return null
    }
  }

  async function submitHoldRequests() {
    if (!loggedIn || !currentPatron) {
      setLoginMode('login')
      setShowLogin(true)
      return
    }

    const storedProfile = getStoredProfile(currentPatron.email)
    const hasProfile = Boolean(currentPatron.firstName && currentPatron.lastName && currentPatron.phone) || Boolean(storedProfile && storedProfile.firstName && storedProfile.lastName && storedProfile.phone)
    if (!hasProfile) {
      setShowProfileForm(true)
      return
    }

    setCheckoutError(null)
    const succeeded: string[] = []
    const failed: string[] = []

    // checkoutBookByCode() looks the copy up in the database rather than in
    // `book.copies`, which comes from a cache up to five minutes old and can't
    // see holds at all — a copy in someone else's cart still reads as
    // 'available' because the hold lives in reserved_until, which column
    // grants hide from the client. It also tries a second copy if the first is
    // taken mid-checkout, turning a lost race into a retry.
    //
    // Sequential rather than parallel: these contend for copies, so firing
    // them together just makes them race each other.
    for (const bookId of cartIds) {
      const title = books.find(book => book.id === bookId)?.title ?? bookId
      try {
        await checkoutBookByCode(bookId)
        succeeded.push(title)
      } catch {
        failed.push(title)
      }
    }

    // Availability has changed, so the cached catalog is now wrong.
    invalidateBooksCache()
    try {
      setBooks(await fetchBooks())
    } catch {
      // A stale catalog isn't worth failing a successful checkout over.
    }

    // Keep whatever failed in the cart. Clearing everything would silently
    // drop books the patron never got.
    const failedIds = cartIds.filter(id => failed.includes(books.find(b => b.id === id)?.title ?? id))
    setCartIds(failedIds)
    setCartCopies(copies => Object.fromEntries(Object.entries(copies).filter(([id]) => failedIds.includes(id))))
    setShowProfileForm(false)

    if (failed.length) {
      setCheckoutError(
        succeeded.length
          ? `Checked out ${succeeded.length}, but couldn't get: ${failed.join(', ')}. Someone may have taken the last copy.`
          : `Couldn't check out ${failed.join(', ')}. Someone may have taken the last copy.`
      )
      return
    }

    setShowCart(false)
  }

  if (!siteUnlocked) {
    return <SiteGate onUnlock={() => { grantSiteAccess(); setSiteUnlocked(true) }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4E9D0' }}>
      <TopNav
        active={page}
        onNav={handleNav}
        cartCount={cartIds.length}
        onCart={() => setShowCart(true)}
        onLogin={() => {
          setLoginMode('login')
          setShowLogin(true)
          setShowUserMenu(false)
        }}
        onProfile={() => {
          setShowUserMenu(false)
          navigate(AUTH_REDIRECT_PATH)
        }}
        onLogout={async () => {
          setAuthLoading({ type: 'logout', message: 'Logging you out...' })
          try {
            await signOut()
          } catch {
            // keep UI state consistent even if sign-out fails from a stale session
          }
          setCurrentPatron(null)
          setIsStaff(false)
          setLoggedIn(false)
          setUserName('')
          setShowUserMenu(false)
          setCartIds([])
          setCartCopies({})
          window.setTimeout(() => setAuthLoading(null), 500)
        }}
        onToggleUserMenu={() => setShowUserMenu(v => !v)}
        onCloseUserMenu={() => setShowUserMenu(false)}
        isStaff={isStaff}
        onAdmin={() => { setShowUserMenu(false); navigate('/staff') }}
        onHolds={() => { setShowUserMenu(false); navigate('/holds') }}
        loggedIn={loggedIn}
        userName={userName}
        showUserMenu={showUserMenu}
      />

      <main style={{ paddingTop: 60 }}>
        {booksLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', color: '#9B7B6A' }}>Loading the catalog…</p>
          </div>
        ) : booksError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 8, textAlign: 'center', padding: 24 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#C8521A' }}>Couldn't load the catalog</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A' }}>{booksError}</p>
          </div>
        ) : viewingBook ? (
          <BookDetailPage
            book={viewingBook}
            allBooks={books}
            onBack={handleBack}
            cartIds={cartIds}
            onAddToCart={addToCart}
            onRemoveFromCart={removeFromCart}
            onViewBook={handleViewBook}
          />
        ) : (
          <Routes>
            <Route path={PAGE_PATHS.home} element={<HomePage books={books} onSearch={handleSearch} onViewBook={handleViewBook} cartIds={cartIds} onAddToCart={toggleCart} />} />
            <Route path={PAGE_PATHS.catalog} element={<CatalogPage books={books} filters={filters} setFilters={setFilters} onViewBook={handleViewBook} cartIds={cartIds} onAddToCart={toggleCart} />} />
            <Route path={PAGE_PATHS.thought} element={<ThoughtPage />} />
            <Route path={PAGE_PATHS.about} element={<AboutPage />} />
            <Route path="/staff" element={<StaffRoute />} />
            <Route path="/holds" element={loggedIn ? <HoldsPage /> : <Navigate to={PAGE_PATHS.home} replace />} />
            <Route
              path={AUTH_REDIRECT_PATH}
              element={authReturnMode === 'login' || !authReady ? (
                <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', color: '#9B7B6A' }}>Checking your sign-in…</p>
                </div>
              ) : currentPatron ? (
                <ProfilePage onboarding={authReturnMode === 'signup'} patron={currentPatron} onSaved={updatedPatron => { setCurrentPatron(updatedPatron); setUserName(updatedPatron.name); navigate(PAGE_PATHS.catalog) }} onDeleted={() => { setCurrentPatron(null); setLoggedIn(false); setUserName(''); navigate(PAGE_PATHS.home, { replace: true }) }} />
              ) : <Navigate to={PAGE_PATHS.home} replace />}
            />
            {/* Unknown URL: send them home rather than rendering a blank main. */}
            <Route path="*" element={<Navigate to={PAGE_PATHS.home} replace />} />
          </Routes>
        )}
      </main>

      {showCart && (
        <CartOverlay
          books={books}
          cartIds={cartIds}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onViewBook={book => { setShowCart(false); handleViewBook(book) }}
          onCheckout={submitHoldRequests}
        />
      )}

      {showLogin && (
        <LoginModal
          mode={loginMode}
          setMode={setLoginMode}
          onClose={() => setShowLogin(false)}
        />
      )}

      {showProfileForm && currentPatron && (
        <ProfilePage
          patron={currentPatron}
          onSaved={updatedPatron => {
            setCurrentPatron(updatedPatron)
            setUserName(updatedPatron.name)
            setShowProfileForm(false)
            setShowUserMenu(false)
          }}
          onDeleted={() => { setCurrentPatron(null); setLoggedIn(false); setUserName(''); setShowProfileForm(false); navigate(PAGE_PATHS.home, { replace: true }) }}
        />
      )}

      {checkoutError && (
        <div style={{ position: 'fixed', left: 24, bottom: 24, zIndex: 250, background: '#2C1810', color: '#FAF3E4', padding: '12px 14px', boxShadow: '0 12px 30px rgba(0,0,0,0.25)', maxWidth: 420 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, margin: 0 }}>{checkoutError}</p>
        </div>
      )}

      {authLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 260, background: 'rgba(44,24,16,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FAF3E4', padding: '28px 32px', boxShadow: '0 20px 50px rgba(44,24,16,0.18)', textAlign: 'center', minWidth: 220 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(200,82,26,0.25)', borderTopColor: '#C8521A', margin: '0 auto 12px', animation: 'spin 0.7s linear infinite' }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: '#2C1810', margin: 0 }}>{authLoading.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}
