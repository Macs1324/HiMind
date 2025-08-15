/**
 * Knowledge Engine Singleton
 * Ensures only one instance of KnowledgeEngine exists across the application
 */

import { KnowledgeEngine } from "./knowledge-engine";

let knowledgeEngineInstance: KnowledgeEngine | null = null;

/**
 * Get the shared Knowledge Engine instance
 * Creates it if it doesn't exist, returns existing instance otherwise
 */
export function getKnowledgeEngine(): KnowledgeEngine {
  if (!knowledgeEngineInstance) {
    console.log("🧠 [KNOWLEDGE ENGINE] Creating singleton instance");
    knowledgeEngineInstance = new KnowledgeEngine();
  }
  
  return knowledgeEngineInstance;
}

/**
 * Reset the Knowledge Engine instance (useful for testing)
 */
export function resetKnowledgeEngine(): void {
  knowledgeEngineInstance = null;
}