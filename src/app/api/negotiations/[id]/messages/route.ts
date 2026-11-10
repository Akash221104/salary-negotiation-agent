// src/app/api/negotiations/[id]/messages/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/server/store";
import type { NegotiationState, NegotiationEvent } from "@/types/negotiation";

// Validate candidate message payload
const MessageSchema = z.object({
  message: z.string().min(1),
});

/** Helper to parse monetary amounts expressed as LPA, Lakhs, ranges (e.g. 20 to 25), or raw numbers */
function parseSalaryFromText(text: string): number | null {
  // Matches "20 to 25", "20 - 25", "20-25 lpa"
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)(?:\s*(?:lpa|lakh|lac|l))?/i);
  if (rangeMatch) {
    const highVal = parseFloat(rangeMatch[2]);
    if (highVal > 0 && highVal < 150) {
      return Math.round(highVal * 100000);
    }
  }

  // Matches "12 LPA", "12.5 LPA", "12 Lakh", "12.5L", "₹12,00,000"
  const lpaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac|l)\b/i);
  if (lpaMatch) {
    const val = parseFloat(lpaMatch[1]);
    return Math.round(val * 100000);
  }

  const rawMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{5,8})/i);
  if (rawMatch) {
    const cleaned = rawMatch[1].replace(/,/g, "");
    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val > 100000) return val;
  }

  // Standalone numbers between 5 and 100 representing LPA (e.g. "expecting 25", "want 30")
  const shortNumMatch = text.match(/\b([5-9]|[1-9]\d)\b/);
  if (shortNumMatch) {
    const val = parseFloat(shortNumMatch[1]);
    if (val >= 6 && val <= 120) {
      return Math.round(val * 100000);
    }
  }

  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const state = store.get(id) as NegotiationState | undefined;
  if (!state) {
    return NextResponse.json({ error: "Negotiation not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { message } = MessageSchema.parse(body);

    // Save candidate message event
    const candidateEvent: NegotiationEvent = {
      speaker: "candidate",
      message,
      timestamp: new Date().toISOString(),
    };
    state.history.push(candidateEvent);
    state.round += 1;

    // Check 1: If human approval is already PENDING, do not bypass the gate
    if (state.humanApproval?.status === "PENDING") {
      const neutralMsg = "We're reviewing the next steps on the offer. I'll get back to you shortly.";
      const agentEvent: NegotiationEvent = {
        speaker: "agent",
        message: neutralMsg,
        timestamp: new Date().toISOString(),
      };
      state.history.push(agentEvent);
      store.set(id, state);
      return NextResponse.json({
        action: "HOLD_POSITION",
        message: neutralMsg,
      }, { status: 200 });
    }

    // Check 2: Parse candidate ask and check against private max budget
    const parsedAsk = parseSalaryFromText(message);
    if (parsedAsk) {
      state.candidateDemand = parsedAsk;

      // Real Refusal Case: If candidate asks for more than hidden maximum
      if (parsedAsk > state.hrPrivate.maxBudget) {
        const refusalMsg =
          "I understand your expectation. However, I'm not able to support that compensation level for this role. We can explore the strongest package available within the compensation range for this position.";

        const agentEvent: NegotiationEvent = {
          speaker: "agent",
          message: refusalMsg,
          timestamp: new Date().toISOString(),
        };
        state.history.push(agentEvent);
        store.set(id, state);

        return NextResponse.json({
          action: "REJECT_REQUEST",
          message: refusalMsg,
        }, { status: 200 });
      }
    }

    // Run existing negotiation agent
    const { runNegotiationAgent, cleanSpokenMessage } = await import("@/server/agent/agent");
    const decision = await runNegotiationAgent(state, message);
    const sanitizedAgentMessage = cleanSpokenMessage(decision.message);

    // Check 3: Human Approval Escalation
    // If agent requested approval OR if proposed offer exceeds targetSalary
    if (
      decision.action === "REQUEST_HUMAN_APPROVAL" ||
      (decision.counterOffer && decision.counterOffer > state.hrPrivate.targetSalary)
    ) {
      state.humanApproval = {
        status: "PENDING",
        requestedAt: new Date().toISOString(),
        requestedOffer: decision.counterOffer || state.currentOffer,
        reason: decision.approvalReason || "Counter-offer exceeds standard target band and requires HR sign-off.",
      };
      state.humanApprovalNeeded = true;

      const neutralMsg = "We're reviewing the next steps on your compensation package. I'll get back to you shortly.";
      const agentEvent: NegotiationEvent = {
        speaker: "agent",
        message: neutralMsg,
        timestamp: new Date().toISOString(),
      };
      state.history.push(agentEvent);
      store.set(id, state);

      return NextResponse.json({
        action: "HOLD_POSITION",
        message: neutralMsg,
      }, { status: 200 });
    }

    // Save agent action event
    const agentEvent: NegotiationEvent = {
      speaker: "agent",
      message: sanitizedAgentMessage,
      timestamp: new Date().toISOString(),
    };
    state.history.push(agentEvent);

    // Update state based on decision
    if (decision.action === "MAKE_COUNTER_OFFER" && typeof decision.counterOffer === "number") {
      state.currentOffer = decision.counterOffer;
      state.agentOffer = decision.counterOffer;
    } else if (decision.action === "END_NEGOTIATION") {
      state.status = "completed";
    }

    // Persist updated state
    store.set(id, state);

    // Return candidate‑safe response (no private data)
    const responsePayload: any = {
      action: decision.action,
      message: sanitizedAgentMessage,
      currentOffer: state.currentOffer,
      requiresApproval: Boolean(state.humanApprovalNeeded),
    };
    if (decision.counterOffer !== undefined) {
      responsePayload.counterOffer = decision.counterOffer;
    }
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err) {
    console.error("Message processing error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
