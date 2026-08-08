// Static contact info — doesn't need "wiring" to anything, it's just a
// fact. Intended to be dropped into the home page under the day/time
// section (see TODO in src/lib/bookClub.ts for the day/time itself).
export const SITE_NAME = 'Sri Sathya Sai Baba Center of Sacramento'
export const SITE_ADDRESS = 'Sai Seva Sadan, 10415 Old Placerville Road, Suite #225 Sacramento, CA 95827'
export const MEETING_ROOM = 'Shradda Room'

// Real weekly schedule — replaces the fake Mon–Thu/Fri–Sat/Sunday
// "Hours" strip on the home page (App.tsx ~line 869-878), which is
// Figma placeholder data with made-up library hours, not this center's
// actual timings.
export const WEEKLY_TIMINGS = [
  { day: 'Thursday', activity: 'Bhajans', time: '7:00 – 9:30 PM' },
  { day: 'Sunday', activity: 'Sai Center', time: '2:00 – 5:00 PM' },
]

// TODO(team): hero/banner images from https://www.saisevasadan.org.
// Hotlinking image URLs straight from that domain is fragile — they can
// rename/move files with no notice, and it puts load on their server for
// every visitor here. Better to download the images you want and commit
// them as local assets (or put them in Supabase Storage) rather than
// referencing saisevasadan.org URLs directly at render time.
