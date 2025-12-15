import { NextRequest, NextResponse } from "next/server";
import { listEmails } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("x-gmail-access-token");
  const refreshToken = request.headers.get("x-gmail-refresh-token");

  if (!accessToken) {
    return NextResponse.json(
      { error: "Access token is required" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const maxResults = parseInt(searchParams.get("maxResults") || "20");
  const query = searchParams.get("query") || undefined;
  const labelIds = searchParams.get("labelIds")?.split(",") || ["INBOX"];

  try {
    const emails = await listEmails(accessToken, refreshToken || undefined, {
      maxResults,
      query,
      labelIds,
    });

    return NextResponse.json({ emails });
  } catch (error) {
    console.error("Error fetching emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
