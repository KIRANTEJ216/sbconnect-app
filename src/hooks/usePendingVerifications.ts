import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function usePendingVerifications() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'profiles'), where('verified', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.docs.length);
    });
    return unsub;
  }, []);

  return count;
}
