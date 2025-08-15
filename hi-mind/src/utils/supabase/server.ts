import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Check if we're in a request context where cookies are available
  let hasCookieContext = true;
  try {
    // This will throw if we're not in a request context
    cookies();
  } catch {
    hasCookieContext = false;
  }

  if (!hasCookieContext) {
    // Return a basic client without auth for background contexts
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  // Full client with cookie-based auth for request contexts
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: async (key: string) => {
          try {
            const cookiesStore = await cookies();
            return cookiesStore.get(key)?.value || null;
          } catch {
            return null;
          }
        },
        setItem: async (key: string, value: string) => {
          try {
            const cookiesStore = await cookies();
            cookiesStore.set(key, value);
          } catch {
            // Ignore in non-request contexts
          }
        },
        removeItem: async (key: string) => {
          try {
            const cookiesStore = await cookies();
            cookiesStore.delete(key);
          } catch {
            // Ignore in non-request contexts
          }
        }
      }
    }
  })
}