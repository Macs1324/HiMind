import { NextRequest, NextResponse } from "next/server";
import {
	startGitHubIntegration,
	triggerGitHubBackfill,
} from "@/integrations/github/integration";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
	try {
		console.log("🔄 [API] GitHub backfill requested via UI");

		if (!process.env.GITHUB_TOKEN) {
			return NextResponse.json(
				{ error: "GITHUB_TOKEN not configured" },
				{ status: 400 },
			);
		}

		if (!process.env.GITHUB_REPOSITORY) {
			return NextResponse.json(
				{
					error: 'GITHUB_REPOSITORY not configured. Set it to "owner/repo" format.',
				},
				{ status: 400 },
			);
		}

		// Start GitHub integration (which auto-triggers backfill)
		const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
		triggerGitHubBackfill(owner, repo).catch((error) =>
			console.error("❌ [API] GitHub integration failed:", error),
		);

		return NextResponse.json({
			success: true,
			message: `GitHub backfill started for ${process.env.GITHUB_REPOSITORY}`,
			repository: process.env.GITHUB_REPOSITORY,
		});
	} catch (error) {
		console.error("❌ [API] Failed to start GitHub backfill:", error);
		return NextResponse.json(
			{
				error: "Failed to start GitHub backfill",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
