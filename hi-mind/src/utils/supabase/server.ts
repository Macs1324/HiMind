import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'


export function createServerClient() {

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {

        getItem: async (key: string) => {
          const cookiesStore = await cookies();
          return cookiesStore.get(key)?.value || null;
        },
        setItem: async (key: string, value: string) => {
          const cookiesStore = await cookies();
          cookiesStore.set(key, value);
        },
        removeItem: async (key: string) => {
          const cookiesStore = await cookies();
          cookiesStore.delete(key);

        }
      }
    }
  })
}