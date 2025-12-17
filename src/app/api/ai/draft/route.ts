import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface EmailContext {
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
}

interface BusinessContext {
  notes: string;
  attachments: Array<{
    name: string;
    content: string;
    type: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    console.log("[AI Draft] Starting request...");

    if (!OPENAI_API_KEY) {
      console.error("[AI Draft] No API key found");
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, replyType = "professional", customPrompt } = body as {
      email: EmailContext;
      replyType?: "professional" | "friendly" | "brief";
      customPrompt?: string;
    };

    if (!email || !email.body) {
      return NextResponse.json(
        { error: "Email content is required" },
        { status: 400 }
      );
    }

    console.log("[AI Draft] Email received from:", email.from);

    // Fetch business context from database (don't fail if table doesn't exist)
    let businessContext: BusinessContext = {
      notes: "",
      attachments: [],
    };

    try {
      const supabase = getServiceSupabase();
      const { data: contextData, error: contextError } = await supabase
        .from("business_context")
        .select("*")
        .eq("user_id", "default")
        .single();

      if (contextError) {
        console.log("[AI Draft] Business context not found (this is OK):", contextError.message);
      } else if (contextData) {
        businessContext = {
          notes: contextData.notes || "",
          attachments: contextData.attachments || [],
        };
        console.log("[AI Draft] Business context loaded");
      }
    } catch (dbError) {
      console.log("[AI Draft] DB error (continuing without context):", dbError);
    }

    // Build the system prompt and user message
    const systemPrompt = buildSystemPrompt(businessContext);
    const userMessage = buildUserMessage(email, replyType, customPrompt);

    console.log("[AI Draft] Making OpenAI request...");

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const generatedText = completion.choices[0]?.message?.content;

    if (!generatedText) {
      console.error("[AI Draft] No response generated");
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 500 }
      );
    }

    console.log("[AI Draft] Successfully generated draft");
    return NextResponse.json({
      draft: generatedText.trim(),
    });
  } catch (error) {
    console.error("[AI Draft] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate draft: ${errorMessage}` },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(businessContext: BusinessContext): string {
  let prompt = `You are an email assistant for Seam Media, a professional media and marketing company. Your task is to draft helpful, professional email replies.

Key guidelines:
- Be professional but personable
- Keep responses concise and to the point
- Address the sender's questions or concerns directly
- Sign off with "Thanks," followed by a blank line, then "Heath" on its own line
- Do NOT include a subject line - only write the email body
- Do NOT use placeholder text like [Your Name] - use "Heath" as the sender
`;

  // Add business context if available
  if (businessContext.notes) {
    prompt += `
IMPORTANT BUSINESS CONTEXT - Use this information to craft relevant responses:
${businessContext.notes}
`;
  }

  // Add attachment content if available
  if (businessContext.attachments && businessContext.attachments.length > 0) {
    prompt += `
ADDITIONAL BUSINESS DOCUMENTS:
`;
    for (const attachment of businessContext.attachments) {
      prompt += `--- ${attachment.name} ---
${attachment.content}

`;
    }
  }

  return prompt;
}

function buildUserMessage(email: EmailContext, replyType: string, customPrompt?: string): string {
  let message = `Please draft a ${replyType} reply to this email:

From: ${email.from} <${email.fromEmail}>
Subject: ${email.subject}
Message:
${email.body}

`;

  if (customPrompt) {
    message += `ADDITIONAL INSTRUCTIONS FROM USER:
${customPrompt}

`;
  }

  message += `Write only the email body text, nothing else:`;

  return message;
}
