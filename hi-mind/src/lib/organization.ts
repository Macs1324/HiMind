/**
 * Simple Organization Management
 * Provides clean organization context throughout the application
 */

import { getSupabaseClient } from "@/lib/database";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

/**
 * Get the current organization for the session
 * For MVP: Just use the first available organization
 * Future: Could be based on user auth, subdomain, etc.
 */
export async function getCurrentOrganization(): Promise<Organization | null> {
  const supabase = getSupabaseClient(true);
  
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .limit(1)
    .single();
    
  return org;
}

/**
 * Create a new organization
 */
export async function createOrganization(name: string, slug: string): Promise<Organization> {
  const supabase = getSupabaseClient(true);
  
  const { data: org, error } = await supabase
    .from('organizations')
    .insert({ name, slug })
    .select()
    .single();
    
  if (error) throw error;
  return org;
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const supabase = getSupabaseClient(true);
  
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single();
    
  return org;
}