import { v4 as uuidv4 } from "uuid";
import { checkExpertStatus, createSession } from "./tidb.js";
import { generate as shadowGenerate } from "./shadowWorker.js";
import { enqueue } from "./waitingRoom.js";

/**
 * Route a mentee query to the appropriate handler:
 * - Online expert: forward directly (returns routing info)
 * - Offline expert: trigger shadow worker, enqueue for review
 */
export async function routeQuery({ menteeId, expertId, mem9SpaceId, expertName, query }) {
  const { isOnline } = await checkExpertStatus(expertId);

  const sessionId = uuidv4();
  await createSession({ id: sessionId, expertId, menteeId, query });

  if (isOnline) {
    return {
      status: "forwarded",
      sessionId,
      message: `Query forwarded to ${expertName || "expert"} who is currently online.`,
    };
  }

  const draft = await shadowGenerate({
    expertId,
    mem9SpaceId,
    expertName: expertName || "Expert",
    query,
  });

  const draftId = await enqueue({
    expertId,
    menteeId,
    sessionId,
    draft,
  });

  return {
    status: "pending_review",
    sessionId,
    draftId,
    message: `${expertName || "Expert"} is offline. A draft response has been generated and is awaiting their review.`,
  };
}
