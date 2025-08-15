/**
 * Simple Organization Management
 * Provides clean organization context throughout the application
 */

import { getSupabaseClient } from "@/lib/database";
import { createServiceClient } from "@/utils/supabase/service";

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
  // Use service client to avoid cookies dependency during startup
  let supabase;
  let clientType;
  try {
    supabase = createServiceClient();
    clientType = "service";
  } catch (error) {
    // Fallback to regular client if service role key not available
    supabase = getSupabaseClient(true);
    clientType = "regular";
    console.log("⚠️ [ORG] Service client failed, using regular client:", error);
  }
  
  console.log(`🔍 [ORG] Looking for organization using ${clientType} client...`);
  
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .limit(1)
    .single();
    
  if (error) {
    console.error(`❌ [ORG] Database error:`, error);
  } else if (org) {
    console.log(`✅ [ORG] Found organization:`, { id: org.id, name: org.name, slug: org.slug });
  } else {
    console.log(`⚠️ [ORG] No organization found in database`);
  }
    
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