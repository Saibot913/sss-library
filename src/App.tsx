import { useState, useMemo, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { fetchBooks, addBook, addCopy, updateBook, updateCopy, type Book, type CopyStatus } from './lib/books'
import { fetchThoughtForTheDay, type ThoughtForTheDay } from './lib/thoughtForTheDay'
import { useBookCover } from './lib/bookCovers'
import { VOLUNTEER_FORM_URL } from './lib/volunteers'
import { REVIEW_FORM_URL, fetchReviewsForBook, fetchLibraryReviews, fetchAllReviewsForStaff, addReview, deleteReview, type Review } from './lib/reviews'
import { SITE_PASSWORD, hasSiteAccess, grantSiteAccess } from './lib/siteAccess'
import { AUTH_REDIRECT_PATH, deleteAccount, getCurrentPatron, onAuthChange, requestSignInCode, signOut, updatePatronProfile, type Patron } from './lib/auth'
import {
  checkoutBook,
  fetchMyActiveReservations,
  fetchMyActiveCheckouts,
  fetchMyCheckoutHistory,
  fetchIsStaff,
  fetchStaffDashboardStats,
  fetchStaffDashboardExtraStats,
  releaseReservation,
  reserveCopy,
  fetchStaffCheckouts,
  fetchStaffReservations,
  staffReturnBook,
  staffForceReleaseReservation,
  type ActiveReservation,
  type ActiveCheckout,
  type CheckoutHistoryRow,
  type DashboardStats,
  type DashboardExtraStats,
  type DashboardBookCount,
  type StaffCheckout,
  type StaffReservation,
} from './lib/checkouts'
import { fetchStaffList, addStaff, removeStaff } from './lib/staff'
import { joinWaitlist, leaveWaitlist, checkIsOnWaitlist } from './lib/waitlist'
import { SITE_NAME, SITE_ADDRESS, MEETING_ROOM } from './lib/siteInfo'
import { invalidateBooksCache } from './lib/books'

// ── Types ─────────────────────────────────────────────────────────────────────

type Page = 'home' | 'catalog' | 'thought' | 'about' | 'staff' | 'dashboard' | 'staffReturns' | 'staffManage' | 'staffBooks' | 'staffReviews'

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
  dashboard: '/staff/dashboard',
  staffReturns: '/staff/returns',
  staffManage: '/staff/manage',
  staff: '/staff',
  staffBooks: '/staff/books',
  staffReviews: '/staff/reviews',
}

function pageFromPath(pathname: string): Page | null {
  return (Object.keys(PAGE_PATHS) as Page[]).find(p => PAGE_PATHS[p] === pathname) ?? null
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

// Quotes from Sathya Sai Baba's discourses, specifically on the practice of reading —
// distinct from the separately-imported "Thought for the Day" feature (see lib/thoughtForTheDay.ts).
const SWAMI_QUOTES = [
  {
    quote: "What I insist upon is putting the things read into practice—at least, a thing or two. Moreover, you must always remember that the book is only a pointer, a guide, a signpost. Reading is not completion of the journey. It is only the first step. Read for the sake of practicing; not for reading's sake.",
    attribution: 'Sathya Sai Baba, Divine Discourse, 18 May 1968',
  },
  {
    quote: 'A large number of books have been written on Swami. But, are you putting into practice even one principle contained in them? … What is the use of reading books if you do not put anything into practice? If you read ten teachings in a book, put at least one of them into practice. Only then will you derive the necessary strength and capability from your reading.',
    attribution: 'Sathya Sai Baba, Divine Discourse, 24 August 2007',
  },
  {
    quote: 'Whatever books you read or whatever you write should be pure. This is the Sadhana relating to study—Sahitya Satwika. If you read or write that which is not pure, it warps your mind. A good book makes for a good mind.',
    attribution: 'Sathya Sai Baba, Divine Discourse, 29 December 1985',
  },
  {
    quote: 'Not information, but transformation; not instruction, but construction should be the aim. Theoretical knowledge is a burden, unless it is practiced, when it can be lightened into Wisdom, and assimilated into daily life.',
    attribution: 'Sathya Sai Baba, Divine Discourse, 3 March 1974',
  },
  {
    quote: 'Cultivate the habit of holy study, develop humility and reverence, adore and serve your parents and be examples and ideals for others. I bless that this goal may be realized by you.',
    attribution: 'Sathya Sai Baba, Divine Discourse, 22 November 1980',
  },
  {
    quote: 'Study with faith and devotion. Delve into the significance and the meaning of what you read; and, always have before you the goal of putting what you read into practice.',
    attribution: 'Sathya Sai Baba, Divine Discourse, 3 March 1974',
  },
  {
    quote: 'This is the proper plan of study—reading, reflection and regular application in life. Study is WORK. Inquiry into the value and applicability of what is studied is WORSHIP; the experience of the validity and value of the practice is WISDOM.',
    attribution: 'Sathya Sai Baba, Divine Discourse, 3 March 1974',
  },
  {
    quote: 'Only those who, by means of discrimination, select the books they read and practice what they read can realize truth and enjoy everlasting bliss. Only those people live worthwhile lives. Therefore, those who seek the highest path and who revel in thoughts of God should strive to read only the life histories of saints and sages and books that help the contemplation of the Divine. Aimless reading of books all and sundry, whatever comes to hand, will make confusion only worse confounded. It gives no profit; it confers no peace.',
    attribution: 'Sathya Sai Baba, Prema Vahini',
  },
  {
    quote: 'You must be humble, but yet strong to resist temptation. Do not yield like cowards to the sly insinuations of the senses. Your time in school has to be used not only in the task of collecting information and earning certain skills that will give you an income on which you can live; it must also be used to acquire the art of being content and calm, collected and courageous. You must also cultivate at school an ardent thirst for knowing the truth of the world and of your own self. Your words must be like honey; your hearts must be as soft as butter; your outlook must be like the lamp, illumining, not confusing. Be like the umpire on the football field, watching the game, judging the play according to the rules laid down, unaffected by success or reverse of this team or that. I want you also to read such books as will prompt you to ask and answer questions about your Self. Read good, elevating literature.',
    attribution: 'Sathya Sai Baba, Divine Discourse, 13 March 1964',
  },
  {
    quote: 'This must be said of this book: It is the authentic Voice of the Divine Phenomenon, that is setting right the moral codes and behaviour of millions of men and women today. And, so, it merits careful and devoted study.',
    attribution: 'N. Kasturi, Preface to Sri Sathya Sai Vahini',
  },
  {
    quote: "This 'Stream of Supreme Peace' (Prasanthi Vahini) tells you what supreme peace is and makes you understand how to earn it, how it can be utilized, and what its attributes are. Every single aspirant has the legitimate right to earn this supreme peace but must learn the path by which it can be earned.",
    attribution: 'N. Kasturi, Preface to Prashanti Vahini',
  },
  {
    quote: 'Dear Reader, this is not just another book on the nature of soul and the technique by which it discovers its Reality. When you turn over the pages, you are actually sitting at the feet of Bhagavan Sri Sathya Sai Baba, the Avatar of the age, come in answer to prayers of all virtuous people and spiritual aspirant to guide them and grant them peace and perfection.',
    attribution: 'N. Kasturi, Preface to Jnana Vahini',
  },
  {
    quote: "This must be said of this book: It is the authentic Voice of the Divine Phenomenon, that is setting right the moral codes and behaviour of millions of men and women today. So, it merits careful and devoted study. The Lord has declared that when ethical standards fall and man forgets or ignores His glorious destiny, He will Himself come down among men and guide humanity along the straight and sacred path. The Lord has come; He is guiding those who accept the guidance; He is calling on all who have strayed away to retrace their steps. Baba's love and wisdom know no bounds, His grace knows no obstacle. He is no hard taskmaster; His solicitude for our welfare and real progress is overwhelming. May this book reveal to you the Mother's love that has made Baba write it, the Father's authority that backs every injunction therein, the Teacher's illumination that lights up every statement, and the Lord's sublime Universality, which invites you to expand your personality into a great Instrument of service.",
    attribution: 'N. Kasturi, Preface to Dharma Vahini',
  },
  {
    quote: 'Bhagavan has announced Himself as the Divine Teacher of Truth, Beauty, and Goodness. By precept and example, through His writings and discourses, letters and conversations, He has been instilling the supreme wisdom and instructing all mankind to translate it into righteous living, inner peace, and universal love.',
    attribution: 'N. Kasturi, Preface to Sri Sathya Sai Vahini',
  },
  {
    quote: 'To sum up, Sathya Sai Vahini is the Gita given to us by the Person who, as the eternal charioteer (Sanathana Sarathi), is eager and ready to hold the reins of our senses, mind, consciousness, ego, and intellect and to guide us safely to the Abode of Supreme Peace (Prasanthi Nilayam), the goal of all mankind.',
    attribution: 'N. Kasturi, Preface to Sri Sathya Sai Vahini',
  },
]

// ── Book cover ────────────────────────────────────────────────────────────────
// Cover art isn't stored in Supabase yet, so it's resolved client-side via the
// Google Books API (see lib/bookCovers.ts) and cached. Falls back to a plain
// placeholder box when no cover is found.

function BookCover({ book, style, fallback, fetchCover = true }: { book: Book; style?: React.CSSProperties; fallback?: React.ReactNode; fetchCover?: boolean }) {
  const [cover, setRef] = useBookCover(book.title, book.author, fetchCover)
  return (
    <div ref={setRef} style={{ width: '100%', height: '100%' }}>
      {cover ? (
        <img src={cover} alt={book.title} style={{ objectFit: 'cover', display: 'block', width: '100%', height: '100%', ...style }} />
      ) : (
        fallback ?? (
          <div style={{ width: '100%', height: '100%', background: '#D4B896', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: 0.35, ...style }}>
            📖
          </div>
        )
      )}
    </div>
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
  onHolds,
  isStaff,
}: {
  active: Page | null
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
  onHolds: () => void
  isStaff: boolean
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
        <span style={{ fontFamily: 'var(--font-mono)', color: '#9B7B6A', fontSize: 12, letterSpacing: '0.1em', marginLeft: 4 }}>Est. 2026</span>
      </div>

      {/* Page links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        {([
          ['home', '01', 'Home'],
          ['catalog', '02', 'Catalog'],
          ['thought', '03', 'Thought for the Day'],
          ['about', '04', 'Community'],
          ...(isStaff ? [['staff', '05', 'Staff'] as const] : []),
        ] as const).map(([id, num, label]) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: active === id ? 'rgba(200,82,26,0.18)' : 'transparent', border: active === id ? '1px solid rgba(200,82,26,0.4)' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { if (active !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (active !== id) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: active === id ? '#C8521A' : '#9B7B6A', letterSpacing: '0.1em' }}>{num}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: active === id ? 600 : 400, color: active === id ? '#FAF3E4' : '#9B7B6A', letterSpacing: '0.06em' }}>{label}</span>
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
              title={userName ? `Settings for ${userName}` : 'Settings'}
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: '#FAF3E4', background: showUserMenu ? 'rgba(200,82,26,0.25)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showUserMenu ? 'rgba(200,82,26,0.5)' : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#C8521A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = showUserMenu ? 'rgba(200,82,26,0.5)' : 'rgba(255,255,255,0.15)')}
            >
              <span style={{ fontSize: 14 }}>⚙</span>
              <span>Settings</span>
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#FAF3E4', border: '1px solid #D4B896', boxShadow: '0 10px 30px rgba(44,24,16,0.15)', minWidth: 180, zIndex: 50 }}>
                <button onClick={onProfile} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid #E7D7B0', color: '#2C1810', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Profile
                </button>
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

        {/* My Books and cart */}
        {loggedIn && (
          <button
            onClick={onHolds}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: '#FAF3E4', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.borderColor = '#C8521A' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
          >
            My Books
          </button>
        )}
        <button
          onClick={onCart}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: '#FAF3E4', background: cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.06)', border: `1px solid ${cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E8693A'; e.currentTarget.style.borderColor = '#E8693A' }}
          onMouseLeave={e => { e.currentTarget.style.background = cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = cartCount > 0 ? '#C8521A' : 'rgba(255,255,255,0.15)' }}
        >
          <span style={{ fontSize: 15 }}>⊡</span>
          <span>Cart</span>
          {cartCount > 0 && (
            <span style={{ background: '#FAF3E4', color: '#C8521A', fontSize: 12, fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cartCount}</span>
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Member Access</span>
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
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email Address</label>
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Hold Requests</span>
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
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', marginBottom: 6 }}>{book.author}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: avail > 0 ? '#4CAF50' : '#C8521A' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: avail > 0 ? '#4CAF50' : '#C8521A' }}>{avail > 0 ? `${avail} of ${book.copiesTotal} available` : 'All copies on loan'}</span>
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
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A', textAlign: 'center', marginTop: 10 }}>Collect your books from the center during opening times.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AccountActivityPage() {
  const [reservations, setReservations] = useState<ActiveReservation[]>([])
  const [checkouts, setCheckouts] = useState<ActiveCheckout[]>([])
  const [history, setHistory] = useState<CheckoutHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadActivity() {
    try {
      setLoading(true)
      setError('')
      const results = await Promise.allSettled([
        fetchMyActiveReservations(),
        fetchMyActiveCheckouts(),
        fetchMyCheckoutHistory(),
      ])
      const [reservationResult, checkoutResult, historyResult] = results
      setReservations(reservationResult.status === 'fulfilled' ? reservationResult.value : [])
      setCheckouts(checkoutResult.status === 'fulfilled' ? checkoutResult.value : [])
      setHistory(historyResult.status === 'fulfilled' ? historyResult.value : [])

      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason instanceof Error ? result.reason.message : 'Unknown account activity error')
      if (failures.length > 0) setError(failures.join(' | '))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load your library activity.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadActivity() }, [])

  return (
    <div style={{ maxWidth: 920, margin: '110px auto 80px', padding: '0 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '1px solid #D4B896', paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Your account</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#2C1810' }}>Library activity</h1>
        </div>
        <button onClick={() => void loadActivity()} disabled={loading} style={{ padding: '9px 14px', background: loading ? '#A56A44' : '#C8521A', color: '#FAF3E4', border: 0, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error && <p style={{ color: '#A52A2A', marginBottom: 18 }}>{error}</p>}
      <ActivitySection title={`Active holds (${reservations.length})`} empty="No active holds. Add a book to your cart to reserve a copy." items={reservations.map(item => ({ key: item.fullLabel, title: item.bookTitle ?? item.bookCode, detail: `${item.fullLabel} · Held until ${new Date(item.reservedUntil).toLocaleString()}` }))} />
      <ActivitySection title={`Currently checked out (${checkouts.length})`} empty="You do not have any currently checked-out books." items={checkouts.map(item => ({ key: item.checkoutId, title: item.bookTitle ?? item.bookCode, detail: `${item.fullLabel} · Checked out ${new Date(item.checkedOutAt).toLocaleDateString()}` }))} />
      <ActivitySection title={`Checkout history (${history.length})`} empty="No checkout history yet." items={history.map(item => ({ key: item.checkoutId, title: item.bookTitle ?? item.bookCode, detail: `${item.fullLabel} · ${new Date(item.checkedOutAt).toLocaleDateString()}${item.returnedAt ? ` · Returned ${new Date(item.returnedAt).toLocaleDateString()}` : ' · Open'}` }))} />
    </div>
  )
}

function ActivitySection({ title, empty, items }: { title: string; empty: string; items: Array<{ key: string; title: string; detail: string }> }) {
  return (
    <section style={{ marginBottom: 22, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#2C1810', marginBottom: 14 }}>{title}</h2>
      {items.length === 0 ? <p style={{ color: '#9B7B6A', fontSize: 13 }}>{empty}</p> : <div style={{ display: 'grid', gap: 8 }}>{items.map(item => <div key={item.key} style={{ padding: '12px 14px', background: '#F4E9D0', border: '1px solid #D4B896' }}><strong style={{ color: '#2C1810' }}>{item.title}</strong><p style={{ color: '#9B7B6A', fontSize: 12, marginTop: 4 }}>{item.detail}</p></div>)}</div>}
    </section>
  )
}

// ── Staff hub ────────────────────────────────────────────────────────────────
// A single "Staff" entry in the account menu leads here instead of
// cluttering that menu with one item per staff page — each page below is
// a box on this one hub, and each of those pages links back here rather
// than only having the site's regular Home link to fall back on.

function StaffBackLink() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(PAGE_PATHS.staff)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#C8521A', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer', padding: 0, marginBottom: 20 }}
    >
      ← Staff Menu
    </button>
  )
}

function StaffHomePage() {
  const navigate = useNavigate()
  const tiles: Array<{ page: Page; title: string; description: string }> = [
    { page: 'staffBooks', title: 'Manage Books', description: 'Add new books or copies, edit details, retire a copy.' },
    { page: 'staffReturns', title: 'Returns & Holds', description: 'Process returns and release stale holds.' },
    { page: 'dashboard', title: 'Metrics', description: 'Checkout traffic, popular books, and other stats.' },
    { page: 'staffReviews', title: 'Reviews', description: 'Publish curated book and library reviews.' },
    { page: 'staffManage', title: 'Manage Staff', description: 'Add or remove staff access.' },
  ]
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#2C1810', marginBottom: 24 }}>Staff</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {tiles.map(tile => (
          <button
            key={tile.page}
            onClick={() => navigate(PAGE_PATHS[tile.page])}
            style={{ textAlign: 'left', padding: 22, background: '#FAF3E4', border: '1px solid #D4B896', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#C8521A')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#D4B896')}
          >
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#2C1810' }}>{tile.title}</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#9B7B6A', lineHeight: 1.5 }}>{tile.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Staff dashboard ──────────────────────────────────────────────────────────

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 160px', background: '#FAF3E4', border: '1px solid #D4B896', padding: '16px 18px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#2C1810', fontWeight: 700 }}>{value}</p>
    </div>
  )
}

function TrafficChart({ traffic }: { traffic: DashboardStats['traffic'] }) {
  const max = Math.max(1, ...traffic.map(t => t.checkouts))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, padding: '0 4px' }}>
      {traffic.map(t => (
        <div
          key={t.day}
          title={`${new Date(t.day).toLocaleDateString()}: ${t.checkouts} checkout${t.checkouts === 1 ? '' : 's'}`}
          style={{
            flex: 1,
            height: `${Math.max(2, (t.checkouts / max) * 100)}%`,
            background: t.checkouts > 0 ? '#C8521A' : '#E7D7B0',
            minWidth: 3,
          }}
        />
      ))}
    </div>
  )
}

function BookCountList({ title, books, emptyMessage }: { title: string; books: DashboardBookCount[]; emptyMessage: string }) {
  return (
    <div style={{ flex: '1 1 320px', background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#2C1810', marginBottom: 12 }}>{title}</h3>
      {books.length === 0 ? (
        <p style={{ color: '#9B7B6A', fontSize: 13 }}>{emptyMessage}</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {books.map(b => (
            <div key={b.book_code} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', background: '#F4E9D0', border: '1px solid #D4B896' }}>
              <span style={{ color: '#2C1810', fontSize: 13 }}>{b.title}</span>
              <span style={{ color: '#9B7B6A', fontSize: 12, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{b.checkout_count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [extra, setExtra] = useState<DashboardExtraStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadStats() {
    try {
      setLoading(true)
      setError('')
      const results = await Promise.allSettled([fetchStaffDashboardStats(), fetchStaffDashboardExtraStats()])
      const [statsResult, extraResult] = results
      setStats(statsResult.status === 'fulfilled' ? statsResult.value : null)
      setExtra(extraResult.status === 'fulfilled' ? extraResult.value : null)

      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason instanceof Error ? result.reason.message : 'Unknown dashboard error')
      if (failures.length > 0) setError(failures.join(' | '))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load the dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadStats() }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '110px auto 80px', padding: '0 28px' }}>
      <StaffBackLink />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '1px solid #D4B896', paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Staff only</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#2C1810' }}>Metrics</h1>
        </div>
        <button onClick={() => void loadStats()} disabled={loading} style={{ padding: '9px 14px', background: loading ? '#A56A44' : '#C8521A', color: '#FAF3E4', border: 0, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error && <p style={{ color: '#A52A2A', marginBottom: 18 }}>{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <StatTile label="Checkouts (30d)" value={String(stats?.totalCheckouts ?? '—')} />
        <StatTile label="Active loans" value={String(stats?.activeLoans ?? '—')} />
        <StatTile label="Avg checkout length" value={extra?.avgCheckoutDays != null ? `${extra.avgCheckoutDays}d` : '—'} />
        <StatTile label="Active holds" value={String(extra?.activeHoldsCount ?? '—')} />
        <StatTile label="Unique patrons ever" value={String(extra?.uniquePatrons ?? '—')} />
      </div>

      <section style={{ marginBottom: 22, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#2C1810', marginBottom: 14 }}>Checkout traffic, last 30 days</h2>
        {stats && stats.traffic.length > 0 ? <TrafficChart traffic={stats.traffic} /> : <p style={{ color: '#9B7B6A', fontSize: 13 }}>No traffic data yet.</p>}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
        <BookCountList title="Top 10 books (30d)" books={stats?.topBooks ?? []} emptyMessage="No checkouts in this window yet." />
        <BookCountList title="Bottom 10 books (30d)" books={stats?.bottomBooks ?? []} emptyMessage="No checkouts in this window yet." />
      </div>

      <section style={{ marginBottom: 22, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#2C1810', marginBottom: 14 }}>Checkouts by category</h2>
        {extra && extra.categoryBreakdown.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {extra.categoryBreakdown.map(c => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', background: '#F4E9D0', border: '1px solid #D4B896' }}>
                <span style={{ color: '#2C1810', fontSize: 13 }}>{c.category}</span>
                <span style={{ color: '#9B7B6A', fontSize: 12, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{c.checkout_count}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ color: '#9B7B6A', fontSize: 13 }}>No category data yet.</p>}
      </section>

      <section style={{ marginBottom: 22, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#2C1810', marginBottom: 6 }}>Might want to follow up</h2>
        <p style={{ color: '#9B7B6A', fontSize: 12, marginBottom: 14 }}>Open checkouts out for more than 30 days. This is an honor-system library — no fines or due dates, just informational.</p>
        {extra && extra.longOutstanding.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {extra.longOutstanding.map(item => (
              <div key={item.fullLabel} style={{ padding: '12px 14px', background: '#F4E9D0', border: '1px solid #D4B896' }}>
                <strong style={{ color: '#2C1810' }}>{item.bookTitle ?? item.bookCode}</strong>
                <p style={{ color: '#9B7B6A', fontSize: 12, marginTop: 4 }}>{item.fullLabel} · {item.patronName}{item.patronEmail ? ` (${item.patronEmail})` : ''} · out {item.daysOut} days since {new Date(item.checkedOutAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        ) : <p style={{ color: '#9B7B6A', fontSize: 13 }}>Nothing has been out longer than 30 days.</p>}
      </section>

      <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#2C1810', marginBottom: 6 }}>Never checked out</h2>
        <p style={{ color: '#9B7B6A', fontSize: 12, marginBottom: 14 }}>Books with zero checkouts ever — useful for weeding decisions or giving a title a push.</p>
        {extra && extra.neverCheckedOut.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {extra.neverCheckedOut.map(b => (
              <div key={b.book_code} style={{ padding: '8px 10px', background: '#F4E9D0', border: '1px solid #D4B896', color: '#2C1810', fontSize: 13 }}>{b.title}</div>
            ))}
          </div>
        ) : <p style={{ color: '#9B7B6A', fontSize: 13 }}>Every book has been checked out at least once.</p>}
      </section>
    </div>
  )
}

function StaffReturnsPage() {
  const [checkouts, setCheckouts] = useState<StaffCheckout[]>([])
  const [reservations, setReservations] = useState<StaffReservation[]>([])
  const [checkoutsLoading, setCheckoutsLoading] = useState(true)
  const [reservationsLoading, setReservationsLoading] = useState(true)
  const [checkoutsError, setCheckoutsError] = useState('')
  const [reservationsError, setReservationsError] = useState('')
  const [message, setMessage] = useState('')
  const [busyLabel, setBusyLabel] = useState<string | null>(null)

  async function loadCheckouts() {
    try {
      setCheckoutsLoading(true)
      setCheckoutsError('')
      setCheckouts(await fetchStaffCheckouts())
    } catch (err) {
      setCheckoutsError(err instanceof Error ? err.message : 'Could not load open checkouts.')
    } finally {
      setCheckoutsLoading(false)
    }
  }

  async function loadReservations() {
    try {
      setReservationsLoading(true)
      setReservationsError('')
      setReservations(await fetchStaffReservations())
    } catch (err) {
      setReservationsError(err instanceof Error ? err.message : 'Could not load active holds.')
    } finally {
      setReservationsLoading(false)
    }
  }

  useEffect(() => { void loadCheckouts(); void loadReservations() }, [])

  async function handleReturn(fullLabel: string, bookTitle: string | null) {
    try {
      setBusyLabel(fullLabel)
      setMessage('')
      await staffReturnBook(fullLabel)
      setMessage(`Marked "${bookTitle ?? fullLabel}" (${fullLabel}) as returned.`)
      await loadCheckouts()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Could not mark ${fullLabel} as returned.`)
    } finally {
      setBusyLabel(null)
    }
  }

  async function handleRelease(fullLabel: string, bookTitle: string | null) {
    try {
      setBusyLabel(fullLabel)
      setMessage('')
      await staffForceReleaseReservation(fullLabel)
      setMessage(`Released hold on "${bookTitle ?? fullLabel}" (${fullLabel}).`)
      await loadReservations()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Could not release the hold on ${fullLabel}.`)
    } finally {
      setBusyLabel(null)
    }
  }

  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid #D4B896' }
  const tdStyle: React.CSSProperties = { padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', borderBottom: '1px solid #E7D7B0' }
  const actionButtonStyle = (disabled: boolean): React.CSSProperties => ({ padding: '7px 12px', background: disabled ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer' })

  return (
    <div style={{ maxWidth: 1000, margin: '110px auto 80px', padding: '0 28px' }}>
      <StaffBackLink />
      <div style={{ borderBottom: '1px solid #D4B896', paddingBottom: 16, marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Staff</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#2C1810' }}>Returns & Holds</h1>
      </div>

      {message && <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', padding: '10px 14px', marginBottom: 18 }}>{message}</p>}

      <section style={{ marginBottom: 32, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#2C1810', marginBottom: 14 }}>Open Checkouts</h2>
        {checkoutsLoading ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>Loading open checkouts…</p>
        ) : checkoutsError ? (
          <p style={{ color: '#A52A2A', fontSize: 13 }}>{checkoutsError}</p>
        ) : checkouts.length === 0 ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>No open checkouts.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Book</th>
                <th style={thStyle}>Patron</th>
                <th style={thStyle}>Checked Out</th>
                <th style={thStyle}>Days Out</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map(item => (
                <tr key={item.checkoutId}>
                  <td style={tdStyle}>{item.bookTitle ?? item.bookCode}<br /><span style={{ fontSize: 12, color: '#9B7B6A' }}>{item.fullLabel}</span></td>
                  <td style={tdStyle}>{item.patronName}<br /><span style={{ fontSize: 12, color: '#9B7B6A' }}>{item.patronEmail}</span></td>
                  <td style={tdStyle}>{new Date(item.checkedOutAt).toLocaleDateString()}</td>
                  <td style={tdStyle}>{item.daysOut}</td>
                  <td style={tdStyle}>
                    <button onClick={() => handleReturn(item.fullLabel, item.bookTitle)} disabled={busyLabel === item.fullLabel} style={actionButtonStyle(busyLabel === item.fullLabel)}>
                      {busyLabel === item.fullLabel ? 'Working…' : 'Mark Returned'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#2C1810', marginBottom: 14 }}>Active Holds</h2>
        {reservationsLoading ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>Loading active holds…</p>
        ) : reservationsError ? (
          <p style={{ color: '#A52A2A', fontSize: 13 }}>{reservationsError}</p>
        ) : reservations.length === 0 ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>No active holds.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Book</th>
                <th style={thStyle}>Reserved By</th>
                <th style={thStyle}>Expires</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map(item => (
                <tr key={item.fullLabel}>
                  <td style={tdStyle}>{item.bookTitle ?? item.bookCode}<br /><span style={{ fontSize: 12, color: '#9B7B6A' }}>{item.fullLabel}</span></td>
                  <td style={tdStyle}>{item.reservedByName}<br /><span style={{ fontSize: 12, color: '#9B7B6A' }}>{item.reservedByEmail}</span></td>
                  <td style={tdStyle}>{new Date(item.reservedUntil).toLocaleString()}</td>
                  <td style={tdStyle}>
                    <button onClick={() => handleRelease(item.fullLabel, item.bookTitle)} disabled={busyLabel === item.fullLabel} style={actionButtonStyle(busyLabel === item.fullLabel)}>
                      {busyLabel === item.fullLabel ? 'Working…' : 'Release Hold'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function StaffManagePage({ currentEmail }: { currentEmail: string }) {
  const [staffList, setStaffList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setLoadError('')
      setStaffList(await fetchStaffList())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the staff list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim()
    if (!email) return
    try {
      setBusy(true)
      setMessage('')
      await addStaff(email)
      setMessage(`Added ${email} as staff.`)
      setNewEmail('')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Could not add ${email} as staff.`)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(email: string) {
    try {
      setBusyEmail(email)
      setMessage('')
      await removeStaff(email)
      setMessage(`Removed staff access for ${email}.`)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Could not remove ${email}.`)
    } finally {
      setBusyEmail(null)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      <StaffBackLink />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#2C1810', marginBottom: 8 }}>Manage Staff</h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', marginBottom: 24 }}>
        Any staff member can add or remove other staff here. You can't remove yourself, and the last remaining staff member can't be removed.
      </p>

      <section style={{ marginBottom: 22, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#2C1810', marginBottom: 14 }}>Add Staff</h2>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10 }}>
          <input
            type="email"
            required
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="someone@example.com"
            style={{ flex: 1, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={busy}
            style={{ padding: '10px 18px', background: busy ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, border: 'none', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            Add
          </button>
        </form>
        {message && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A', marginTop: 12 }}>{message}</p>}
      </section>

      <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#2C1810', marginBottom: 14 }}>Current Staff</h2>
        {loading ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>Loading…</p>
        ) : loadError ? (
          <p style={{ color: '#C8521A', fontSize: 13 }}>{loadError}</p>
        ) : staffList.length === 0 ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>No staff found.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {staffList.map(email => {
              const isSelf = email.toLowerCase() === currentEmail.toLowerCase()
              return (
                <div key={email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F4E9D0', border: '1px solid #D4B896' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810' }}>
                    {email}{isSelf && <span style={{ color: '#9B7B6A' }}> (you)</span>}
                  </span>
                  <button
                    onClick={() => handleRemove(email)}
                    disabled={isSelf || busyEmail === email || staffList.length <= 1}
                    title={isSelf ? "You can't remove your own staff access" : staffList.length <= 1 ? 'Cannot remove the last remaining staff member' : 'Remove staff access'}
                    style={{ padding: '6px 12px', background: 'transparent', color: isSelf || staffList.length <= 1 ? '#D4B896' : '#C8521A', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, border: `1px solid ${isSelf || staffList.length <= 1 ? '#D4B896' : '#C8521A'}`, cursor: isSelf || busyEmail === email || staffList.length <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// Live convention (confirmed against real data, see ME/spec.md §1a): a
// single copy's label is just the book_code (e.g. `BO01`); a second or
// later copy is `book_code.NN`, zero-padded, but NOT necessarily
// gapless (BV02 skips straight from .03 to .05 in the real catalog —
// these look hand-assigned, not generated). So this only ever
// *suggests* a next label; staff can freely overwrite it to match
// whatever's physically written on the book.
function suggestNextCopyLabel(book: Book): string {
  const prefix = `${book.id}.`
  const suffixes = book.copies
    .map(c => (c.fullLabel.startsWith(prefix) ? parseInt(c.fullLabel.slice(prefix.length), 10) : NaN))
    .filter(n => !Number.isNaN(n))
  if (suffixes.length > 0) {
    return `${book.id}.${String(Math.max(...suffixes) + 1).padStart(2, '0')}`
  }
  return book.copies.some(c => c.fullLabel === book.id) ? `${book.id}.02` : book.id
}

// Same "suggest, don't force" idea for book_code: append -2, -3, ... until
// one isn't taken. Never auto-merges on a fuzzy title match — the catalog
// deliberately keeps near-duplicate titles as separate real records (see
// CHANGELOG.md), so only a suggestion is offered, never forced.
function suggestBookCode(base: string, existingCodes: Set<string>): string {
  if (!existingCodes.has(base)) return base
  let n = 2
  while (existingCodes.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

const manageBooksInputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: 15, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }
const manageBooksLabelStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }

function BookSearchPicker({ books, query, setQuery, onPick, placeholder }: { books: Book[]; query: string; setQuery: (q: string) => void; onPick: (book: Book) => void; placeholder: string }) {
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return books.filter(b => b.title.toLowerCase().includes(q)).slice(0, 8)
  }, [query, books])

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} style={manageBooksInputStyle} />
      {matches.length > 0 && (
        <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
          {matches.map(b => (
            <button
              key={b.id}
              onClick={() => onPick(b)}
              style={{ textAlign: 'left', padding: '10px 14px', background: '#F4E9D0', border: '1px solid #D4B896', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 15, color: '#2C1810' }}
            >
              {b.title} <span style={{ color: '#9B7B6A', fontSize: 13 }}>({b.id})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ManageBooksPage({ books, onBooksChanged }: { books: Book[]; onBooksChanged: () => Promise<void> }) {
  // ── Add: pick a mode, "copy" is the common case ──
  const [addMode, setAddMode] = useState<'copy' | 'new'>('copy')

  // Add a copy of an existing book
  const [copySearch, setCopySearch] = useState('')
  const [copyBook, setCopyBook] = useState<Book | null>(null)
  const [copyLabel, setCopyLabel] = useState('')
  const [copyLocation, setCopyLocation] = useState('')
  const [copyBusy, setCopyBusy] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  function pickCopyBook(book: Book) {
    setCopyBook(book)
    setCopySearch(book.title)
    setCopyLabel(suggestNextCopyLabel(book))
  }

  async function handleAddCopy(e: React.FormEvent) {
    e.preventDefault()
    if (!copyBook) return
    try {
      setCopyBusy(true)
      setCopyMessage('')
      await addCopy(copyBook.id, copyLabel.trim(), copyLocation.trim())
      setCopyMessage(`Added copy ${copyLabel.trim()} of "${copyBook.title}".`)
      setCopyBook(null)
      setCopySearch('')
      setCopyLabel('')
      setCopyLocation('')
      await onBooksChanged()
    } catch (err) {
      setCopyMessage(err instanceof Error ? err.message : 'Could not add that copy.')
    } finally {
      setCopyBusy(false)
    }
  }

  // Add a brand new book
  const existingCodes = useMemo(() => new Set(books.map(b => b.id)), [books])
  const [newTitle, setNewTitle] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [newYear, setNewYear] = useState('')
  const [newPublisher, setNewPublisher] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [newBookCode, setNewBookCode] = useState('')
  const [newBookCodeTouched, setNewBookCodeTouched] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newLabelTouched, setNewLabelTouched] = useState(false)
  const [newLocation, setNewLocation] = useState('')
  const [newBusy, setNewBusy] = useState(false)
  const [newMessage, setNewMessage] = useState('')

  const titleMatches = useMemo(() => {
    const q = newTitle.trim().toLowerCase()
    if (q.length < 3) return []
    return books.filter(b => b.title.toLowerCase().includes(q)).slice(0, 5)
  }, [newTitle, books])

  function deriveCode(title: string) {
    const base = title.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'BOOK'
    return suggestBookCode(base, existingCodes)
  }

  function handleNewTitleChange(value: string) {
    setNewTitle(value)
    if (!newBookCodeTouched) {
      const suggested = deriveCode(value)
      setNewBookCode(suggested)
      if (!newLabelTouched) setNewLabel(suggested)
    }
  }

  async function handleAddBook(e: React.FormEvent) {
    e.preventDefault()
    try {
      setNewBusy(true)
      setNewMessage('')
      await addBook({
        bookCode: newBookCode.trim(),
        title: newTitle.trim(),
        author: newAuthor.trim(),
        yearPublished: newYear.trim(),
        publishedBy: newPublisher.trim(),
        category: newCategory.trim(),
        tags: newTags.trim(),
        summary: newSummary.trim(),
        fullLabel: newLabel.trim(),
        location: newLocation.trim(),
      })
      setNewMessage(`Added "${newTitle.trim()}" (${newBookCode.trim()}).`)
      setNewTitle('')
      setNewAuthor('')
      setNewYear('')
      setNewPublisher('')
      setNewCategory('')
      setNewTags('')
      setNewSummary('')
      setNewBookCode('')
      setNewBookCodeTouched(false)
      setNewLabel('')
      setNewLabelTouched(false)
      setNewLocation('')
      await onBooksChanged()
    } catch (err) {
      setNewMessage(err instanceof Error ? err.message : 'Could not add that book.')
    } finally {
      setNewBusy(false)
    }
  }

  // ── Edit an existing book ──
  const [editSearch, setEditSearch] = useState('')
  const [editBook, setEditBook] = useState<Book | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editPublisher, setEditPublisher] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editMessage, setEditMessage] = useState('')
  const [copyEdits, setCopyEdits] = useState<Record<string, { location: string; status: CopyStatus }>>({})
  const [copyBusyLabel, setCopyBusyLabel] = useState<string | null>(null)

  function pickEditBook(book: Book) {
    setEditBook(book)
    setEditSearch(book.title)
    setEditTitle(book.title)
    setEditAuthor(book.author)
    setEditYear(book.year)
    setEditPublisher(book.publisher)
    setEditCategory(book.category)
    setEditTags(book.keywords.join(', '))
    setEditSummary(book.summary)
    setEditMessage('')
    setCopyEdits(Object.fromEntries(book.copies.map(c => [
      c.fullLabel,
      { location: '', status: (c.status === 'lost' || c.status === 'damaged' || c.status === 'withdrawn' ? c.status : 'available') as CopyStatus },
    ])))
  }

  async function handleEditBook(e: React.FormEvent) {
    e.preventDefault()
    if (!editBook) return
    if (!editTitle.trim()) {
      setEditMessage('Title cannot be empty.')
      return
    }
    try {
      setEditBusy(true)
      setEditMessage('')
      await updateBook({
        bookCode: editBook.id,
        title: editTitle.trim(),
        author: editAuthor.trim(),
        yearPublished: editYear.trim(),
        publishedBy: editPublisher.trim(),
        category: editCategory.trim(),
        tags: editTags.trim(),
        summary: editSummary.trim(),
      })
      setEditMessage('Saved.')
      await onBooksChanged()
    } catch (err) {
      setEditMessage(err instanceof Error ? err.message : 'Could not save those changes.')
    } finally {
      setEditBusy(false)
    }
  }

  async function handleSaveCopy(fullLabel: string) {
    const edit = copyEdits[fullLabel]
    if (!edit) return
    try {
      setCopyBusyLabel(fullLabel)
      await updateCopy(fullLabel, edit.location.trim(), edit.status)
      setEditMessage(`Saved ${fullLabel}.`)
      await onBooksChanged()
    } catch (err) {
      setEditMessage(err instanceof Error ? err.message : `Could not save ${fullLabel}.`)
    } finally {
      setCopyBusyLabel(null)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <StaffBackLink />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#2C1810', marginBottom: 24 }}>Manage Books</h1>

      {/* ── Add a Book ── */}
      <section style={{ marginBottom: 32, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Add a Book</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setAddMode('copy')} style={{ padding: '8px 14px', background: addMode === 'copy' ? '#C8521A' : 'transparent', color: addMode === 'copy' ? '#FAF3E4' : '#2C1810', border: '1px solid #C8521A', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600 }}>Add a copy of an existing book</button>
          <button onClick={() => setAddMode('new')} style={{ padding: '8px 14px', background: addMode === 'new' ? '#C8521A' : 'transparent', color: addMode === 'new' ? '#FAF3E4' : '#2C1810', border: '1px solid #C8521A', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600 }}>Add a brand new book</button>
        </div>

        {addMode === 'copy' ? (
          <form onSubmit={handleAddCopy} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={manageBooksLabelStyle}>Find the book</label>
              <BookSearchPicker books={books} query={copySearch} setQuery={q => { setCopySearch(q); setCopyBook(null) }} onPick={pickCopyBook} placeholder="Search by title…" />
            </div>
            {copyBook && (
              <>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A' }}>
                  Adding a copy of <strong style={{ color: '#2C1810' }}>{copyBook.title}</strong> ({copyBook.id}). It already has {copyBook.copies.length} {copyBook.copies.length === 1 ? 'copy' : 'copies'}.
                </p>
                <div>
                  <label style={manageBooksLabelStyle}>Copy label (edit if the physical book has a different number)</label>
                  <input value={copyLabel} onChange={e => setCopyLabel(e.target.value)} required style={manageBooksInputStyle} />
                </div>
                <div>
                  <label style={manageBooksLabelStyle}>Shelf location</label>
                  <input value={copyLocation} onChange={e => setCopyLocation(e.target.value)} required style={manageBooksInputStyle} />
                </div>
                <button type="submit" disabled={copyBusy} style={{ padding: '10px 18px', background: copyBusy ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, border: 'none', cursor: copyBusy ? 'not-allowed' : 'pointer', justifySelf: 'start' }}>Add Copy</button>
              </>
            )}
            {copyMessage && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A' }}>{copyMessage}</p>}
          </form>
        ) : (
          <form onSubmit={handleAddBook} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={manageBooksLabelStyle}>Title</label>
              <input value={newTitle} onChange={e => handleNewTitleChange(e.target.value)} required style={manageBooksInputStyle} />
            </div>
            {titleMatches.length > 0 && (
              <div style={{ background: '#F4E9D0', border: '1px solid #D4B896', padding: 12 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', marginBottom: 8 }}>This looks similar to a book already in the catalog — add a copy instead?</p>
                <div style={{ display: 'grid', gap: 4 }}>
                  {titleMatches.map(b => (
                    <button key={b.id} type="button" onClick={() => { setAddMode('copy'); pickCopyBook(b) }} style={{ textAlign: 'left', padding: '6px 8px', background: 'transparent', border: '1px solid #D4B896', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: '#2C1810' }}>
                      {b.title} <span style={{ color: '#9B7B6A' }}>({b.id})</span> — add a copy of this
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label style={manageBooksLabelStyle}>Author</label>
              <input value={newAuthor} onChange={e => setNewAuthor(e.target.value)} style={manageBooksInputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={manageBooksLabelStyle}>Year published</label>
                <input value={newYear} onChange={e => setNewYear(e.target.value)} style={manageBooksInputStyle} />
              </div>
              <div>
                <label style={manageBooksLabelStyle}>Publisher</label>
                <input value={newPublisher} onChange={e => setNewPublisher(e.target.value)} style={manageBooksInputStyle} />
              </div>
            </div>
            <div>
              <label style={manageBooksLabelStyle}>Category</label>
              <input value={newCategory} onChange={e => setNewCategory(e.target.value)} style={manageBooksInputStyle} />
            </div>
            <div>
              <label style={manageBooksLabelStyle}>Tags (comma-separated)</label>
              <input value={newTags} onChange={e => setNewTags(e.target.value)} style={manageBooksInputStyle} />
            </div>
            <div>
              <label style={manageBooksLabelStyle}>Summary</label>
              <textarea value={newSummary} onChange={e => setNewSummary(e.target.value)} rows={3} style={{ ...manageBooksInputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={manageBooksLabelStyle}>Book code {existingCodes.has(newBookCode) && <span style={{ color: '#C8521A' }}>— already taken</span>}</label>
                <input value={newBookCode} onChange={e => { setNewBookCode(e.target.value); setNewBookCodeTouched(true) }} required style={manageBooksInputStyle} />
              </div>
              <div>
                <label style={manageBooksLabelStyle}>First copy's label</label>
                <input value={newLabel} onChange={e => { setNewLabel(e.target.value); setNewLabelTouched(true) }} required style={manageBooksInputStyle} />
              </div>
            </div>
            <div>
              <label style={manageBooksLabelStyle}>Shelf location</label>
              <input value={newLocation} onChange={e => setNewLocation(e.target.value)} required style={manageBooksInputStyle} />
            </div>
            <button type="submit" disabled={newBusy} style={{ padding: '10px 18px', background: newBusy ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, border: 'none', cursor: newBusy ? 'not-allowed' : 'pointer', justifySelf: 'start' }}>Add Book</button>
            {newMessage && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A' }}>{newMessage}</p>}
          </form>
        )}
      </section>

      {/* ── Edit a Book ── */}
      <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#2C1810', marginBottom: 14 }}>Edit a Book</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={manageBooksLabelStyle}>Find the book</label>
          <BookSearchPicker books={books} query={editSearch} setQuery={q => { setEditSearch(q); setEditBook(null) }} onPick={pickEditBook} placeholder="Search by title…" />
        </div>

        {editBook && (
          <>
            <form onSubmit={handleEditBook} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810' }}>
                <span style={{ color: '#9B7B6A', fontSize: 12 }}>{editBook.id}</span>
              </p>
              <div>
                <label style={manageBooksLabelStyle}>Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={manageBooksInputStyle} />
              </div>
              <div>
                <label style={manageBooksLabelStyle}>Author</label>
                <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} style={manageBooksInputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={manageBooksLabelStyle}>Year published</label>
                  <input value={editYear} onChange={e => setEditYear(e.target.value)} style={manageBooksInputStyle} />
                </div>
                <div>
                  <label style={manageBooksLabelStyle}>Publisher</label>
                  <input value={editPublisher} onChange={e => setEditPublisher(e.target.value)} style={manageBooksInputStyle} />
                </div>
              </div>
              <div>
                <label style={manageBooksLabelStyle}>Category</label>
                <input value={editCategory} onChange={e => setEditCategory(e.target.value)} style={manageBooksInputStyle} />
              </div>
              <div>
                <label style={manageBooksLabelStyle}>Tags (comma-separated)</label>
                <input value={editTags} onChange={e => setEditTags(e.target.value)} style={manageBooksInputStyle} />
              </div>
              <div>
                <label style={manageBooksLabelStyle}>Summary</label>
                <textarea value={editSummary} onChange={e => setEditSummary(e.target.value)} rows={3} style={{ ...manageBooksInputStyle, resize: 'vertical' }} />
              </div>
              <button type="submit" disabled={editBusy} style={{ padding: '10px 18px', background: editBusy ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, border: 'none', cursor: editBusy ? 'not-allowed' : 'pointer', justifySelf: 'start' }}>Save Book Details</button>
            </form>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#2C1810', marginBottom: 10 }}>Copies</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {editBook.copies.map(copy => {
                const edit = copyEdits[copy.fullLabel] ?? { location: '', status: 'available' as CopyStatus }
                const isCheckedOut = copy.status === 'checked_out'
                return (
                  <div key={copy.fullLabel} style={{ padding: '10px 12px', background: '#F4E9D0', border: '1px solid #D4B896', display: 'grid', gap: 8 }}>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#2C1810' }}>{copy.fullLabel}</strong>
                    {isCheckedOut ? (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A' }}>Checked out — process a return on the Returns & Holds page before editing this copy.</p>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 160px' }}>
                          <label style={manageBooksLabelStyle}>Location</label>
                          <input
                            value={edit.location}
                            onChange={e => setCopyEdits(prev => ({ ...prev, [copy.fullLabel]: { ...edit, location: e.target.value } }))}
                            placeholder="e.g. shelf location"
                            style={manageBooksInputStyle}
                          />
                        </div>
                        <div>
                          <label style={manageBooksLabelStyle}>Status</label>
                          <select
                            value={edit.status}
                            onChange={e => setCopyEdits(prev => ({ ...prev, [copy.fullLabel]: { ...edit, status: e.target.value as CopyStatus } }))}
                            style={{ ...manageBooksInputStyle, width: 'auto' }}
                          >
                            <option value="available">Available</option>
                            <option value="lost">Lost</option>
                            <option value="damaged">Damaged</option>
                            <option value="withdrawn">Withdrawn</option>
                          </select>
                        </div>
                        <button
                          onClick={() => handleSaveCopy(copy.fullLabel)}
                          disabled={copyBusyLabel === copy.fullLabel}
                          style={{ padding: '9px 14px', background: copyBusyLabel === copy.fullLabel ? '#A56A44' : '#C8521A', color: '#FAF3E4', border: 'none', cursor: copyBusyLabel === copy.fullLabel ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600 }}
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {editMessage && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A', marginTop: 12 }}>{editMessage}</p>}
          </>
        )}
      </section>
    </div>
  )
}

function StaffReviewsPage({ books }: { books: Book[] }) {
  const [kind, setKind] = useState<'book' | 'library'>('book')
  const [bookSearch, setBookSearch] = useState('')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [reviewerName, setReviewerName] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [busy, setBusy] = useState(false)
  const [formMessage, setFormMessage] = useState('')

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const bookTitleByCode = useMemo(() => new Map(books.map(b => [b.id, b.title])), [books])

  async function load() {
    try {
      setLoading(true)
      setLoadError('')
      setReviews(await fetchAllReviewsForStaff())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load reviews.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (kind === 'book' && !selectedBook) return
    try {
      setBusy(true)
      setFormMessage('')
      await addReview({
        bookCode: kind === 'book' ? selectedBook!.id : null,
        reviewerName: reviewerName.trim(),
        reviewText: reviewText.trim(),
      })
      setFormMessage('Published.')
      setReviewerName('')
      setReviewText('')
      setSelectedBook(null)
      setBookSearch('')
      await load()
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : 'Could not publish that review.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      setBusyId(id)
      await deleteReview(id)
      await load()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not delete that review.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <StaffBackLink />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#2C1810', marginBottom: 8 }}>Reviews</h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', marginBottom: 24 }}>
        Read submissions in the Reviews &amp; Feedback spreadsheet, then publish the ones worth featuring here. A book review shows up on that book's page; a library review shows up in the Community tab.
      </p>

      <section style={{ marginBottom: 32, background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#2C1810', marginBottom: 14 }}>Publish a Review</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setKind('book')} style={{ padding: '8px 14px', background: kind === 'book' ? '#C8521A' : 'transparent', color: kind === 'book' ? '#FAF3E4' : '#2C1810', border: '1px solid #C8521A', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600 }}>Book Review</button>
          <button onClick={() => setKind('library')} style={{ padding: '8px 14px', background: kind === 'library' ? '#C8521A' : 'transparent', color: kind === 'library' ? '#FAF3E4' : '#2C1810', border: '1px solid #C8521A', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600 }}>Library Review</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          {kind === 'book' && (
            <div>
              <label style={manageBooksLabelStyle}>Which book</label>
              <BookSearchPicker books={books} query={bookSearch} setQuery={q => { setBookSearch(q); setSelectedBook(null) }} onPick={b => { setSelectedBook(b); setBookSearch(b.title) }} placeholder="Search by title…" />
              {selectedBook && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A', marginTop: 6 }}>Reviewing <strong style={{ color: '#2C1810' }}>{selectedBook.title}</strong></p>}
            </div>
          )}
          <div>
            <label style={manageBooksLabelStyle}>Reviewer name</label>
            <input value={reviewerName} onChange={e => setReviewerName(e.target.value)} required style={manageBooksInputStyle} />
          </div>
          <div>
            <label style={manageBooksLabelStyle}>Review</label>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} required rows={4} style={{ ...manageBooksInputStyle, resize: 'vertical' }} />
          </div>
          <button type="submit" disabled={busy || (kind === 'book' && !selectedBook)} style={{ padding: '10px 18px', background: busy ? '#A56A44' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', justifySelf: 'start' }}>Publish</button>
          {formMessage && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A' }}>{formMessage}</p>}
        </form>
      </section>

      <section style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#2C1810', marginBottom: 14 }}>Published Reviews</h2>
        {loading ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>Loading…</p>
        ) : loadError ? (
          <p style={{ color: '#C8521A', fontSize: 13 }}>{loadError}</p>
        ) : reviews.length === 0 ? (
          <p style={{ color: '#9B7B6A', fontSize: 13 }}>No reviews published yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {reviews.map(review => (
              <div key={review.id} style={{ padding: '12px 14px', background: '#F4E9D0', border: '1px solid #D4B896', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {review.bookCode ? (bookTitleByCode.get(review.bookCode) ?? review.bookCode) : 'Library Review'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', marginBottom: 4 }}>{review.reviewText}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A' }}>— {review.reviewerName}</p>
                </div>
                <button
                  onClick={() => handleDelete(review.id)}
                  disabled={busyId === review.id}
                  style={{ padding: '6px 12px', background: 'transparent', color: '#C8521A', border: '1px solid #C8521A', cursor: busyId === review.id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, alignSelf: 'start', flexShrink: 0 }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ProfilePage({
  patron,
  onSaved,
  onDeleted,
  onboarding = false,
  compact = false,
}: {
  patron: Patron | null
  onSaved: (updatedPatron: Patron) => void
  onDeleted: () => void
  onboarding?: boolean
  compact?: boolean
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
    <div style={{ maxWidth: 640, margin: compact ? '0 auto' : '120px auto 80px', padding: compact ? 0 : '0 20px' }}>
      <div style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: '32px 28px', boxShadow: '0 20px 50px rgba(44,24,16,0.08)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{onboarding ? 'Finish sign up' : 'Profile'}</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#2C1810', margin: '0 0 16px' }}>{onboarding ? 'Create your library profile' : 'Your contact details'}</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', marginBottom: 20 }}>{onboarding ? 'Add your name and phone number to finish creating your account. You can edit these details later from Profile.' : 'This information is saved to your account. Changing your email may require confirmation from the new address.'}</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Phone Number</label>
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
            {!onboarding && <button type="button" onClick={() => navigate('/account')} style={{ padding: '12px 18px', background: '#E9DCC3', color: '#2C1810', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
              My holds & checkouts
            </button>}
          </div>
          {!onboarding && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #D4B896' }}>
              <button type="button" onClick={handleDelete} disabled={saving || deleting} style={{ padding: '10px 14px', background: 'transparent', color: '#A52A2A', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, border: '1px solid #A52A2A', cursor: saving || deleting ? 'not-allowed' : 'pointer', opacity: saving || deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting account…' : 'Delete account'}
              </button>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A', marginTop: 8 }}>This action is irreversible.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
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
  loggedIn,
  onJoinWaitlist,
  onLeaveWaitlist,
}: {
  book: Book
  allBooks: Book[]
  onBack: () => void
  cartIds: string[]
  onAddToCart: (id: string) => void
  onRemoveFromCart: (id: string) => void
  onViewBook: (book: Book) => void
  loggedIn: boolean
  onJoinWaitlist: (bookId: string) => Promise<boolean>
  onLeaveWaitlist: (bookId: string) => Promise<boolean>
}) {
  const avail = book.copiesAvailable
  const inCart = cartIds.includes(book.id)

  const [reviews, setReviews] = useState<Review[]>([])
  useEffect(() => {
    let cancelled = false
    fetchReviewsForBook(book.id).then(data => { if (!cancelled) setReviews(data) }).catch(() => { if (!cancelled) setReviews([]) })
    return () => { cancelled = true }
  }, [book.id])

  // Only relevant once every copy is on loan — no point checking waitlist
  // membership for a book that's available to reserve outright.
  const [onWaitlist, setOnWaitlist] = useState(false)
  const [waitlistBusy, setWaitlistBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (loggedIn && avail === 0) {
      checkIsOnWaitlist(book.id).then(result => { if (!cancelled) setOnWaitlist(result) }).catch(() => { if (!cancelled) setOnWaitlist(false) })
    } else {
      setOnWaitlist(false)
    }
    return () => { cancelled = true }
  }, [book.id, avail, loggedIn])

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
        <BookCover book={book} fetchCover fallback={<div style={{ position: 'absolute', inset: 0, background: '#2C1810' }} />} />
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
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
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>About this Book</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#2C1810', lineHeight: 1.8 }}>{book.summary}</p>
          </section>

          {/* Details grid */}
          <section style={{ marginBottom: 48, padding: '24px 28px', background: '#FAF3E4', border: '1px solid #D4B896' }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Publication Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
              {[
                { label: 'Publisher', val: book.publisher },
                { label: 'Year', val: book.year },
                { label: 'Category', val: book.category },
              ].map(m => (
                <div key={m.label}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{m.label}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810' }}>{m.val}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #D4B896' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Keywords</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {book.keywords.map(k => (
                  <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#5C3D2E', background: '#F0C9A8', padding: '3px 9px', letterSpacing: '0.06em' }}>{k}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Reader reviews — staff-curated, see the Staff Reviews page */}
          {reviews.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Reader Reviews</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {reviews.map(review => (
                  <div key={review.id} style={{ padding: '16px 18px', background: '#FAF3E4', border: '1px solid #D4B896' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', lineHeight: 1.6, marginBottom: 8 }}>{review.reviewText}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>— {review.reviewerName}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Similar titles */}
          {similar.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Similar Titles</h2>
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
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: '#2C1810', lineHeight: 1.3, marginBottom: 2 }}>{s.title}</h3>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', marginBottom: 4 }}>{s.author}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: sAvail > 0 ? '#4CAF50' : '#C8521A' }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: sAvail > 0 ? '#4CAF50' : '#C8521A' }}>{sAvail > 0 ? `${sAvail} available` : 'On loan'}</span>
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

              {/* Add to cart / join waitlist */}
              {avail > 0 ? (
                <button
                  onClick={() => inCart ? onRemoveFromCart(book.id) : onAddToCart(book.id)}
                  style={{ width: '100%', padding: '13px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', transition: 'background 0.2s', marginBottom: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = inCart ? '#5C3D2E' : '#E8693A')}
                  onMouseLeave={e => (e.currentTarget.style.background = inCart ? '#2C1810' : '#C8521A')}
                >
                  {inCart ? '✓ Added to Cart' : '+ Add to Cart'}
                </button>
              ) : (
                <button
                  disabled={waitlistBusy}
                  onClick={async () => {
                    setWaitlistBusy(true)
                    const succeeded = onWaitlist ? await onLeaveWaitlist(book.id) : await onJoinWaitlist(book.id)
                    if (succeeded) setOnWaitlist(!onWaitlist)
                    setWaitlistBusy(false)
                  }}
                  style={{ width: '100%', padding: '13px', background: onWaitlist ? '#2C1810' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: waitlistBusy ? 'default' : 'pointer', opacity: waitlistBusy ? 0.7 : 1, transition: 'background 0.2s', marginBottom: 10 }}
                  onMouseEnter={e => { if (!waitlistBusy) e.currentTarget.style.background = onWaitlist ? '#5C3D2E' : '#E8693A' }}
                  onMouseLeave={e => { if (!waitlistBusy) e.currentTarget.style.background = onWaitlist ? '#2C1810' : '#C8521A' }}
                >
                  {onWaitlist ? "✓ You're on the Waitlist" : 'Join Waitlist'}
                </button>
              )}

              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A', textAlign: 'center' }}>
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#FAF3E4', background: 'rgba(200,82,26,0.5)', padding: '3px 8px', letterSpacing: '0.06em' }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#FAF3E4', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, opacity: 0.7 }}>✕</button>
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={() => setFilters(EMPTY_FILTERS)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', letterSpacing: '0.06em' }}>Clear ({activeFilterCount})</button>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#9B7B6A' }}>{hasSearched ? `${results.length} result${results.length !== 1 ? 's' : ''}` : `${books.length} total items`}</p>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { label: 'Title or Author', key: 'query' as const, placeholder: 'e.g. Sathya Sai, Kasturi…', type: 'text' },
            { label: 'Keywords', key: 'keywords' as const, placeholder: 'e.g. love, service…', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={filters[f.key] as string} onChange={e => setF(f.key, e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 15, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
            </div>
          ))}

          {[
            { label: 'Category', key: 'category' as const, opts: categories },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <select value={filters[f.key] as string} onChange={e => setF(f.key, e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 15, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                {f.opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Year Range</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" placeholder="From" value={filters.yearFrom} onChange={e => setF('yearFrom', e.target.value)} style={{ width: '50%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 15, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
              <span style={{ color: '#9B7B6A' }}>—</span>
              <input type="number" placeholder="To" value={filters.yearTo} onChange={e => setF('yearTo', e.target.value)} style={{ width: '50%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 15, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
            </div>
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Availability</label>
            {([['all', 'All items'], ['available', 'Available now'], ['checkedout', 'On loan']] as const).map(([val, label]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                <div onClick={() => setF('availability', val)} style={{ width: 16, height: 16, border: `1.5px solid ${filters.availability === val ? '#C8521A' : '#D4B896'}`, background: filters.availability === val ? '#C8521A' : 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {filters.availability === val && <span style={{ color: '#FAF3E4', fontSize: 12 }}>✓</span>}
                </div>
                <span onClick={() => setF('availability', val)} style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', cursor: 'pointer' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* Main results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top search bar */}
        <div style={{ background: '#2C1810', padding: '18px 28px 16px', position: 'sticky', top: 60, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#FAF3E4', flexShrink: 0 }}>The Catalog</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#FAF3E4', maxWidth: 480 }} onFocusCapture={e => (e.currentTarget.style.outline = '2px solid #C8521A')} onBlurCapture={e => (e.currentTarget.style.outline = 'none')}>
              <span style={{ padding: '0 12px', color: '#9B7B6A', fontSize: 16 }}>⌕</span>
              <input type="text" placeholder="Search title, author…" value={filters.query} onChange={e => setF('query', e.target.value)} style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: 'transparent', border: 'none', outline: 'none' }} />
              {filters.query && <button onClick={() => setF('query', '')} style={{ padding: '0 10px', color: '#9B7B6A', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', flexShrink: 0 }}>{results.length} results</span>
          </div>

          {activeFilterCount > 0 && (
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
              {results.map(book => {
                const avail = book.copiesAvailable
                const inCart = cartIds.includes(book.id)
                return (
                  <div key={book.id} style={{ background: '#FAF3E4', padding: 26, display: 'flex', flexDirection: 'column', gap: 0, borderRight: '1px solid #D4B896', borderBottom: '1px solid #D4B896' }}>
                    <div
                      onClick={() => onViewBook(book)}
                      style={{ cursor: 'pointer', flex: 1 }}
                    >
                      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <div style={{ width: 68, height: 86, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                          <BookCover book={book} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: '#2C1810', lineHeight: 1.3, marginBottom: 4 }}>{book.title}</h3>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#5C3D2E' }}>{book.author} · {book.year}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: avail > 0 ? '#4CAF50' : '#C8521A' }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: avail > 0 ? '#4CAF50' : '#C8521A' }}>{avail > 0 ? `${avail}/${book.copiesTotal} available` : 'All on loan'}</span>
                          </div>
                        </div>
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#9B7B6A', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 14 }}>
                        {book.summary}
                      </p>
                    </div>
                    <div style={{ borderTop: '1px solid #D4B896', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A' }}>{book.category}</span>
                      {avail === 0 ? (
                        <button disabled style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em', padding: '6px 14px', background: '#E9DCC3', color: '#9B7B6A', border: '1px solid #D4B896', cursor: 'not-allowed' }}>
                          Not available
                        </button>
                      ) : (
                        <button onClick={() => onAddToCart(book.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em', padding: '6px 14px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
                          {inCart ? '✓ Added' : '+ Cart'}
                        </button>
                      )}
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Not available?</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: '#2C1810' }}>You might also enjoy</h3>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A', marginLeft: 'auto' }}>Similar themes · Available now</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {recommendations.map(book => {
                  const avail = book.copiesAvailable
                  const inCart = cartIds.includes(book.id)
                  const sharedKw = book.keywords.filter(k => unavailableResults.some(u => u.keywords.includes(k)))
                  return (
                    <div key={book.id} style={{ background: '#F4E9D0', border: '1px solid #D4B896', padding: 16 }}>
                      <div onClick={() => onViewBook(book)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 44, height: 58, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                            <BookCover book={book} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: '#2C1810', lineHeight: 1.3, marginBottom: 3 }}>{book.title}</h4>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', marginBottom: 4 }}>{book.author}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4CAF50' }} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4CAF50' }}>{avail} available</span>
                            </div>
                          </div>
                        </div>
                        {sharedKw.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                            {sharedKw.slice(0, 3).map(k => <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', background: 'rgba(200,82,26,0.1)', padding: '2px 6px', border: '1px solid rgba(200,82,26,0.2)' }}>{k}</span>)}
                          </div>
                        )}
                      </div>
                      <button onClick={() => onAddToCart(book.id)} style={{ marginTop: 6, width: '100%', padding: '7px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', border: 'none', cursor: 'pointer' }}>
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

  // Quote changes every hour on the hour — hours-since-epoch picks the index into
  // SWAMI_QUOTES, and a timer re-renders right as each new hour begins so the
  // page doesn't need a manual refresh to pick it up.
  const [hoursSinceEpoch, setHoursSinceEpoch] = useState(() => Math.floor(Date.now() / 3600000))
  useEffect(() => {
    const msUntilNextHour = 3600000 - (Date.now() % 3600000)
    const timeout = setTimeout(() => setHoursSinceEpoch(Math.floor(Date.now() / 3600000)), msUntilNextHour + 50)
    return () => clearTimeout(timeout)
  }, [hoursSinceEpoch])
  const swamiQuote = useMemo(() => SWAMI_QUOTES[hoursSinceEpoch % SWAMI_QUOTES.length], [hoursSinceEpoch])

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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.2em', color: '#C8521A', textTransform: 'uppercase', marginBottom: 12, display: 'block' }}>Sai Library</span>
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
        </div>
      </section>

      {/* Hours */}
      <div style={{ background: '#2C1810', padding: '14px 64px', display: 'flex', gap: 48 }}>
        {[{ day: 'Mon – Thu', hours: '9:00 AM – 8:00 PM' }, { day: 'Fri – Sat', hours: '9:00 AM – 6:00 PM' }, { day: 'Sunday', hours: '12:00 PM – 5:00 PM' }].map(h => (
          <div key={h.day} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', color: '#C8521A', textTransform: 'uppercase' }}>{h.day}</span>
            <span style={{ color: '#9B7B6A', fontSize: 12 }}>—</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#D4B896' }}>{h.hours}</span>
          </div>
        ))}
      </div>

      {/* Recommended books */}
      <section style={{ padding: '56px 64px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32, borderBottom: '1px solid #D4B896', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>§ 01</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: '#2C1810' }}>Recommended Books</h2>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.1em' }}>July 2026</span>
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
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{book.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: avail > 0 ? '#4CAF50' : '#C8521A' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: avail > 0 ? '#4CAF50' : '#C8521A' }}>{avail > 0 ? 'Available' : 'On Loan'}</span>
                      </div>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#2C1810', lineHeight: 1.25, marginBottom: 3 }}>{book.title}</h3>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', marginBottom: 8 }}>{book.author} · {book.year}</p>
                  </div>
                </div>
                <div style={{ padding: '0 18px 16px' }}>
                  {avail === 0 ? (
                    <button disabled style={{ width: '100%', padding: '8px', background: '#E9DCC3', color: '#9B7B6A', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', border: '1px solid #D4B896', cursor: 'not-allowed' }}>
                      Not available
                    </button>
                  ) : (
                    <button onClick={() => onAddToCart(book.id)} style={{ width: '100%', padding: '8px', background: inCart ? '#2C1810' : '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', border: 'none', cursor: 'pointer' }}>
                      {inCart ? '✓ Added to Cart' : '+ Add to Cart'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Events */}
      <section style={{ padding: '0 64px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 28, borderBottom: '1px solid #D4B896', paddingBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>§ 02</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: '#2C1810' }}>Upcoming Events</h2>
        </div>
        {EVENTS.map((ev, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '18px 14px', borderBottom: '1px solid #D4B896', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#FAF3E4')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#C8521A', minWidth: 56 }}>{ev.date}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#2C1810', marginBottom: 2 }}>{ev.title}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A' }}>{ev.room}</p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#5C3D2E' }}>{ev.time}</span>
          </div>
        ))}
      </section>

      <section style={{ background: '#E1A37F', padding: '44px 64px' }}>
        <blockquote style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: '#2C1810', lineHeight: 1.4 }}>
          <span style={{ color: '#C8521A' }}>&ldquo;</span>{swamiQuote.quote}<span style={{ color: '#C8521A' }}>&rdquo;</span>
        </blockquote>
        <cite style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginTop: 14 }}>— {swamiQuote.attribution}</cite>
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.2em', color: '#C8521A', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
          Sai Inspires · From Prasanthi Nilayam
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4.5vw,44px)', fontWeight: 700, color: '#FAF3E4', lineHeight: 1.1 }}>
          Thought for the Day
        </h1>
        {/* Deliberately not labelled "today": the daily mail is published on
            India time, so from early afternoon the newest thought carries
            tomorrow's date. Showing the date plainly avoids contradicting it. */}
        {thought && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#D4B896', marginTop: 10 }}>
            {formatThoughtDate(thought.date)}
          </p>
        )}
      </section>

      <section style={{ padding: '56px 64px 72px', maxWidth: 900, margin: '0 auto' }}>
        {loading ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Loading…
          </p>
        ) : error ? (
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: '#C8521A', marginBottom: 6 }}>Couldn't load the thought</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#9B7B6A' }}>{error}</p>
          </div>
        ) : !thought ? (
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: '#2C1810', marginBottom: 6 }}>Nothing here yet</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#5C3D2E' }}>
              Today's thought hasn't arrived. It's imported once a day — please check back later.
            </p>
          </div>
        ) : (
          <>
            {/* Teaser above the discourse */}
            {thought.intro && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 600, color: '#C8521A', lineHeight: 1.7, marginBottom: 24 }}>
                {thought.intro}
              </p>
            )}

            {/* The discourse extract. Paragraph breaks are stored as blank
                lines by the importer, so split rather than dumping one block. */}
            {thought.passage.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 18, color: '#2C1810', lineHeight: 1.85, marginBottom: 20, textAlign: 'justify' }}>
                {para}
              </p>
            ))}

            {thought.attribution && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: '#5C3D2E', textAlign: 'right', marginTop: 28 }}>
                {thought.attribution}
              </p>
            )}

            {/* The short highlighted line, closing the page — same order the
                email itself uses, where it sits in a band below the discourse
                rather than above it. Non-italic: a whole paragraph set in
                italics at this size was hard to read, so the quote is set
                off with the display font and rule marks instead of slanting. */}
            {thought.quote && (
              <blockquote style={{ margin: '48px 0 0', background: '#2C1810', padding: '36px 40px' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(19px,2.4vw,26px)', fontWeight: 500, color: '#FAF3E4', lineHeight: 1.6, textAlign: 'center' }}>
                  <span style={{ color: '#C8521A' }}>&ldquo;</span>{thought.quote}<span style={{ color: '#C8521A' }}>&rdquo;</span>
                </p>
              </blockquote>
            )}

            <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid #D4B896' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
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
  // Library/site reviews staff has chosen to publish (book_code is null) —
  // see the Staff Reviews page. Most-recent-first, up to 15; a plain
  // scrollable list rather than an auto-advancing carousel, so a visitor
  // can read at their own pace instead of racing a timer.
  const [libraryReviews, setLibraryReviews] = useState<Review[]>([])
  useEffect(() => {
    let cancelled = false
    fetchLibraryReviews(15).then(data => { if (!cancelled) setLibraryReviews(data) }).catch(() => { if (!cancelled) setLibraryReviews([]) })
    return () => { cancelled = true }
  }, [])

  const sectionHead = (num: string, title: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 36, borderBottom: '1px solid #D4B896', paddingBottom: 12 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{num}</span>
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.2em', color: '#C8521A', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Sai Library · Community</span>
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
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{club.day}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E' }}>{club.time}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', marginTop: 6, letterSpacing: '0.06em' }}>{club.room}</p>
                </div>

                {/* Info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2C1810' }}>{club.title}</h3>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.06em' }}>— Hosted by {club.host}</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Reading: {club.book}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', lineHeight: 1.7, maxWidth: 580 }}>{club.description}</p>
                </div>

                {/* Spots */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: full ? '#C8521A' : almost ? '#D4841A' : '#4CAF50', lineHeight: 1 }}>
                      {full ? 'Full' : club.spotsLeft}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Express your interest</p>
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', background: 'rgba(200,82,26,0.1)', padding: '3px 8px', letterSpacing: '0.08em', flexShrink: 0, marginLeft: 8, whiteSpace: 'nowrap' }}>{role.commitment}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#5C3D2E', lineHeight: 1.65, marginBottom: 12 }}>{role.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {role.skills.map(s => (
                  <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', background: '#F4E9D0', padding: '2px 7px', letterSpacing: '0.05em' }}>{s}</span>
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
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Share a review</p>
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

      {/* ── § 04 What People Are Saying — library/site reviews staff has published ── */}
      {libraryReviews.length > 0 && (
        <section style={{ padding: '0 64px 64px' }}>
          {sectionHead('§ 04', 'What People Are Saying')}
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {libraryReviews.map(review => (
              <div key={review.id} style={{ flex: '0 0 300px', padding: '20px 22px', background: '#FAF3E4', border: '1px solid #D4B896' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', lineHeight: 1.6, marginBottom: 12 }}>{review.reviewText}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9B7B6A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>— {review.reviewerName}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact footer */}
      <div style={{ background: '#2C1810', padding: '36px 64px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
        {/* Real details from siteInfo.ts, replacing the Figma placeholders
            ('418 Elm Street', '(614) 555-0187', 'hello@sailibrary.org').
            No Phone or Email column: the center hasn't given a public number
            or address to publish, and an invented one on a real site is worse
            than none. Add them here once someone supplies them. */}
        {[{ label: 'Center', value: SITE_NAME }, { label: 'Address', value: SITE_ADDRESS }, { label: 'Room', value: MEETING_ROOM }].map(c => (
          <div key={c.label}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{c.label}</span>
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
  // Add/edit-book actions already invalidate the cache themselves (see
  // src/lib/books.ts); this is what actually gets the App-level `books`
  // state to reflect that afterwards.
  async function reloadBooks() {
    setBooks(await fetchBooks())
  }
  const [booksLoading, setBooksLoading] = useState(true)
  const [booksError, setBooksError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [viewingBook, setViewingBook] = useState<Book | null>(null)
  // Cart = map from book_code -> full_label of the copy on hold. The full
  // label is what reserve_copy() / release_reservation() need; the book_code
  // is what the catalog UI uses to look the book up. Storing both means
  // we can release a hold on remove-from-cart without re-querying for the
  // copy, and we can show the patron the actual copy in their cart.
  const [cart, setCart] = useState<Map<string, string>>(new Map())
  const cartIds = [...cart.keys()]

  function setCartIds(next: string[] | ((ids: string[]) => string[])) {
    setCart(previous => {
      const nextIds = typeof next === 'function' ? next([...previous.keys()]) : next
      return new Map(nextIds.map(id => [id, previous.get(id) ?? '']))
    })
  }
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

  useEffect(() => {
    if (!currentPatron) {
      setIsStaff(false)
      return
    }
    let cancelled = false
    fetchIsStaff().then(result => { if (!cancelled) setIsStaff(result) })
    return () => { cancelled = true }
  }, [currentPatron])

  const hasProfile = Boolean(
    currentPatron &&
    currentPatron.firstName &&
    currentPatron.lastName &&
    currentPatron.phone
  )

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

    if (cart.has(id)) return
    const book = books.find(candidate => candidate.id === id)
    const copy = book?.copies.find(candidate => candidate.status === 'available')
    if (!copy) {
      setCheckoutError('No copy is available for this book right now.')
      return
    }

    try {
      await reserveCopy(copy.fullLabel)
      setCart(previous => new Map(previous).set(id, copy.fullLabel))
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'We could not place a hold on this book.')
    }
  }

  async function removeFromCart(id: string) {
    const fullLabel = cart.get(id)
    if (fullLabel) {
      try {
        await releaseReservation(fullLabel)
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'We could not release this hold.')
        return
      }
    }
    setCart(previous => {
      const next = new Map(previous)
      next.delete(id)
      return next
    })
  }

  function toggleCart(id: string) {
    if (!loggedIn) {
      setLoginMode('login')
      setShowLogin(true)
      return
    }

    if (cart.has(id)) {
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
      // LoginModal and ProfilePage both render in normal flow / their own
      // fixed overlay, but the cart drawer is itself a full-screen fixed
      // overlay (zIndex 200) that stays open unless told otherwise — left
      // open here, either one would render trapped behind it, invisible,
      // which looks like clicking "Check Out" simply does nothing.
      setShowCart(false)
      setLoginMode('login')
      setShowLogin(true)
      return
    }

    const storedProfile = getStoredProfile(currentPatron.email)
    const hasProfile = Boolean(currentPatron.firstName && currentPatron.lastName && currentPatron.phone) || Boolean(storedProfile && storedProfile.firstName && storedProfile.lastName && storedProfile.phone)
    if (!hasProfile) {
      setShowCart(false)
      setShowProfileForm(true)
      return
    }

    setCheckoutError(null)
    const succeeded: string[] = []
    const failed: string[] = []

    // Convert each cart reservation into a checkout using the exact reserved
    // copy. This prevents the original hold from being left behind while a
    // different available copy is checked out.
    //
    // Sequential rather than parallel: these contend for copies, so firing
    // them together just makes them race each other.
    for (const [bookId, reservedCopy] of cart.entries()) {
      const title = books.find(book => book.id === bookId)?.title ?? bookId
      try {
        await checkoutBook(reservedCopy)
        succeeded.push(title)
      } catch (err) {
        console.error(`checkout failed for "${title}" (${reservedCopy}):`, err)
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

  // Same gating as submitHoldRequests(): not-signed-in patrons go to
  // LoginModal, signed-in patrons with an incomplete profile go to
  // ProfilePage (join_waitlist requires first/last/phone on file).
  // Returns whether the join actually happened, so BookDetailPage only
  // flips to "on the waitlist" when it's true.
  async function handleJoinWaitlist(bookId: string): Promise<boolean> {
    if (!loggedIn || !currentPatron) {
      setLoginMode('login')
      setShowLogin(true)
      return false
    }

    const storedProfile = getStoredProfile(currentPatron.email)
    const hasCompleteProfile = Boolean(currentPatron.firstName && currentPatron.lastName && currentPatron.phone) || Boolean(storedProfile && storedProfile.firstName && storedProfile.lastName && storedProfile.phone)
    if (!hasCompleteProfile) {
      setShowProfileForm(true)
      return false
    }

    try {
      await joinWaitlist(bookId)
      return true
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'We could not add you to the waitlist.')
      return false
    }
  }

  async function handleLeaveWaitlist(bookId: string): Promise<boolean> {
    try {
      await leaveWaitlist(bookId)
      return true
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'We could not remove you from the waitlist.')
      return false
    }
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
          setLoggedIn(false)
          setUserName('')
          setIsStaff(false)
          setShowUserMenu(false)
          setCartIds([])
          window.setTimeout(() => setAuthLoading(null), 500)
        }}
        onToggleUserMenu={() => setShowUserMenu(v => !v)}
        onCloseUserMenu={() => setShowUserMenu(false)}
        onHolds={() => { setShowUserMenu(false); navigate('/account') }}
        isStaff={Boolean(currentPatron) && isStaff}
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
            loggedIn={loggedIn}
            onJoinWaitlist={handleJoinWaitlist}
            onLeaveWaitlist={handleLeaveWaitlist}
          />
        ) : (
          <Routes>
            <Route path={PAGE_PATHS.home} element={<HomePage books={books} onSearch={handleSearch} onViewBook={handleViewBook} cartIds={cartIds} onAddToCart={toggleCart} />} />
            <Route path={PAGE_PATHS.catalog} element={<CatalogPage books={books} filters={filters} setFilters={setFilters} onViewBook={handleViewBook} cartIds={cartIds} onAddToCart={toggleCart} />} />
            <Route path={PAGE_PATHS.thought} element={<ThoughtPage />} />
            <Route path={PAGE_PATHS.about} element={<AboutPage />} />
            <Route path="/account" element={currentPatron ? <AccountActivityPage /> : <Navigate to={PAGE_PATHS.home} replace />} />
            <Route path={PAGE_PATHS.staff} element={currentPatron && isStaff ? <StaffHomePage /> : <Navigate to={PAGE_PATHS.home} replace />} />
            <Route path={PAGE_PATHS.dashboard} element={currentPatron && isStaff ? <DashboardPage /> : <Navigate to={PAGE_PATHS.home} replace />} />
            <Route path={PAGE_PATHS.staffReturns} element={currentPatron && isStaff ? <StaffReturnsPage /> : <Navigate to={PAGE_PATHS.home} replace />} />
            <Route path={PAGE_PATHS.staffManage} element={currentPatron && isStaff ? <StaffManagePage currentEmail={currentPatron.email} /> : <Navigate to={PAGE_PATHS.home} replace />} />
            <Route path={PAGE_PATHS.staffBooks} element={currentPatron && isStaff ? <ManageBooksPage books={books} onBooksChanged={reloadBooks} /> : <Navigate to={PAGE_PATHS.home} replace />} />
            <Route path={PAGE_PATHS.staffReviews} element={currentPatron && isStaff ? <StaffReviewsPage books={books} /> : <Navigate to={PAGE_PATHS.home} replace />} />
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
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '60px 20px', background: 'rgba(44,24,16,0.7)' }}
          onClick={() => setShowProfileForm(false)}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: 640, background: '#FAF3E4', border: '1px solid #D4B896', padding: '32px 28px', boxShadow: '0 24px 64px rgba(44,24,16,0.35)' }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowProfileForm(false)}
              aria-label="Close"
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#9B7B6A', cursor: 'pointer', fontSize: 20 }}
            >
              ✕
            </button>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', marginBottom: 16 }}>
              We just need your name before you can check out. You can close this and keep browsing — your cart hold is still there.
            </p>
            <ProfilePage
              compact
              patron={currentPatron}
              onSaved={updatedPatron => {
                setCurrentPatron(updatedPatron)
                setUserName(updatedPatron.name)
                setShowProfileForm(false)
                setShowUserMenu(false)
              }}
              onDeleted={() => { setCurrentPatron(null); setLoggedIn(false); setUserName(''); setShowProfileForm(false); navigate(PAGE_PATHS.home, { replace: true }) }}
            />
          </div>
        </div>
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
