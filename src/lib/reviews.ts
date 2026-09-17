import { supabase } from './supabaseClient'

// The external Reviews & Feedback Google Form is still the intake for raw
// submissions — nothing here changes that. What's new (0019_book_reviews.sql)
// is a staff-curated `reviews` table: staff reads the spreadsheet and, for
// any submission worth publishing, types it in via the staff Reviews page.
// No Sheets API, no "pending" queue — every row here is already published.
export const REVIEW_FORM_URL = 'https://forms.gle/YyXfu6YDue2NjkCD7'

// Where staff read raw submissions before curating them onto the site —
// linked from the staff Reviews page. Note the sheet has two separate
// "Review"-labeled columns (one per Category branch in the form), since
// Sheets doesn't allow two columns with the exact same header.
export const REVIEW_RESPONSES_SHEET_URL = 'https://docs.google.com/spreadsheets/d/13CYKrOjQtpyk6_M3oNA7tVc36vOqBSEmw9Vrc8c6t98/edit?usp=sharing'

export type Review = {
  id: string
  /** null = a general library/site review, not tied to any specific book. */
  bookCode: string | null
  reviewerName: string
  reviewText: string
  createdAt: string
}

type ReviewRow = {
  id: string
  book_code: string | null
  reviewer_name: string
  review_text: string
  created_at: string
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    bookCode: row.book_code,
    reviewerName: row.reviewer_name,
    reviewText: row.review_text,
    createdAt: row.created_at,
  }
}

const SELECT = 'id,book_code,reviewer_name,review_text,created_at'

export async function fetchReviewsForBook(bookCode: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(SELECT)
    .eq('book_code', bookCode)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ReviewRow[]).map(toReview)
}

/** General library/site reviews (book_code is null), most recent first. */
export async function fetchLibraryReviews(limit = 15): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(SELECT)
    .is('book_code', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as ReviewRow[]).map(toReview)
}

/** Every review, both kinds — for the staff curation page's list. */
export async function fetchAllReviewsForStaff(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ReviewRow[]).map(toReview)
}

export async function addReview(input: { bookCode: string | null; reviewerName: string; reviewText: string }): Promise<void> {
  const { error } = await supabase.rpc('add_review', {
    p_book_code: input.bookCode,
    p_reviewer_name: input.reviewerName,
    p_review_text: input.reviewText,
  })
  if (error) throw error
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_review', { p_review_id: id })
  if (error) throw error
}
