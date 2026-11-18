import "server-only";
import type { z } from "zod";
import { discoveryJob } from "./discovery";
import { pitchConceptsJob, pitchEmailJob, pitchResearchJob, pitchStartJob } from "./pitch";
import { icpDraftJob, profileIntelligenceJob } from "./profile";
import type { AiJob } from "./types";
import type { AiTask } from "./tasks";

// Every AI action a user waits on, by the task name in POST /api/ai/[task].
export const AI_JOBS: Record<AiTask, AiJob<z.ZodType>> = {
  "profile-intelligence": profileIntelligenceJob,
  "icp-draft": icpDraftJob,
  discovery: discoveryJob,
  "pitch-start": pitchStartJob,
  "pitch-research": pitchResearchJob,
  "pitch-concepts": pitchConceptsJob,
  "pitch-email": pitchEmailJob,
};
