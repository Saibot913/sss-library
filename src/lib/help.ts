// Help page content. Edit this file only; HelpPage in App.tsx renders
// whatever is here.
export const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do I check out a book?',
    answer: 'Sign in, add the book to your cart from the catalog, and check out from there. Each book you check out holds a specific copy for you for 5 minutes while you complete checkout — if that hold expires, just add it again. No confirmation email is sent, so note down the copy ID shown after checkout.',
  },
  {
    question: 'How long can I keep a book?',
    answer: 'There is no due date or fine — this is an honor-system library. Please return books when you\'re done so others can borrow them.',
  },
  {
    question: 'Where do I collect my book from?',
    answer: 'Pick up (and return) books in person at the Sri Sathya Sai Baba Center of Sacramento (Sai Seva Sadan, 10415 Old Placerville Road, Suite #225, Sacramento, CA 95827), during the library\'s open hours shown on the home page (daily Aarthi times, Thursday Bhajans 7:30 – 9:00 PM, Sunday Sai Center 1:00 – 6:00 PM). After checkout, the confirmation screen shows each book\'s category and copy ID — use those to find it on the shelf.',
  },
  {
    question: 'How do I return a book?',
    answer: 'Bring the book back to the center during the library\'s open hours shown on the home page and hand it to a staff member, who will check it in. There is no self-checkin.',
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
