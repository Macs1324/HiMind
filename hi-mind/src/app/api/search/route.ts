import { NextRequest, NextResponse } from "next/server";
import { KnowledgeEngine } from "@/core/knowledge-engine";

export async function POST(request: NextRequest) {
  try {
    const { query, organizationId = 'demo-org' } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    const knowledgeEngine = new KnowledgeEngine();
    const results = await knowledgeEngine.searchKnowledge(query, organizationId);

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
  const organizationId = searchParams.get('org') || 'demo-org';

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    const knowledgeEngine = new KnowledgeEngine();
    const results = await knowledgeEngine.searchKnowledge(query, organizationId);

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