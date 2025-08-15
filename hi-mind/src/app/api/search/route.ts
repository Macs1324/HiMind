import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeEngine } from "@/core/knowledge-engine-singleton";
import { getCurrentOrganization } from "@/lib/organization";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Get current organization
    const org = await getCurrentOrganization();
    if (!org) {
      return NextResponse.json(
        { error: 'No organization found. Please create one first.' },
        { status: 400 }
      );
    }

    const results = await getKnowledgeEngine().searchKnowledge(query, org.id);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { 
        error: 'Search failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    // Get current organization
    const org = await getCurrentOrganization();
    if (!org) {
      return NextResponse.json(
        { error: 'No organization found. Please create one first.' },
        { status: 400 }
      );
    }

    const results = await getKnowledgeEngine().searchKnowledge(query, org.id);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { 
        error: 'Search failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}