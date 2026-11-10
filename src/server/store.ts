// src/server/store.ts
/**
 * In‑memory store for negotiation state with global persistence and zero-404 resilience.
 */
import { NegotiationState } from "../types/negotiation";

const globalForStore = globalThis as unknown as {
  __negotiationStore?: Map<string, NegotiationState>;
};

const negotiationMap =
  globalForStore.__negotiationStore || new Map<string, NegotiationState>();
globalForStore.__negotiationStore = negotiationMap;

const defaultSeeds: NegotiationState[] = [
  {
    id: "demo-candidate-1",
    role: "Lead Frontend Architect",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    candidate: {
      id: "cand-1",
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      documents: [],
      interviewScores: [
        { interviewId: "t-1", type: "technical", score: 92, notes: "Top 5% architecture clarity, mastered micro-frontends" },
        { interviewId: "h-1", type: "hr", score: 88, notes: "Strong communication, cultural ownership" },
      ],
    },
    hrPrivate: {
      targetSalary: 2500000,
      maxBudget: 2700000,
      internalScores: { technicalConfidence: 92, cultureFit: 88 },
    },
    currentOffer: 2200000,
    candidateDemand: 2600000,
    round: 1,
    history: [
      {
        speaker: "agent",
        message: "Hello Priya! Welcome. I'm your AI HR partner. What compensation range are you targeting for this role?",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    toolCalls: [],
    status: "ongoing",
  },
  {
    id: "demo-candidate-2",
    role: "Senior Backend Systems Engineer",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
    candidate: {
      id: "cand-2",
      name: "Rahul Verma",
      email: "rahul.verma@example.com",
      documents: [],
      interviewScores: [
        { interviewId: "t-2", type: "technical", score: 86, notes: "Solid distributed systems & Kafka experience" },
        { interviewId: "h-2", type: "hr", score: 82, notes: "Good team collaboration" },
      ],
    },
    hrPrivate: {
      targetSalary: 2100000,
      maxBudget: 2350000,
      internalScores: { technicalConfidence: 86, cultureFit: 82 },
    },
    currentOffer: 1800000,
    candidateDemand: 2200000,
    round: 1,
    history: [
      {
        speaker: "agent",
        message: "Hello Rahul! Welcome. I'm your AI HR partner. What compensation range are you targeting for this role?",
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
    ],
    toolCalls: [],
    status: "ongoing",
  },
  {
    id: "demo-candidate-3",
    role: "Staff AI & Platform Engineer",
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date().toISOString(),
    candidate: {
      id: "cand-3",
      name: "Kavita Krishnan",
      email: "kavita.k@example.com",
      documents: [],
      interviewScores: [
        { interviewId: "t-3", type: "technical", score: 95, notes: "Exceptional LLM agentic architecture & deployment experience" },
        { interviewId: "h-3", type: "hr", score: 90, notes: "Executive-level presence and leadership" },
      ],
    },
    hrPrivate: {
      targetSalary: 3200000,
      maxBudget: 3500000,
      internalScores: { technicalConfidence: 95, cultureFit: 90 },
    },
    currentOffer: 2800000,
    candidateDemand: 3400000,
    round: 1,
    history: [
      {
        speaker: "agent",
        message: "Hello Kavita! Welcome. I'm your AI HR partner. What compensation range are you targeting for this role?",
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
    ],
    toolCalls: [],
    status: "ongoing",
  },
];

// Initialize seeds if not present
for (const s of defaultSeeds) {
  if (s.id && !negotiationMap.has(s.id)) {
    negotiationMap.set(s.id, s);
  }
}

export const store = {
  /** Get existing state or dynamically auto-seed if requested ID is unknown - guaranteed zero-404 */
  get: (id?: string | null): NegotiationState => {
    const raw = (id && typeof id === "string") ? id.trim() : "";
    const key = (raw && raw !== "undefined" && raw !== "null") ? raw : "demo-candidate-1";
    const existing = negotiationMap.get(key);
    if (existing) return existing;

    // Resilient auto-seed for any valid string/UUID: prevents 404s on refreshes or shared links
    const autoSeed: NegotiationState = {
      id: key,
      role: "Senior Full Stack Engineer",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      candidate: {
        id: `cand-${key.slice(0, 8)}`,
        name: key.startsWith("demo-") ? "Priya Sharma" : "Candidate",
        email: "candidate@example.com",
        documents: [],
        interviewScores: [
          { interviewId: "t-1", type: "technical", score: 90, notes: "Strong engineering background and system clarity" },
          { interviewId: "h-1", type: "hr", score: 85, notes: "High ownership, strong alignment" },
        ],
      },
      hrPrivate: {
        targetSalary: 2400000,
        maxBudget: 2700000,
        internalScores: { technicalConfidence: 90, cultureFit: 85 },
      },
      currentOffer: 2000000,
      candidateDemand: 2500000,
      round: 1,
      history: [
        {
          speaker: "agent",
          message: "Hello! Welcome. I'm your AI HR partner. What compensation range are you targeting for this role?",
          timestamp: new Date().toISOString(),
        },
      ],
      toolCalls: [],
      status: "ongoing",
    };

    negotiationMap.set(key, autoSeed);
    return autoSeed;
  },
  /** Save or replace a negotiation state */
  set: (id: string, state: NegotiationState) => negotiationMap.set(id, state),
  /** Delete a negotiation (cleanup) */
  delete: (id: string) => negotiationMap.delete(id),
  /** List all IDs – useful for debugging */
  listIds: (): string[] => Array.from(negotiationMap.keys()),
};
