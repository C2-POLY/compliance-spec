import type { Guest } from "../guests/model";

// Drafts a reply to a guest's question. The draft is returned to the back office; staff edit and send it.
export async function draftReply(question: string, guest: Guest): Promise<string> {
  const res = await fetch("https://api.chatloom.example/v1/complete", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CHATLOOM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `You write short, polite replies for a restaurant. The guest is ${guest.fullName}. Question: ${question}`,
    }),
  });
  const data = (await res.json()) as { text: string };
  return data.text;
}
