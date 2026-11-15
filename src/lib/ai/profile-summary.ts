import "server-only";
import type { Icp, Profile } from "@/lib/types";

// Plain-text summary of a profile for prompts. Only fields the owner has filled in.
export function profileSummary(profile: Profile): string {
  return [
    `Name: ${profile.name}`,
    `Type: ${profile.type}`,
    profile.website && `Website: ${profile.website}`,
    profile.positioning && `Positioning: ${profile.positioning}`,
    profile.services.length && `Services: ${profile.services.join("; ")}`,
    profile.audience && `Audience: ${profile.audience}`,
    profile.strengths.length && `Strengths: ${profile.strengths.join("; ")}`,
    profile.objectives.length && `Objectives: ${profile.objectives.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function icpSummary(icp: Icp | null | undefined): string {
  if (!icp) return "No approved ICP yet.";
  return [
    `ICP v${icp.version}${icp.approved ? " (approved)" : " (draft)"}`,
    icp.industries.length && `Industries: ${icp.industries.join("; ")}`,
    icp.company_traits.length && `Company traits: ${icp.company_traits.join("; ")}`,
    icp.geographies.length && `Geographies: ${icp.geographies.join("; ")}`,
    icp.titles.length && `Decision-maker titles: ${icp.titles.join("; ")}`,
    icp.problems_addressed.length && `Problems addressed: ${icp.problems_addressed.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
