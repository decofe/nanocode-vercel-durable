import type { NextConfig } from "next";
import { withDurableHarness } from "durable-harness/next";

const config: NextConfig = {};

export default withDurableHarness(config, { agents: ["lib/agent.ts"] });
