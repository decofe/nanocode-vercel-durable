import { agent } from "@/lib/agent";
import { authorize } from "@/lib/authorize";

export const maxDuration = 300;

export const { GET, POST } = agent.chatRoute(authorize ? { authorize } : {});
