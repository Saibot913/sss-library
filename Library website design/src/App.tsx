import { useState, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Page = 'home' | 'catalog' | 'about'

type CheckoutRecord = {
  patron: string
  patronId: string
  checkedOut: string
  dueDate: string
  renewed: boolean
}

type Book = {
  id: number
  title: string
  author: string
  year: number
  genre: string
  category: string
  keywords: string[]
  dewey: string
  img: string
  isbn: string
  summary: string
  pages: number
  publisher: string
  available: boolean
  copiesTotal: number
  checkedOut: CheckoutRecord[]
}

type Filters = {
  query: string
  category: string
  genre: string
  yearFrom: string
  yearTo: string
  availability: 'all' | 'available' | 'checkedout'
  keywords: string
}

const EMPTY_FILTERS: Filters = {
  query: '',
  category: 'All Categories',
  genre: 'All Genres',
  yearFrom: '',
  yearTo: '',
  availability: 'all',
  keywords: '',
}

// ── Data ──────────────────────────────────────────────────────────────────────

const BOOKS: Book[] = [
  {
    id: 1,
    title: 'Sathyam Shivam Sundaram',
    author: 'Prof. N. Kasturi',
    year: 1961,
    genre: 'Spiritual Biography',
    category: 'Non-Fiction',
    keywords: ['sai baba', 'biography', 'spirituality', 'divine', 'truth', 'devotion'],
    dewey: '294.5',
    img: 'photo-1589829085413-56de8ae18c73',
    isbn: '978-81-7208-001-0',
    summary: 'The authorised biography of Bhagawan Sri Sathya Sai Baba, written by His close devotee and scholar Prof. N. Kasturi. Spanning four volumes, it chronicles the life, miracles, teachings, and divine mission of Sathya Sai Baba from His birth to His work of spiritual transformation across the world.',
    pages: 320,
    publisher: 'Sri Sathya Sai Books & Publications Trust',
    available: true,
    copiesTotal: 2,
    checkedOut: [],
  },
  {
    id: 2,
    title: 'Loving God',
    author: 'Prof. N. Kasturi',
    year: 1982,
    genre: 'Spiritual',
    category: 'Non-Fiction',
    keywords: ['devotion', 'sai baba', 'love', 'god', 'faith', 'surrender'],
    dewey: '294.5',
    img: 'photo-1481627834876-b7833e8f5570',
    isbn: '978-81-7208-015-7',
    summary: "A devotional classic by Prof. Kasturi exploring the profound relationship between the devotee and the Divine. Drawing on Sai Baba's teachings, discourses, and personal interactions, the book illuminates the path of love, selfless service, and surrender as the highest spiritual practice.",
    pages: 248,
    publisher: 'Sri Sathya Sai Books & Publications Trust',
    available: true,
    copiesTotal: 1,
    checkedOut: [],
  },
  {
    id: 3,
    title: 'Geeta Vahini',
    author: 'Bhagawan Sri Sathya Sai Baba',
    year: 1963,
    genre: 'Spiritual Scripture',
    category: 'Non-Fiction',
    keywords: ['bhagavad gita', 'dharma', 'krishna', 'yoga', 'vedanta', 'spirituality'],
    dewey: '294.5',
    img: 'photo-1544716278-ca5e3f4abd8c',
    isbn: '978-81-7208-008-9',
    summary: "Sathya Sai Baba's commentary and exposition on the Bhagavad Gita, rendered in clear and accessible language. Geeta Vahini illuminates the eternal wisdom of Krishna's discourse to Arjuna, making the Gita's teachings on duty, devotion, knowledge, and liberation relevant for the modern seeker.",
    pages: 276,
    publisher: 'Sri Sathya Sai Books & Publications Trust',
    available: false,
    copiesTotal: 2,
    checkedOut: [
      { patron: 'Janani Krishnan', patronId: 'P-00287', checkedOut: '2026-07-05', dueDate: '2026-07-26', renewed: true },
      { patron: 'Lassi Mäkinen', patronId: 'P-00412', checkedOut: '2026-07-10', dueDate: '2026-07-31', renewed: false },
    ],
  },
  {
    id: 4,
    title: 'Invisible Cities',
    author: 'Italo Calvino',
    year: 1972,
    genre: 'Postmodern Fiction',
    category: 'Fiction',
    keywords: ['travel', 'imagination', 'memory', 'architecture', 'marco polo', 'kublai khan'],
    dewey: '853.914',
    img: 'photo-1507003211169-0a1dd7228f2d',
    isbn: '978-0-15-645380-4',
    summary: 'Marco Polo describes 55 fantastical cities to Kublai Khan, each one a meditation on desire, memory, death, and utopia. A lyrical prose poem in novel form, one of the most formally inventive works of the twentieth century.',
    pages: 165,
    publisher: 'Harcourt Brace Jovanovich',
    available: true,
    copiesTotal: 1,
    checkedOut: [],
  },
  {
    id: 5,
    title: 'Anna Karenina',
    author: 'Leo Tolstoy',
    year: 1877,
    genre: 'Classic Fiction',
    category: 'Fiction',
    keywords: ['love', 'adultery', 'society', 'russia', 'tragedy', 'marriage'],
    dewey: '891.73',
    img: 'photo-1541963463532-d68292c34b19',
    isbn: '978-0-14-044913-4',
    summary: "Tolstoy's epic of Russian aristocratic society follows Anna Karenina's passionate affair with Count Vronsky, set against Levin's contrasting domestic happiness. A profound study of love, guilt, and the social machinery that grinds individuals down.",
    pages: 864,
    publisher: 'Penguin Classics',
    available: false,
    copiesTotal: 2,
    checkedOut: [
      { patron: 'Janani Krishnan', patronId: 'P-00287', checkedOut: '2026-06-28', dueDate: '2026-07-19', renewed: true },
      { patron: 'Marcus Webb', patronId: 'P-00109', checkedOut: '2026-07-08', dueDate: '2026-07-29', renewed: false },
    ],
  },
  {
    id: 6,
    title: 'Beloved',
    author: 'Toni Morrison',
    year: 1987,
    genre: 'Literary Fiction',
    category: 'Fiction',
    keywords: ['slavery', 'trauma', 'memory', 'haunting', 'motherhood', 'america'],
    dewey: '813.54',
    img: 'photo-1495640388908-05fa85288e61',
    isbn: '978-1-4000-3341-6',
    summary: "Set after the American Civil War, Morrison's Pulitzer Prize-winning novel follows Sethe, a formerly enslaved woman haunted by the ghost of the infant daughter she killed to spare her from slavery. A devastating meditation on trauma, memory, and the legacy of bondage.",
    pages: 321,
    publisher: 'Knopf',
    available: true,
    copiesTotal: 2,
    checkedOut: [
      { patron: 'Lassi Mäkinen', patronId: 'P-00412', checkedOut: '2026-07-12', dueDate: '2026-08-02', renewed: false },
    ],
  },
  {
    id: 7,
    title: 'The Magic Mountain',
    author: 'Thomas Mann',
    year: 1924,
    genre: 'Philosophical Fiction',
    category: 'Fiction',
    keywords: ['tuberculosis', 'time', 'europe', 'philosophy', 'sanatorium'],
    dewey: '833.912',
    img: 'photo-1519682337058-a94d519337bc',
    isbn: '978-0-679-72600-0',
    summary: "Hans Castorp visits his cousin at a Swiss tuberculosis sanatorium and stays for seven years, drawn into the hothouse intellectual atmosphere of pre-war Europe. Mann's vast novel is an allegory of European culture on the brink of catastrophe.",
    pages: 716,
    publisher: 'Vintage',
    available: true,
    copiesTotal: 1,
    checkedOut: [],
  },
  {
    id: 8,
    title: 'In Search of Lost Time',
    author: 'Marcel Proust',
    year: 1913,
    genre: 'Modernist Fiction',
    category: 'Fiction',
    keywords: ['memory', 'time', 'aristocracy', 'france', 'art', 'jealousy'],
    dewey: '843.912',
    img: 'photo-1476275466078-4007374efbbe',
    isbn: '978-0-300-18776-6',
    summary: "The longest novel in the world follows the narrator's reflections on a life lived in Parisian high society, exploring memory, art, jealousy, and the passage of time through Proust's extraordinary sentences.",
    pages: 4215,
    publisher: 'Yale University Press',
    available: false,
    copiesTotal: 1,
    checkedOut: [
      { patron: 'Priya Nair', patronId: 'P-00334', checkedOut: '2026-07-03', dueDate: '2026-07-24', renewed: false },
    ],
  },
  {
    id: 9,
    title: 'The Brothers Karamazov',
    author: 'Fyodor Dostoevsky',
    year: 1880,
    genre: 'Classic Fiction',
    category: 'Fiction',
    keywords: ['faith', 'doubt', 'murder', 'russia', 'morality', 'family', 'parricide'],
    dewey: '891.733',
    img: 'photo-1568667256549-094cd0ff57a7',
    isbn: '978-0-374-52837-9',
    summary: "Dostoevsky's final novel pits rationalism against religious faith through three brothers and their dissolute father, building toward parricide and a dramatic courtroom trial. Widely regarded as the greatest novel ever written.",
    pages: 796,
    publisher: 'Farrar, Straus and Giroux',
    available: true,
    copiesTotal: 2,
    checkedOut: [
      { patron: 'Janani Krishnan', patronId: 'P-00287', checkedOut: '2026-07-14', dueDate: '2026-08-04', renewed: false },
    ],
  },
  {
    id: 10,
    title: 'Their Eyes Were Watching God',
    author: 'Zora Neale Hurston',
    year: 1937,
    genre: 'Literary Fiction',
    category: 'Fiction',
    keywords: ['identity', 'race', 'love', 'south', 'self-discovery', 'folklore'],
    dewey: '813.52',
    img: 'photo-1604866830893-c13cafa515d5',
    isbn: '978-0-06-093141-3',
    summary: "Janie Crawford's journey through three marriages becomes an exploration of Black life, identity, and selfhood in the American South. Hurston's lyrical prose and authentic vernacular dialogue make this a landmark of the Harlem Renaissance.",
    pages: 193,
    publisher: 'Harper Perennial',
    available: true,
    copiesTotal: 2,
    checkedOut: [],
  },
  {
    id: 11,
    title: 'Sapiens: A Brief History of Humankind',
    author: 'Yuval Noah Harari',
    year: 2011,
    genre: 'History',
    category: 'Non-Fiction',
    keywords: ['evolution', 'civilization', 'agriculture', 'capitalism', 'empire', 'science'],
    dewey: '909',
    img: 'photo-1589829085413-56de8ae18c73',
    isbn: '978-0-06-231610-0',
    summary: "Harari surveys the whole of human history from the emergence of Homo sapiens to the present, arguing that what distinguishes us is our ability to cooperate through shared fictions — money, nations, religion, corporations.",
    pages: 464,
    publisher: 'Harper',
    available: false,
    copiesTotal: 3,
    checkedOut: [
      { patron: 'Lassi Mäkinen', patronId: 'P-00412', checkedOut: '2026-07-07', dueDate: '2026-07-28', renewed: true },
      { patron: 'Tom Eriksen', patronId: 'P-00521', checkedOut: '2026-07-09', dueDate: '2026-07-30', renewed: false },
      { patron: 'Janani Krishnan', patronId: 'P-00287', checkedOut: '2026-07-13', dueDate: '2026-08-03', renewed: false },
    ],
  },
  {
    id: 12,
    title: 'The Periodic Table',
    author: 'Primo Levi',
    year: 1975,
    genre: 'Memoir',
    category: 'Non-Fiction',
    keywords: ['chemistry', 'holocaust', 'memory', 'science', 'italy', 'resistance'],
    dewey: '853.914',
    img: 'photo-1532012197267-da84d127e765',
    isbn: '978-0-8052-1041-0',
    summary: "Each chapter takes its name from a chemical element to frame a vignette of Levi's life as a chemist and Holocaust survivor. A unique hybrid of memoir, science writing, and fable.",
    pages: 233,
    publisher: 'Schocken',
    available: true,
    copiesTotal: 1,
    checkedOut: [],
  },
  {
    id: 13,
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    year: 2011,
    genre: 'Psychology',
    category: 'Non-Fiction',
    keywords: ['cognition', 'bias', 'decision making', 'economics', 'heuristics', 'behavioral'],
    dewey: '153.4',
    img: 'photo-1507003211169-0a1dd7228f2d',
    isbn: '978-0-374-27563-1',
    summary: 'Nobel laureate Kahneman distills decades of research in cognitive psychology and behavioral economics into a compelling portrait of the two systems that drive how we think: fast, intuitive System 1, and slow, deliberate System 2.',
    pages: 499,
    publisher: 'Farrar, Straus and Giroux',
    available: true,
    copiesTotal: 2,
    checkedOut: [
      { patron: 'Priya Nair', patronId: 'P-00334', checkedOut: '2026-07-11', dueDate: '2026-08-01', renewed: false },
    ],
  },
  {
    id: 14,
    title: 'Cosmos',
    author: 'Carl Sagan',
    year: 1980,
    genre: 'Science',
    category: 'Non-Fiction',
    keywords: ['astronomy', 'universe', 'evolution', 'science', 'philosophy', 'stars'],
    dewey: '520',
    img: 'photo-1419242902214-272b3f66ee7a',
    isbn: '978-0-345-53943-4',
    summary: "Sagan's companion to his landmark television series takes readers on a journey across the cosmos, from the Big Bang to the emergence of intelligence on Earth and our search for other civilisations.",
    pages: 365,
    publisher: 'Random House',
    available: false,
    copiesTotal: 1,
    checkedOut: [
      { patron: 'Marcus Webb', patronId: 'P-00109', checkedOut: '2026-07-06', dueDate: '2026-07-27', renewed: false },
    ],
  },
]

const CATEGORIES = ['All Categories', 'Fiction', 'Non-Fiction']
const GENRES = ['All Genres', 'Spiritual Biography', 'Spiritual', 'Spiritual Scripture', 'Historical Fiction', 'Victorian Fiction', 'Magical Realism', 'Postmodern Fiction', 'Classic Fiction', 'Literary Fiction', 'Philosophical Fiction', 'Modernist Fiction', 'History', 'Memoir', 'Psychology', 'Science']

const EVENTS = [
  { date: 'Jul 22', title: 'Summer Reading Circle', time: '6:00 PM', room: 'Reading Room B' },
  { date: 'Jul 25', title: "Children's Story Hour", time: '10:30 AM', room: "Children's Wing" },
  { date: 'Aug 03', title: 'Local Author Talk: Mira Salden', time: '7:00 PM', room: 'Main Hall' },
  { date: 'Aug 10', title: 'Genealogy Research Workshop', time: '2:00 PM', room: 'Archive Room' },
]

const STAFF = [
  { name: 'Dr. Eleanor Voss', role: 'Head Librarian', since: '2008', img: 'photo-1573497019940-1c28c88b4f3e' },
  { name: 'Marcus Trent', role: 'Reference Archivist', since: '2014', img: 'photo-1500648767791-00dcc994a43e' },
  { name: 'Saoirse Callahan', role: "Children's Librarian", since: '2019', img: 'photo-1580489944761-15a19d654956' },
  { name: 'Dev Anand Pillai', role: 'Digital Collections', since: '2021', img: 'photo-1507003211169-0a1dd7228f2d' },
]

// ── Top nav ───────────────────────────────────────────────────────────────────

function TopNav({
  active,
  onNav,
  cartCount,
  onCart,
  onLogin,
  loggedIn,
  userName,
}: {
  active: Page
  onNav: (p: Page) => void
  cartCount: number
  onCart: () => void
  onLogin: () => void
  loggedIn: boolean
  userName: string
}) {
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
        {([['home', '01', 'Home'], ['catalog', '02', 'Catalog'], ['about', '03', 'Community']] as const).map(([id, num, label]) => (
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
        {/* Login */}
        <button
          onClick={onLogin}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: loggedIn ? '#FAF3E4' : '#D4B896', background: loggedIn ? 'rgba(200,82,26,0.25)' : 'rgba(255,255,255,0.06)', border: `1px solid ${loggedIn ? 'rgba(200,82,26,0.5)' : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#C8521A')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = loggedIn ? 'rgba(200,82,26,0.5)' : 'rgba(255,255,255,0.15)')}
        >
          <span style={{ fontSize: 14 }}>{loggedIn ? '👤' : '⊙'}</span>
          <span>{loggedIn ? userName : 'Log In'}</span>
        </button>

        {/* Cart */}
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

// ── Login modal ───────────────────────────────────────────────────────────────

function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (name: string) => void }) {
  const [name, setName] = useState('')
  const [cardId, setCardId] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !cardId.trim()) { setError('Please enter your name and library card number.'); return }
    onLogin(name.trim())
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(44,24,16,0.7)' }} onClick={onClose}>
      <div style={{ background: '#FAF3E4', padding: '40px 44px', maxWidth: 400, width: '90%', boxShadow: '0 24px 64px rgba(44,24,16,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Member Access</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#2C1810' }}>Log In</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B7B6A', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Full Name</label>
            <input
              type="text"
              placeholder="e.g. Lassi Mäkinen"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#C8521A')}
              onBlur={e => (e.target.style.borderColor = '#D4B896')}
            />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Library Card Number</label>
            <input
              type="text"
              placeholder="e.g. P-00412"
              value={cardId}
              onChange={e => setCardId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#C8521A')}
              onBlur={e => (e.target.style.borderColor = '#D4B896')}
            />
          </div>
          {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C8521A' }}>{error}</p>}
          <button type="submit" style={{ marginTop: 8, padding: '12px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
            Log In to Your Account
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Cart overlay ──────────────────────────────────────────────────────────────

function CartOverlay({
  cartIds,
  onClose,
  onRemove,
  onViewBook,
}: {
  cartIds: number[]
  onClose: () => void
  onRemove: (id: number) => void
  onViewBook: (book: Book) => void
}) {
  const cartBooks = cartIds.map(id => BOOKS.find(b => b.id === id)).filter(Boolean) as Book[]

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
                const avail = book.copiesTotal - book.checkedOut.length
                return (
                  <div key={book.id} style={{ display: 'flex', gap: 14, padding: '16px 28px', borderBottom: '1px solid #D4B896' }}>
                    <div style={{ width: 48, height: 62, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                      <img src={`https://images.unsplash.com/${book.img}?w=48&h=62&fit=crop&auto=format`} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E' }}>{cartBooks.length} book{cartBooks.length !== 1 ? 's' : ''} requested</span>
              </div>
              <button style={{ width: '100%', padding: '13px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                Submit Hold Requests
              </button>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#9B7B6A', textAlign: 'center', marginTop: 10 }}>We will notify you when your books are ready for pickup.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Book Detail Page (full screen) ────────────────────────────────────────────

function BookDetailPage({
  book,
  onBack,
  cartIds,
  onAddToCart,
  onRemoveFromCart,
  onViewBook,
}: {
  book: Book
  onBack: () => void
  cartIds: number[]
  onAddToCart: (id: number) => void
  onRemoveFromCart: (id: number) => void
  onViewBook: (book: Book) => void
}) {
  const avail = book.copiesTotal - book.checkedOut.length
  const inCart = cartIds.includes(book.id)

  const similar = useMemo(() => {
    return BOOKS
      .filter(b => b.id !== book.id)
      .map(b => ({
        book: b,
        score:
          (b.genre === book.genre ? 3 : 0) +
          (b.category === book.category ? 1 : 0) +
          b.keywords.filter(k => book.keywords.includes(k)).length * 2,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ book }) => book)
  }, [book])

  return (
    <div style={{ minHeight: '100vh', background: '#F4E9D0' }}>
      {/* Hero banner */}
      <div style={{ position: 'relative', height: 340, overflow: 'hidden' }}>
        <img
          src={`https://images.unsplash.com/${book.img}?w=1400&h=340&fit=crop&auto=format`}
          alt={book.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
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
            {book.genre} · Dewey {book.dewey}
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
                { label: 'ISBN', val: book.isbn },
                { label: 'Publisher', val: book.publisher },
                { label: 'Year', val: book.year.toString() },
                { label: 'Pages', val: book.pages.toLocaleString() },
                { label: 'Category', val: book.category },
                { label: 'Genre', val: book.genre },
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
                  const sAvail = s.copiesTotal - s.checkedOut.length
                  return (
                    <div
                      key={s.id}
                      onClick={() => onViewBook(s)}
                      style={{ display: 'flex', gap: 12, padding: '14px 16px', background: '#FAF3E4', border: '1px solid #D4B896', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F0C9A8'; e.currentTarget.style.borderColor = '#C8521A' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FAF3E4'; e.currentTarget.style.borderColor = '#D4B896' }}
                    >
                      <div style={{ width: 40, height: 52, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                        <img src={`https://images.unsplash.com/${s.img}?w=40&h=52&fit=crop&auto=format`} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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

              {/* Copy dots */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {Array.from({ length: book.copiesTotal }).map((_, i) => (
                  <div key={i} style={{ flex: 1, padding: '8px 0', textAlign: 'center', border: `1.5px solid ${i < book.checkedOut.length ? '#C8521A' : '#4CAF50'}`, background: i < book.checkedOut.length ? 'rgba(200,82,26,0.06)' : 'rgba(76,175,80,0.06)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: i < book.checkedOut.length ? '#C8521A' : '#4CAF50' }}>#{i + 1}</span>
                  </div>
                ))}
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

            {/* Current loans */}
            {book.checkedOut.length > 0 && (
              <div style={{ background: '#FAF3E4', border: '1px solid #D4B896', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14 }}>Current Loans</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {book.checkedOut.map((loan, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: '#F4E9D0', border: '1px solid #D4B896' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: '#2C1810', marginBottom: 1 }}>{loan.patron}</p>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', letterSpacing: '0.08em' }}>{loan.patronId}</span>
                        </div>
                        {loan.renewed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#5C3D2E', background: '#F0C9A8', padding: '2px 6px' }}>Renewed</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', display: 'block' }}>Checked out</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#5C3D2E' }}>{loan.checkedOut}</span>
                        </div>
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A', display: 'block' }}>Due</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#C8521A', fontWeight: 600 }}>{loan.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dewey */}
            <div style={{ padding: '14px 16px', background: '#2C1810', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dewey</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#C8521A' }}>{book.dewey}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', marginLeft: 'auto' }}>{book.isbn}</span>
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
  filters,
  setFilters,
  onViewBook,
  cartIds,
  onAddToCart,
}: {
  filters: Filters
  setFilters: (f: Filters) => void
  onViewBook: (book: Book) => void
  cartIds: number[]
  onAddToCart: (id: number) => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const hasSearched = Object.entries(filters).some(([k, v]) => {
    if (k === 'category') return v !== 'All Categories'
    if (k === 'genre') return v !== 'All Genres'
    if (k === 'availability') return v !== 'all'
    return v !== ''
  })

  function setF<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters({ ...filters, [key]: val })
  }

  const results = useMemo(() => {
    return BOOKS.filter(b => {
      const q = filters.query.toLowerCase().trim()
      const kw = filters.keywords.toLowerCase().trim()
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false
      if (kw && !b.keywords.some(k => k.includes(kw)) && !b.title.toLowerCase().includes(kw) && !b.summary.toLowerCase().includes(kw)) return false
      if (filters.category !== 'All Categories' && b.category !== filters.category) return false
      if (filters.genre !== 'All Genres' && b.genre !== filters.genre) return false
      if (filters.yearFrom && b.year < parseInt(filters.yearFrom)) return false
      if (filters.yearTo && b.year > parseInt(filters.yearTo)) return false
      const avail = b.copiesTotal - b.checkedOut.length
      if (filters.availability === 'available' && avail === 0) return false
      if (filters.availability === 'checkedout' && avail === b.copiesTotal) return false
      return true
    })
  }, [filters])

  const unavailableResults = results.filter(b => b.copiesTotal - b.checkedOut.length === 0)

  const recommendations = useMemo(() => {
    if (!hasSearched || unavailableResults.length === 0) return []
    const resultIds = new Set(results.map(b => b.id))
    const seedKeywords = new Set(unavailableResults.flatMap(b => b.keywords))
    const seedGenres = new Set(unavailableResults.map(b => b.genre))
    const seedCategories = new Set(unavailableResults.map(b => b.category))
    const seedWords = new Set(unavailableResults.flatMap(b => b.summary.toLowerCase().split(/\W+/).filter(w => w.length > 4)))

    return BOOKS
      .filter(b => !resultIds.has(b.id) && b.copiesTotal - b.checkedOut.length > 0)
      .map(b => {
        let score = 0
        b.keywords.forEach(k => { if (seedKeywords.has(k)) score += 3 })
        if (seedGenres.has(b.genre)) score += 2
        if (seedCategories.has(b.category)) score += 1
        b.summary.toLowerCase().split(/\W+/).filter(w => w.length > 4).forEach(w => { if (seedWords.has(w)) score += 0.5 })
        return { book: b, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ book }) => book)
  }, [results, hasSearched])

  const activeFilterCount = [
    filters.query,
    filters.keywords,
    filters.category !== 'All Categories' ? filters.category : '',
    filters.genre !== 'All Genres' ? filters.genre : '',
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
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9B7B6A' }}>{hasSearched ? `${results.length} result${results.length !== 1 ? 's' : ''}` : `${BOOKS.length} total items`}</p>
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
            { label: 'Category', key: 'category' as const, opts: CATEGORIES },
            { label: 'Genre', key: 'genre' as const, opts: GENRES },
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

        {/* Patron summary */}
        <div style={{ margin: '0 20px 20px', padding: 14, background: '#F4E9D0', border: '1px solid #D4B896' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Active Patrons</span>
          {[
            { name: 'Lassi Mäkinen', id: 'P-00412', count: BOOKS.filter(b => b.checkedOut.some(c => c.patron === 'Lassi Mäkinen')).length },
            { name: 'Janani Krishnan', id: 'P-00287', count: BOOKS.filter(b => b.checkedOut.some(c => c.patron === 'Janani Krishnan')).length },
          ].map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#2C1810', fontWeight: 600 }}>{p.name}</p>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9B7B6A' }}>{p.id}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#C8521A', fontWeight: 600 }}>{p.count} out</span>
            </div>
          ))}
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
                { label: 'Category', key: 'category' as const, opts: CATEGORIES, type: 'select' },
                { label: 'Genre', key: 'genre' as const, opts: GENRES, type: 'select' },
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
              {filters.genre !== 'All Genres' && <FilterTag label={filters.genre} onRemove={() => setF('genre', 'All Genres')} />}
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
                const avail = book.copiesTotal - book.checkedOut.length
                const inCart = cartIds.includes(book.id)
                return (
                  <div key={book.id} style={{ background: '#FAF3E4', padding: 18, display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div
                      onClick={() => onViewBook(book)}
                      style={{ cursor: 'pointer', flex: 1 }}
                    >
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 44, height: 56, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                          <img src={`https://images.unsplash.com/${book.img}?w=44&h=56&fit=crop&auto=format`} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#9B7B6A' }}>{book.genre}</span>
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
                  const avail = book.copiesTotal - book.checkedOut.length
                  const inCart = cartIds.includes(book.id)
                  const sharedKw = book.keywords.filter(k => unavailableResults.some(u => u.keywords.includes(k)))
                  return (
                    <div key={book.id} style={{ background: '#F4E9D0', border: '1px solid #D4B896', padding: 14 }}>
                      <div onClick={() => onViewBook(book)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 36, height: 48, overflow: 'hidden', flexShrink: 0, background: '#D4B896' }}>
                            <img src={`https://images.unsplash.com/${book.img}?w=36&h=48&fit=crop&auto=format`} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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

function HomePage({ onNav, onSearch, onViewBook, cartIds, onAddToCart }: {
  onNav: (p: Page) => void
  onSearch: (q: string) => void
  onViewBook: (book: Book) => void
  cartIds: number[]
  onAddToCart: (id: number) => void
}) {
  const [heroQuery, setHeroQuery] = useState('')

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

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {['Fiction', 'Non-Fiction', 'Spiritual', 'History'].map(cat => (
              <button key={cat} onClick={() => onNav('catalog')} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', background: 'rgba(250,243,228,0.1)', color: '#D4B896', border: '1px solid rgba(250,243,228,0.2)', cursor: 'pointer' }}>{cat}</button>
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
          {BOOKS.slice(0, 3).map(book => {
            const avail = book.copiesTotal - book.checkedOut.length
            const inCart = cartIds.includes(book.id)
            return (
              <div key={book.id} style={{ background: '#FAF3E4', border: '1px solid #D4B896' }}>
                <div onClick={() => onViewBook(book)} style={{ cursor: 'pointer' }}>
                  <div style={{ overflow: 'hidden', height: 160 }}>
                    <img src={`https://images.unsplash.com/${book.img}?w=400&h=160&fit=crop&auto=format`} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
                  </div>
                  <div style={{ padding: '16px 18px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{book.genre}</span>
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

const BOOK_CLUBS = [
  {
    date: 'Aug 5, 2026',
    day: 'Wednesday',
    time: '6:30 PM',
    title: 'Spiritual Classics Circle',
    description: 'This month we explore Geeta Vahini — Sai Baba\'s exposition on the Bhagavad Gita. We\'ll discuss the nature of duty, devotion, and the path of selfless action as described in the text. All are welcome, no prior reading of the Gita required.',
    book: 'Geeta Vahini',
    host: 'Dr. Eleanor Voss',
    room: 'Reading Room A',
    spots: 12,
    spotsLeft: 4,
  },
  {
    date: 'Aug 14, 2026',
    day: 'Thursday',
    time: '7:00 PM',
    title: 'World Fiction Evening',
    description: 'Join us for a lively discussion of Invisible Cities by Italo Calvino. We\'ll unpack Calvino\'s 55 fantastical cities as metaphors for memory, desire, and the human imagination. Bring your favourite passage to share.',
    book: 'Invisible Cities',
    host: 'Marcus Trent',
    room: 'Reading Room B',
    spots: 16,
    spotsLeft: 9,
  },
  {
    date: 'Aug 21, 2026',
    day: 'Thursday',
    time: '5:30 PM',
    title: 'Biography & Lives',
    description: 'We turn to Sathyam Shivam Sundaram, the authorised biography of Sathya Sai Baba by Prof. Kasturi. Members are encouraged to read Volume I ahead of time. Discussion will focus on the early life chapters and Kasturi\'s method of devotional biography.',
    book: 'Sathyam Shivam Sundaram',
    host: 'Saoirse Callahan',
    room: 'Main Hall',
    spots: 20,
    spotsLeft: 11,
  },
  {
    date: 'Sep 3, 2026',
    day: 'Wednesday',
    time: '6:00 PM',
    title: 'Science & Ideas',
    description: 'This session features Sapiens by Yuval Noah Harari. We\'ll debate Harari\'s central claim that shared fictions — money, nations, religions — are the engine of human civilisation. Come ready to agree or push back.',
    book: 'Sapiens',
    host: 'Dev Anand Pillai',
    room: 'Reading Room A',
    spots: 14,
    spotsLeft: 14,
  },
  {
    date: 'Sep 18, 2026',
    day: 'Friday',
    time: '7:00 PM',
    title: 'Classics & Masterworks',
    description: 'We read The Brothers Karamazov together — one chapter block per session. This meeting covers Books IV–VI: the Elder Zosima, the Grand Inquisitor, and the crisis of faith. New members joining this arc are very welcome.',
    book: 'The Brothers Karamazov',
    host: 'Marcus Trent',
    room: 'Reading Room B',
    spots: 10,
    spotsLeft: 3,
  },
]

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

function AboutPage() {
  const [volunteerForm, setVolunteerForm] = useState({ name: '', email: '', role: '', message: '' })
  const [donationForm, setDonationForm] = useState({ name: '', title: '', author: '', condition: 'Good' })
  const [volunteerSent, setVolunteerSent] = useState(false)
  const [donationSent, setDonationSent] = useState(false)

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
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#D4B896', marginTop: 8 }}>Book clubs · Donations · Volunteering</p>
        </div>
      </section>

      {/* ── § 01 Book Clubs ── */}
      <section style={{ padding: '56px 64px 48px' }}>
        {sectionHead('§ 01', 'Upcoming Book Clubs')}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
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

      {/* ── § 02 Book Donations ── */}
      <section style={{ background: '#FAF3E4', padding: '56px 64px 48px', borderTop: '1px solid #D4B896' }}>
        {sectionHead('§ 02', 'Book Donations')}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56 }}>
          {/* Left — appeal */}
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: '#2C1810', lineHeight: 1.45, marginBottom: 20 }}>
              "Every book donated is a door opened for someone who might not yet know what's waiting behind it."
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.75, marginBottom: 16 }}>
              Sai Library gratefully accepts donations of books in good condition. Whether it's a novel you've treasured, a reference work you've finished with, or a collection being passed on — your contribution directly enriches our community's reading life.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.75, marginBottom: 24 }}>
              Donated books are added to our circulating collection, offered through our annual book sale, or shared with partner schools and literacy programmes.
            </p>
            <div style={{ padding: '20px 24px', background: '#F4E9D0', borderLeft: '3px solid #C8521A' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>We accept</p>
              {['Fiction and non-fiction in any genre', 'Books published within the last 20 years (older accepted case by case)', 'Clean pages — no heavy underlining or water damage', 'Children\'s and young adult titles always needed', 'Spiritual, devotional, and philosophical works'].map(item => (
                <div key={item} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: '#C8521A', fontSize: 12, flexShrink: 0, marginTop: 1 }}>—</span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', lineHeight: 1.5 }}>{item}</p>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', marginTop: 16 }}>
              Drop off at the main desk during opening hours, or contact us to arrange a larger collection pickup.
            </p>
          </div>

          {/* Right — notify form */}
          <div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Let us know you're coming</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', lineHeight: 1.6 }}>Fill in what you're bringing and we'll have the right team member ready to receive your donation.</p>
            </div>

            {donationSent ? (
              <div style={{ padding: '28px', background: 'rgba(76,175,80,0.08)', border: '1px solid #4CAF50', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2C7A2C', marginBottom: 6 }}>Thank you!</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E' }}>We've received your donation notice. See you soon at the library.</p>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); setDonationSent(true) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Your Name', key: 'name' as const, placeholder: 'Full name' },
                  { label: 'Book Title(s)', key: 'title' as const, placeholder: 'e.g. Loving God, Anna Karenina…' },
                  { label: 'Author(s)', key: 'author' as const, placeholder: 'e.g. Prof. Kasturi, Tolstoy…' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{f.label}</label>
                    <input type="text" placeholder={f.placeholder} value={donationForm[f.key]} onChange={e => setDonationForm(d => ({ ...d, [f.key]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
                  </div>
                ))}
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Book Condition</label>
                  <select value={donationForm.condition} onChange={e => setDonationForm(d => ({ ...d, condition: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {['Like New', 'Good', 'Fair', 'Worn but readable'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <button type="submit" style={{ marginTop: 6, padding: '12px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                  Submit Donation Notice
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── § 03 Volunteers ── */}
      <section style={{ padding: '56px 64px 64px' }}>
        {sectionHead('§ 03', 'Volunteer With Us')}

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

          {/* Volunteer sign-up form */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Express your interest</p>
            {volunteerSent ? (
              <div style={{ padding: '28px', background: 'rgba(76,175,80,0.08)', border: '1px solid #4CAF50', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2C7A2C', marginBottom: 6 }}>Thank you for volunteering!</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E' }}>A member of our team will be in touch within a few days.</p>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); setVolunteerSent(true) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Your Name', key: 'name' as const, placeholder: 'Full name' },
                  { label: 'Email Address', key: 'email' as const, placeholder: 'your@email.com' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{f.label}</label>
                    <input type="text" placeholder={f.placeholder} value={volunteerForm[f.key]} onChange={e => setVolunteerForm(v => ({ ...v, [f.key]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#FAF3E4', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
                  </div>
                ))}
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Role of Interest</label>
                  <select value={volunteerForm.role} onChange={e => setVolunteerForm(v => ({ ...v, role: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#FAF3E4', border: '1px solid #D4B896', outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                    <option value="">Select a role…</option>
                    {VOLUNTEER_ROLES.map(r => <option key={r.title}>{r.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Anything else you'd like to share?</label>
                  <textarea value={volunteerForm.message} onChange={e => setVolunteerForm(v => ({ ...v, message: e.target.value }))} placeholder="Skills, availability, questions…" rows={3} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#FAF3E4', border: '1px solid #D4B896', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
                </div>
                <button type="submit" style={{ padding: '12px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                  Submit Volunteer Application
                </button>
              </form>
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

      {/* Contact footer */}
      <div style={{ background: '#2C1810', padding: '36px 64px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
        {[{ label: 'Address', value: '418 Elm Street\nSai Library Campus' }, { label: 'Phone', value: '(614) 555-0187' }, { label: 'Email', value: 'hello@sailibrary.org' }].map(c => (
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
  const [page, setPage] = useState<Page>('home')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [viewingBook, setViewingBook] = useState<Book | null>(null)
  const [prevPage, setPrevPage] = useState<Page>('home')
  const [cartIds, setCartIds] = useState<number[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')

  function handleNav(p: Page) {
    setViewingBook(null)
    setPage(p)
  }

  function handleSearch(q: string) {
    setFilters({ ...EMPTY_FILTERS, query: q })
    setViewingBook(null)
    setPage('catalog')
  }

  function handleViewBook(book: Book) {
    setPrevPage(page)
    setViewingBook(book)
    window.scrollTo(0, 0)
  }

  function handleBack() {
    setViewingBook(null)
    setPage(prevPage)
  }

  function addToCart(id: number) {
    setCartIds(ids => ids.includes(id) ? ids : [...ids, id])
  }

  function removeFromCart(id: number) {
    setCartIds(ids => ids.filter(i => i !== id))
  }

  function toggleCart(id: number) {
    setCartIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4E9D0' }}>
      <TopNav
        active={page}
        onNav={handleNav}
        cartCount={cartIds.length}
        onCart={() => setShowCart(true)}
        onLogin={() => setShowLogin(true)}
        loggedIn={loggedIn}
        userName={userName}
      />

      <main style={{ paddingTop: 60 }}>
        {viewingBook ? (
          <BookDetailPage
            book={viewingBook}
            onBack={handleBack}
            cartIds={cartIds}
            onAddToCart={addToCart}
            onRemoveFromCart={removeFromCart}
            onViewBook={handleViewBook}
          />
        ) : page === 'home' ? (
          <HomePage onNav={handleNav} onSearch={handleSearch} onViewBook={handleViewBook} cartIds={cartIds} onAddToCart={toggleCart} />
        ) : page === 'catalog' ? (
          <CatalogPage filters={filters} setFilters={setFilters} onViewBook={handleViewBook} cartIds={cartIds} onAddToCart={toggleCart} />
        ) : (
          <AboutPage />
        )}
      </main>

      {showCart && (
        <CartOverlay
          cartIds={cartIds}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onViewBook={book => { setShowCart(false); handleViewBook(book) }}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={name => { setLoggedIn(true); setUserName(name) }}
        />
      )}
    </div>
  )
}
