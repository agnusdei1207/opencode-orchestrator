/**
 * Prompt Metadata Type Definitions
 */

export interface PromptMetadata {
  id: string;
  category: string;
  description?: string;
  usedBy: string[];
  dependsOn: {
    sameFolder?: string[];
    otherFolders?: string[];
  };
  externalFiles?: Record<string, { immutable: boolean; reason: string }>;
  tags?: string[];
}

export const createMetadata = (metadata: PromptMetadata): PromptMetadata => metadata;
