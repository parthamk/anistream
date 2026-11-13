
import { useCallback, useEffect, useState } from 'react';
import { getContinueWatching } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function useContinueWatching(limit = 12) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(user));

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await getContinueWatching(limit);

    if (error) {
      showToast(error.message, 'error');
      setItems([]);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }, [limit, showToast, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
