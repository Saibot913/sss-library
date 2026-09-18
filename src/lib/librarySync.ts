import { useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

// The catalog, book detail page, and staff Returns & Holds page each fetch
// once on mount and otherwise never refresh -- a checkout/return/hold done
// from another browser or account is invisible until the viewer reloads
// (planning_docs/todo.md flagged this for the cart-hold-release case; this
// generalizes the fix to every surface that reads copies/checkouts/waitlist).
//
// Subscribes to Postgres changes on the given public tables and calls
// onChange, debounced, whenever any of them change -- debounced because one
// action (e.g. a return) touches both `copies` and `checkouts` in the same
// moment, and callers should just re-run their existing fetch rather than
// try to reconcile the change payload themselves.
//
// See migration 0031_realtime_sync.sql for the publication/RLS side of
// this: copies is already publicly readable, but checkouts and waitlist
// needed a staff-only SELECT policy added for Realtime to deliver events
// to a subscribing staff client (Realtime enforces the same RLS a normal
// query would).
// `copies` is deliberately NOT one of the tables this can watch: its
// reserved_by/reserved_until columns are column-privilege-revoked from
// anon/authenticated (migration 0001, "don't leak who has a copy on
// hold"), and a plain postgres_changes subscription ships every column to
// every subscriber regardless of that revoke -- migration 0031 did this by
// mistake and 0032 had to walk it back. Use
// useCopiesAvailabilitySubscription below instead, which only ever
// receives the safe columns (book_code, full_label, status) via a public
// broadcast the 0032 trigger sends.
export function useLibrarySyncSubscription(tables: readonly string[], onChange: () => void): void {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const tablesKey = tables.join(',')

  useEffect(() => {
    if (!tablesKey) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleChange() {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => onChangeRef.current(), 400)
    }

    let channel = supabase.channel(`library-sync:${tablesKey}`)
    for (const table of tablesKey.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleChange,
      )
    }
    channel.subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [tablesKey])
}

// Public broadcast of copy availability changes (see
// 0032_fix_copies_realtime_leak.sql) -- book_code/full_label/status only,
// never reserved_by/reserved_until. Safe for any visitor, signed in or not.
export function useCopiesAvailabilitySubscription(onChange: () => void): void {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleChange() {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => onChangeRef.current(), 400)
    }

    const channel = supabase
      .channel('copies-availability')
      .on('broadcast', { event: 'changed' }, scheduleChange)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [])
}
