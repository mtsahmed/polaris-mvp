import { agentCatalog } from "@/lib/agents/discovery";

export const dynamic = "force-static";

export function GET() {
  return Response.json(agentCatalog());
}
