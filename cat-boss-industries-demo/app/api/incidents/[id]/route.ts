import { NextRequest, NextResponse } from "next/server";
import { updateIncident } from "@/src/domain/incidents";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const incident = await updateIncident(id, body);
    return NextResponse.json({ incident });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update incident";
    const status = message === "Incident not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
