import { NextResponse } from "next/server";
import { AUTH_MESSAGES } from "@/lib/auth/messages";

export async function POST() {
  return NextResponse.json({ error: AUTH_MESSAGES.confirmationMailDisabled }, { status: 410 });
}
