import { NextRequest, NextResponse } from "next/server";
import { createIncident, listIncidents } from "@/src/domain/incidents";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const severity = request.nextUrl.searchParams.get("severity");
  const incidents = await listIncidents({ status, severity });
  return NextResponse.json({ incidents });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const incident = await createIncident(body);
    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
