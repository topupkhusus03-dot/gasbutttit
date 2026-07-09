'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function DebugProfile() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setData(profile);
      } else {
        setData({ error: "Not logged in" });
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: 20, color: 'black', background: 'white' }}>
      <h1>Debug Profile</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
