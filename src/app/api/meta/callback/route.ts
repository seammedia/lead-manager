import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
  getUserInfo,
  subscribeToPageWebhook,
} from "@/lib/meta";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase credentials not configured");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings?meta_error=${encodeURIComponent(errorDescription || error)}`,
        request.url
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?meta_error=No authorization code provided", request.url)
    );
  }

  try {
    // Exchange code for short-lived token
    const shortLivedTokens = await exchangeCodeForToken(code);

    // Get long-lived token (lasts ~60 days)
    const longLivedTokens = await getLongLivedToken(shortLivedTokens.access_token);

    // Get user info
    const userInfo = await getUserInfo(longLivedTokens.access_token);

    // Get pages the user manages
    const pages = await getPages(longLivedTokens.access_token);

    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL("/settings?meta_error=No Facebook pages found", request.url)
      );
    }

    // Store connection in Supabase
    const supabase = getSupabaseClient();

    // For each page, subscribe to webhook and store connection
    for (const page of pages) {
      try {
        // Subscribe to leadgen webhook for this page
        await subscribeToPageWebhook(page.id, page.access_token);

        // Store/update the connection
        const { error: upsertError } = await supabase
          .from("meta_connections")
          .upsert(
            {
              user_id: userInfo.id,
              user_name: userInfo.name,
              page_id: page.id,
              page_name: page.name,
              page_access_token: page.access_token,
              user_access_token: longLivedTokens.access_token,
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "page_id",
            }
          );

        if (upsertError) {
          console.error("Error storing Meta connection:", upsertError);
        }
      } catch (pageError) {
        console.error(`Error setting up page ${page.name}:`, pageError);
      }
    }

    // Store connection status in cookie for UI
    const cookieStore = await cookies();
    cookieStore.set("meta_connected", "true", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    cookieStore.set("meta_user_name", userInfo.name, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    cookieStore.set("meta_pages", JSON.stringify(pages.map(p => ({ id: p.id, name: p.name }))), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    const pageNames = pages.map((p) => p.name).join(", ");

    return NextResponse.redirect(
      new URL(
        `/settings?meta_success=true&meta_user=${encodeURIComponent(userInfo.name)}&meta_pages=${encodeURIComponent(pageNames)}`,
        request.url
      )
    );
  } catch (error) {
    console.error("Error in Meta OAuth callback:", error);
    return NextResponse.redirect(
      new URL(
        `/settings?meta_error=${encodeURIComponent(
          error instanceof Error ? error.message : "Authentication failed"
        )}`,
        request.url
      )
    );
  }
}
