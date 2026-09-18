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
