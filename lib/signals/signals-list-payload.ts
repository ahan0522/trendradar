import { NextRequest } from "next/server";
import { GET } from "@/app/api/signals/route";

export async function getSignalsListPayload() {
  const response = await GET(new NextRequest(new URL("http://localhost/api/signals")));
  return response.json();
}
