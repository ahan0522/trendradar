import { NextRequest } from "next/server";
import { GET } from "@/app/api/signals/[id]/route";

export async function getSignalDetailPayload(id: string) {
  const response = await GET(new NextRequest(new URL(`http://localhost/api/signals/${encodeURIComponent(id)}`)), {
    params: Promise.resolve({ id }),
  });
  return response.json();
}
