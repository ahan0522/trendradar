import { GET } from "@/app/api/signals/route";

export async function getSignalsListPayload() {
  const response = await GET();
  return response.json();
}
