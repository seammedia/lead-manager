import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Clear Meta cookies
    cookieStore.delete("meta_connected");
    cookieStore.delete("meta_user_name");
    cookieStore.delete("meta_pages");

    // Note: In production, you might also want to revoke the token
    // and remove the connection from Supabase

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Meta:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
