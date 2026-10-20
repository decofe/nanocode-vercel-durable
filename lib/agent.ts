import { durableAgent, type HostTool, virtual } from "durable-harness";
import { workspaceInstructions, workspaceTools } from "durable-harness/tools";
import { nanocodeHarness } from "../src/index.ts";
import { type Charge, chargeTool } from "./tools.ts";

export const workspace = virtual();

export const INSTRUCTIONS = `You are nanocode, a coding agent running in a Vercel Function. ${workspaceInstructions(workspace)} If a charge comes back interrupted or with an unknown outcome, do not charge again: tell the user it may have gone through. Keep answers short.`;

export const appTools = (record: (charge: Charge) => Promise<void> | void): HostTool[] => [...workspaceTools(workspace), chargeTool(record)];

export const agent = durableAgent({
  harness: nanocodeHarness({
    provider: process.env.NANOCODE_PROVIDER === "codex" ? "codex" : "claude",
    model: process.env.NANOCODE_MODEL ?? (process.env.NANOCODE_PROVIDER === "codex" ? "gpt-6-luna" : "claude-sonnet-5-5"),
    instructions: INSTRUCTIONS,
    tools: appTools(charge => console.log(JSON.stringify({ charge }))),
  }),
  durability: "strict",
});
