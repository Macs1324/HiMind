/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeEngine } from "@/core/knowledge-engine-singleton";
import { getCurrentOrganization } from "@/lib/organization";

interface ExpertMatch {
  personId: string;
  name: string;
  email?: string;
  expertiseScore: number;
  totalContributions: number;
  relevantContributions: number;
  topContributions: Array<{
    summary: string;
    platform: string;
    sourceUrl?: string;
    similarity: number;
  }>;
}

interface KnowledgeAnswer {
  summary: string;
  authorName: string;
  platform: string;
  sourceUrl?: string;
  relevanceScore: number;
}

interface ExpertSearchResult {
  query: string;
  primaryExperts: ExpertMatch[];
  potentialAnswers: KnowledgeAnswer[];
  hasDirectAnswers: boolean;
}

async function findExpertsByQuery(
  query: string,
  organizationId: string,
): Promise<ExpertMatch[]> {
  // Use the knowledge engine to search for relevant knowledge points
  const searchResults = await getKnowledgeEngine().searchKnowledge(
    query,
    organizationId,
  );
  const knowledgeMatches = searchResults.knowledgeMatches || [];

  // Group by author and calculate expertise scores
  const expertMap = new Map<string, ExpertMatch>();

  for (const match of knowledgeMatches) {
    if (!(match as any).author_name) continue;

    const authorKey = (match as any).author_name;

    if (!expertMap.has(authorKey)) {
      expertMap.set(authorKey, {
        personId: authorKey, // Using author name as ID for simplicity
        name: (match as any).author_name,
        email: undefined,
        expertiseScore: 0,
        totalContributions: 0,
        relevantContributions: 0,
        topContributions: [],
      });
    }

    const expert = expertMap.get(authorKey)!;
    expert.relevantContributions++;
    expert.totalContributions++; // This is an approximation

    // Add to top contributions (keep best 3)
    const contribution = {
      summary: match.summary,
      platform: match.platform,
      sourceUrl: (match as any).source_url,
      similarity: (match as any).similarity_score,
    };

    expert.topContributions.push(contribution);
    expert.topContributions.sort((a, b) => b.similarity - a.similarity);
    expert.topContributions = expert.topContributions.slice(0, 3);
  }

  // Calculate expertise scores and return sorted experts
  const experts = Array.from(expertMap.values()).map((expert) => ({
    ...expert,
    expertiseScore:
      (expert.relevantContributions / Math.max(expert.totalContributions, 1)) *
      (expert.topContributions[0]?.similarity || 0),
  }));

  return experts
    .filter((expert) => expert.relevantContributions >= 2) // Must have at least 2 relevant contributions
    .sort((a, b) => b.expertiseScore - a.expertiseScore)
    .slice(0, 5); // Top 5 experts
}

async function findPotentialAnswers(
  query: string,
  organizationId: string,
): Promise<KnowledgeAnswer[]> {
  // Use the knowledge engine to search for highly relevant knowledge points
  const searchResults = await getKnowledgeEngine().searchKnowledge(
    query,
    organizationId,
  );
  const knowledgeMatches = searchResults.knowledgeMatches || [];

  // Filter for high-similarity matches that might contain direct answers
  const potentialAnswers = knowledgeMatches
    .filter((match: any) => match.similarity_score > 0.75) // High similarity threshold
    .slice(0, 5) // Top 5 potential answers
    .map((match: any) => ({
      summary: match.summary,
      authorName: match.author_name || "Unknown",
      platform: match.platform,
      sourceUrl: match.source_url,
      relevanceScore: match.similarity_score,
    }));

  return potentialAnswers;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 },
      );
    }

    // Get current organization
    const org = await getCurrentOrganization();
    if (!org) {
      return NextResponse.json(
        { error: "No organization found. Please create one first." },
        { status: 400 },
      );
    }

    console.log(`🔍 [KNOWLEDGE SEARCH] Query: "${query}"`);

    const potentialAnswers = await findPotentialAnswers(query, org.id);
    console.log("Got potential answers!!!!!!!!!!!!!!!!!!");
    const experts = await findExpertsByQuery(query, org.id);
    console.log("Got experts!!!!!!!!!!!!!!!!!!");

    const result: ExpertSearchResult = {
      query,
      primaryExperts: experts,
      potentialAnswers,
      hasDirectAnswers:
        potentialAnswers.length > 0 && potentialAnswers[0].relevanceScore > 0.8,
    };

    console.log(
      `👥 [KNOWLEDGE SEARCH] Found ${experts.length} experts, ${potentialAnswers.length} potential answers`,
    );

    return NextResponse.json({
      success: true,
      results: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Knowledge search error:", error);
    return NextResponse.json(
      {
        error: "Knowledge search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
