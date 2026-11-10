"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import { getNegotiationPublic, postMessage } from "@/lib/api";
import { MeetingRoom } from "@/components/MeetingRoom";
import {
  Bot,
  User,
  Send,
  Video,
  MessageSquare,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

function CandidateNegotiationContent({ params }: PageProps) {
  const { id } = use(params);

  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"meeting" | "chat">("meeting");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const data = await getNegotiationPublic(id);
      if (data && data.candidate) {
        setState(data);
        if (data.status === "completed") {
          setIsCompleted(true);
        }
        setError(null);
      }
    } catch (err: any) {
      // Only set fatal error if meeting has never loaded; don't tear down active calls on poll hiccups
      setState((prev: any) => {
        if (!prev) {
          setError(err.message || "Failed to load negotiation session.");
        }
        return prev;
      });
      console.warn("Negotiation sync notice:", err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [id]);

  const handleEndDiscussion = async () => {
    try {
      await fetch(`/api/negotiations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      await postMessage(id, "I would like to finalize and conclude our negotiation discussion.");
    } catch {}
    await loadData();
    setIsCompleted(true);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const userText = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    setState((prev: any) => ({
      ...prev,
      history: [
        ...(prev?.history || []),
        { speaker: "candidate", message: userText, timestamp: new Date().toISOString() },
      ],
    }));

    try {
      await postMessage(id, userText);
      await loadData();
    } catch (err: any) {
      alert("Failed to send message: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading && !state) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Connecting to AI HR Agent...</p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900">Session Unavailable</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          {error || "This negotiation session could not be found or has ended."}
        </p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
          Return to Home
        </Link>
      </div>
    );
  }

  const candidate = state.candidate || {};
  const history = state.history || [];

  return (
    <div className="flex flex-col flex-1 w-full bg-slate-50">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{candidate.name || "Candidate"}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  OFFICIAL OFFER: ₹{(state.currentOffer || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Autonomous Compensation Dialogue</span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("meeting")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === "meeting"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Live Meeting</span>
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === "chat"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Text Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {isCompleted ? (
          <div className="max-w-xl mx-auto my-auto p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                Negotiation Concluded
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                The compensation dialogue has finished. The AI evaluation engine has audited the dialogue.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center text-left">
              <div>
                <span className="text-[11px] text-slate-400 font-semibold uppercase block">Final Agreed Offer</span>
                <span className="text-xl font-extrabold text-slate-900">
                  ₹{(state?.currentOffer || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                LOCKED
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href={`/hr/negotiation/${id}/report`}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>View Full HR Evaluation Report & Replay</span>
              </Link>
              <button
                onClick={() => setIsCompleted(false)}
                className="text-xs text-slate-500 hover:text-slate-800 transition py-1"
              >
                Review Dialogue Transcript
              </button>
            </div>
          </div>
        ) : activeTab === "meeting" ? (
          <MeetingRoom
            negotiationId={id}
            candidateName={candidate.name || "Candidate"}
            onEndMeeting={handleEndDiscussion}
          />
        ) : (
          <div className="max-w-4xl mx-auto p-4 w-full flex-1 flex flex-col">
            <div className="flex-1 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col min-h-[500px]">
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {history.map((ev: any, idx: number) => {
                  const isAgent = ev.speaker === "agent";
                  const isCandidate = ev.speaker === "candidate";

                  return (
                    <div
                      key={idx}
                      className={`flex gap-3 max-w-[85%] ${
                        isCandidate ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCandidate ? "bg-indigo-600 text-white" : "bg-blue-600 text-white"
                        }`}
                      >
                        {isCandidate ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>

                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          isCandidate
                            ? "bg-indigo-600 text-white rounded-tr-none shadow-sm"
                            : "bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200/60"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold uppercase mb-1">
                          {isAgent ? "AutoOffer HR Agent" : "You"}
                        </div>
                        <div className="whitespace-pre-wrap">{ev.message}</div>
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-2 italic">
                    <Bot className="w-4 h-4 text-blue-600 animate-bounce" />
                    <span>HR Agent is analyzing...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  placeholder="Type your question or counter-demand..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={sending || !inputMessage.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Send</span>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CandidateNegotiationPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Connecting to negotiation room...</p>
          </div>
        </div>
      }
    >
      <CandidateNegotiationContent params={params} />
    </Suspense>
  );
}
