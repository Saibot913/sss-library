// Help page content. The questions are placeholders for now: answers are
// stubbed until the library team writes them. Edit this file only; HelpPage
// in App.tsx renders whatever is here.
// Step-by-step "how borrowing works" shown at the top of the Help page.
export const CHECKOUT_GUIDE: { title: string; detail: string }[] = [
  { title: 'Add books to your cart', detail: 'Browse the catalog, open a book and tap "Add to Cart". You need to be signed in.' },
  { title: 'Check Out to reserve', detail: 'Open your cart and tap "Check Out". The book is now reserved for you for 5 days and nobody else can take it. A pop-up shows its category and copy ID so you can find it.' },
  { title: 'Collect it from the center', detail: 'Go to the center during opening hours and pick up your book using the category and copy ID.' },
  { title: 'Tap Check Out on My Books', detail: 'Once you have the book, open My Books and tap "Check Out" next to it. It moves to "Currently checked out". If you don\'t do this within 5 days, the book goes back to the catalog.' },
  { title: 'Return it', detail: 'When you are done, tap "Return" on My Books and leave the book on the return shelf at the center. Staff will put it back on its shelf.' },
]

export const FAQS: { question: string; answer: string }[] = [
  { question: 'How do I check out a book?', answer: 'Add it to your cart and tap Check Out to reserve it, collect it from the center, then tap Check Out on My Books. See the guide above.' },
  { question: 'How long can I keep a book?', answer: 'Answer coming soon. A reserved book is held for 5 days for you to collect.' },
  { question: 'Where do I collect my book from?', answer: 'Answer coming soon.' },
  { question: 'How do I return a book?', answer: 'Tap Return on My Books and leave the book on the return shelf at the center. Staff then put it back on its shelf.' },
  { question: 'What if every copy of a book is checked out?', answer: 'Open the book and tap Join Waitlist. A volunteer will contact you when a copy is back on the shelf.' },
  { question: 'I did not get my sign-in code. What should I do?', answer: 'Answer coming soon.' },
  { question: 'How do I update or delete my account?', answer: 'Answer coming soon.' },
]

// Google Form for reporting a problem or asking for help. Leave empty until
// the form exists; the page then shows "coming soon" instead of a dead link.
export const ISSUE_FORM_URL = ''
