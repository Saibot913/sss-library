// Help page content. Edit this file only; HelpPage in App.tsx renders
// whatever is here.
// Step-by-step "how borrowing works" shown at the top of the Help page.
export const CHECKOUT_GUIDE: { title: string; detail: string }[] = [
  { title: 'Add books to your cart', detail: 'Browse the catalog, open a book and tap "Add to Cart". You need to be signed in.' },
  { title: 'Check Out to reserve', detail: 'Open your cart and tap "Check Out". The book is now reserved for you for 5 days and nobody else can take it. A pop-up shows its category and copy ID so you can find it.' },
  { title: 'Collect it from the center', detail: 'Go to the center during opening hours and pick up your book using the category and copy ID.' },
  { title: 'Tap Check Out on My Books', detail: 'Once you have the book, open My Books and tap "Check Out" next to it. It moves to "Currently checked out". If you don\'t do this within 5 days, the book goes back to the catalog.' },
  { title: 'Return it', detail: 'When you are done, tap "Return" on My Books and leave the book on the return shelf at the center. Staff will put it back on its shelf.' },
]

export const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do I check out a book?',
    answer: 'Sign in, add the book to your cart from the catalog, and tap Check Out. That reserves a copy for you for 5 days, and nobody else can take it. Collect it from the center, then tap Check Out next to it on My Books to borrow it. See "How borrowing works" above. No confirmation email is sent, so note down the copy ID shown after you reserve.',
  },
  {
    question: 'How long can I keep a book?',
    answer: 'There is no due date or fine — this is an honor-system library. Please return books when you\'re done so others can borrow them. A reserved book that you don\'t check out within 5 days goes back to the catalog.',
  },
  {
    question: 'Where do I collect my book from?',
    answer: 'Pick up (and return) books in person at the Sri Sathya Sai Baba Center of Sacramento (Sai Seva Sadan, 10415 Old Placerville Road, Suite #225, Sacramento, CA 95827), during the library\'s open hours shown on the home page (daily Aarthi times, Thursday Bhajans 7:30 – 9:00 PM, Sunday Sai Center 1:00 – 6:00 PM). After you reserve, the confirmation screen shows each book\'s category and copy ID — use those to find it on the shelf.',
  },
  {
    question: 'How do I return a book?',
    answer: 'Tap Return next to the book on My Books, then leave it on the return shelf at the center. Staff will put it back on its shelf and mark it available again.',
  },
  {
    question: 'What if every copy of a book is checked out?',
    answer: 'Join the waitlist from the book\'s page (this requires your name and phone number to be on your profile). There\'s no automatic email when a copy frees up — library staff will see you on the waitlist and reach out directly.',
  },
  {
    question: 'I did not get my sign-in code. What should I do?',
    answer: 'First check your spam folder. If it still hasn\'t arrived, close the code screen and use "Use a different email" to go back, then re-enter your email to request a new code.',
  },
  {
    question: 'How do I update or delete my account?',
    answer: 'Go to your Profile page to update your name, email, or phone number. From the same page you can also permanently delete your account; this removes your sign-in and your checkout history and cannot be undone.',
  },
]

// Google Form for reporting a problem or asking for help. Leave empty until
// the form exists; the page then shows "coming soon" instead of a dead link.
export const ISSUE_FORM_URL = ''
