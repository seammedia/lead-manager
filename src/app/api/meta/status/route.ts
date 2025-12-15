import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const connected = cookieStore.get("meta_connected")?.value === "true";
    const userName = cookieStore.get("meta_user_name")?.value || null;
    const pagesJson = cookieStore.get("meta_pages")?.value;

    let pages: Array<{ id: string; name: string }> = [];
    if (pagesJson) {
      try {
        pages = JSON.parse(pagesJson);
      } catch {
        pages = [];
      }
    }

    return NextResponse.json({
      connected,
      userName,
      pages,
    });
  } catch (error) {
    console.error("Error checking Meta status:", error);
    return NextResponse.json({
      connected: false,
      userName: null,
      pages: [],
    });
  }
}
