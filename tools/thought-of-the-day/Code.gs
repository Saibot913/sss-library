/**
 * Sai Inspires -> Supabase importer.
 *
 * Runs on a daily trigger in Google Apps Script, reads the newest Sai
 * Inspires email out of the mailbox this script belongs to, extracts the
 * text, and upserts one row into `thought_of_the_day`.
 *
 * This file is the source of truth. It is deployed by pasting into
 * script.google.com - see README.md in this folder. If you edit the copy
 * living in Apps Script, paste it back here too, or the next person will
 * change the wrong one.
 *
 * Nothing here creates the table; the migration does that
 * (supabase/migrations/0003_thought_of_the_day.sql).
 *
 * Deliberately ASCII-only: this file gets copy-pasted through a browser,
 * and that is a good way to mangle non-ASCII characters.
 */

/** The list address the daily email is delivered to. Check this against a
 *  real message's To: header before assuming it has not changed. */
var GROUP_ADDRESS = 'sai-inspires@sssmediacentre.org'
var TABLE = 'thought_of_the_day'

/** Entry point - this is the function the daily trigger calls. */
function importTodaysThought() {
  var props = PropertiesService.getScriptProperties()
  var supabaseUrl = props.getProperty('SUPABASE_URL')
  var serviceKey = props.getProperty('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Script Properties')
  }

  // 2 days rather than 1, so one skipped run heals itself the next day.
  var threads = GmailApp.search('to:' + GROUP_ADDRESS + ' newer_than:2d', 0, 5)
  if (threads.length === 0) {
    throw new Error('No email to ' + GROUP_ADDRESS + ' in the last 2 days')
  }

  var messages = []
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) { messages.push(message) })
  })
  messages.sort(function (a, b) { return b.getDate() - a.getDate() })

  var thought = parseSaiInspiresEmail(messages[0].getBody())
  upsertThought(supabaseUrl, serviceKey, thought)
  Logger.log('Stored ' + thought.date + ': ' + thought.passage.slice(0, 70) + '...')
}

/**
 * Pull the day's content out of the email HTML.
 *
 * Throws rather than returning partial data. A failed trigger emails the
 * account owner, and that is the only alerting this job has - quietly
 * upserting an empty string would look like success forever.
 */
function parseSaiInspiresEmail(html) {
  var date = extractDate(html)
  if (!date) throw new Error('No date link found in the email - the template probably changed')

  // The prose paragraphs are the only ones carrying dir="ltr".
  var paragraphs = []
  var paragraphRe = /<p\b[^>]*\bdir="ltr"[^>]*>([\s\S]*?)<\/p>/gi
  var match
  while ((match = paragraphRe.exec(html)) !== null) {
    var text = htmlToText(match[1])
    if (text) paragraphs.push({ raw: match[0], text: text })
  }
  if (paragraphs.length === 0) {
    throw new Error('Found the email for ' + date + ' but no dir="ltr" paragraphs')
  }

  // The opening teaser is bold and blue (#0070c0); the discourse follows it.
  // If that colour is missing, treat everything as discourse rather than
  // silently dropping the first paragraph.
  var intro = null
  var body = paragraphs
  if (paragraphs.length > 1 && paragraphs[0].raw.indexOf('#0070c0') !== -1) {
    intro = paragraphs[0].text
    body = paragraphs.slice(1)
  }

  var passage = body.map(function (p) { return p.text }).join('\n\n')
  if (!passage) throw new Error('Extracted an empty passage for ' + date)

  return {
    date: date,
    // Short bold teaser line above the discourse.
    intro: intro,
    // The long discourse extract.
    passage: passage,
    // e.g. "- Divine Discourse Jul 06, 1975"
    attribution: matchText(html, /<p[^>]*align="right"[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>/i),
    // The short highlighted line in the dark blue band, ending "- BABA".
    // This is the only piece short enough for a homepage.
    quote: matchText(html, /bgcolor="#074171"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i),
  }
}

/**
 * The email's own date, never the date it arrived.
 *
 * These are published on India time, so a message reaching Sacramento at
 * 1:30pm carries the *following* day's date. Deriving it from the received
 * timestamp would label every row a day early.
 */
function extractDate(html) {
  var iso = html.match(/sai-inspires\.web\.app\/\?date=(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  // Fallback link, which is not zero-padded: ?date=2026-08-6
  var loose = html.match(/sssmediacentre\.org\/sai-inspires\/\?date=(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (loose) return loose[1] + '-' + pad(loose[2]) + '-' + pad(loose[3])
  return null
}

function pad(value) {
  return value.length === 1 ? '0' + value : value
}

function matchText(html, pattern) {
  var match = html.match(pattern)
  return match ? htmlToText(match[1]) : null
}

function htmlToText(html) {
  var stripped = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(stripped)
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, function (_, code) { return String.fromCharCode(Number(code)) })
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, code) { return String.fromCharCode(parseInt(code, 16)) })
    .replace(/&amp;/gi, '&') // must be last, or earlier entities double-decode
}

/**
 * Upsert, keyed on the `date` primary key. Re-running for a day that is
 * already stored corrects that row instead of adding a duplicate, which is
 * what makes this safe to re-run by hand.
 *
 * SUPABASE_SERVICE_ROLE_KEY must hold the *legacy* service_role JWT (starts
 * with 'eyJ'), not a new-style sb_secret_ key. Supabase rejects secret keys
 * when the User-Agent looks like a browser, Apps Script's User-Agent starts
 * with 'Mozilla/5.0', and Apps Script strips any User-Agent you try to set -
 * so a secret key can never work from here. It fails with
 * "Forbidden use of secret API key in browser". See README.md step 3,
 * including what to do before legacy keys are retired at the end of 2026.
 */
function upsertThought(supabaseUrl, serviceKey, thought) {
  var response = UrlFetchApp.fetch(supabaseUrl + '/rest/v1/' + TABLE, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      Prefer: 'resolution=merge-duplicates',
    },
    payload: JSON.stringify(thought),
    // Without this, a non-2xx throws a generic exception and hides the
    // response body - which is where Supabase says what it objected to.
    muteHttpExceptions: true,
  })

  var code = response.getResponseCode()
  if (code >= 300) {
    throw new Error('Supabase rejected the write (HTTP ' + code + '): ' + response.getContentText())
  }
}
