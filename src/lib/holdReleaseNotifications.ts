import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

// Staff force-releasing a patron's cart hold (Returns & Holds page) has no
// other way to reach that patron's own browser -- their cart is pure
// client-side state with no server-sync mechanism. This subscribes to a
// private, per-patron Realtime broadcast channel (see migration
// 0026_realtime_hold_release_notification.sql) and calls onReleased so the
// caller can drop the book from local cart state immediately, instead of
// the patron only finding out when checkout fails.
//
// onReleased is read via a ref rather than a dependency, so passing a new
// inline function each render doesn't tear down and recreate the
// subscription -- only a real patronId change does that.
export function useHoldReleaseSubscription(patronId: string | null, onReleased: (fullLabel: string) => void): void {
  const onReleasedRef = useRef(onReleased)
  onReleasedRef.current = onReleased

  useEffect(() => {
    if (!patronId) return

    let channel: RealtimeChannel | null = null
    let cancelled = false

    supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = supabase
        .channel(`user:${patronId}`, { config: { private: true } })
        .on('broadcast', { event: 'hold_released' }, ({ payload }) => {
          const fullLabel = (payload as { fullLabel?: unknown } | undefined)?.fullLabel
          if (typeof fullLabel === 'string') onReleasedRef.current(fullLabel)
        })
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [patronId])
}
