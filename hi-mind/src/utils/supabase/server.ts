import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key: string) => {
          const cookiesStore = cookies()
          return cookiesStore.get(key)?.value || null
        },
        setItem: (key: string, value: string) => {
          const cookiesStore = cookies()
          cookiesStore.set(key, value)
        },
        removeItem: (key: string) => {
          const cookiesStore = cookies()
          cookiesStore.delete(key)
        }
      }
    }
  })
}