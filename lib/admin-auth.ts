import { NextRequest, NextResponse } from "next/server";

export function getAdminSecret() {
  return process.env.ADMIN_SECRET || process.env.CRON_SECRET || "";
}

export function isAdminRequest(request: NextRequest) {
  const expected = getAdminSecret();
  if (!expected) return false;

  const headerSecret = request.headers.get("x-admin-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  return headerSecret === expected || bearerSecret === expected;
}

export function requireAdminSecret(request: NextRequest) {
  if (isAdminRequest(request)) return null;

  return NextResponse.json(
    {
      ok: false,
      error: "Unauthorized admin request. Provide x-admin-secret or Authorization: Bearer <secret>.",
    },
    { status: 401 },
  );
}
