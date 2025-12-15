import { NextResponse } from "next/server";
import { getMetaAuthUrl } from "@/lib/meta";

export async function GET() {
  try {
    const url = getMetaAuthUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error generating Meta auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate auth URL" },
      { status: 500 }
    );
  }
}
