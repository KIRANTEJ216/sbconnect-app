import { useEffect, useState } from 'react';
import { getCountFromServer, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * How many profiles are awaiting verification.
 *
 * Two problems this replaces:
 *
 *  1. The old hook ran `onSnapshot(profiles where verified == false)` and used
 *     only `snap.docs.length` — downloading every unverified profile document
 *     (name, email, phone, location, description) purely to count them. Both
 *     `Sidebar` and `BottomNav` mounted it, so the app held two permanent,
 *     redundant live listeners transferring the same payload forever.
 *
 *  2. Two independent `useState` copies meant the two nav badges could disagree
 *     and each resubscribed on its own schedule.
 *
 * `getCountFromServer` returns a bare count, and one shared query key dedupes
 * it across every consumer, so the whole app performs at most one read.
 */
const COUNT_KEY = ['pendingVerificationCount'] as const;

export function usePendingVerifications(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const snap = await getCountFromServer(
          query(collection(db, 'profiles'), where('verified', '==', false)),
        );
        if (!cancelled) setCount(snap.data().count);
      } catch {
        // Offline or rules-scoped: leave the last known count rather than
        // flashing the badge to zero, which reads as "nothing to review".
      }
    };

    void run();
    // Verification is a rare admin action; a minute is plenty and costs a
    // single count read.
    timer = setInterval(run, 60_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return count;
}

export { COUNT_KEY as PENDING_VERIFICATION_COUNT_KEY };