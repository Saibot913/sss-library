// Static contact info — doesn't need "wiring" to anything, it's just a
// fact. Intended to be dropped into the home page under the day/time
// section (see TODO in src/lib/bookClub.ts for the day/time itself).
export const SITE_NAME = 'Sri Sathya Sai Baba Center of Sacramento'
export const SITE_ADDRESS = 'Sai Seva Sadan, 10415 Old Placerville Road, Suite #225 Sacramento, CA 95827'

// TODO(team): hero/banner images from https://www.saisevasadan.org.
// Hotlinking image URLs straight from that domain is fragile — they can
// rename/move files with no notice, and it puts load on their server for
// every visitor here. Better to download the images you want and commit
// them as local assets (or put them in Supabase Storage) rather than
// referencing saisevasadan.org URLs directly at render time.
