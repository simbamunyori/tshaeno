import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** For the deploy's health check and uptime monitoring: the app is up and can reach its database. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, version: process.env.APP_VERSION ?? "dev" });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
