"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import {
  Mail,
  Send,
  Inbox as InboxIcon,
  Star,
  Trash2,
  Search,
  RefreshCw,
  Paperclip,
  Clock,
  Loader2,
  Archive,
  Reply,
  UserPlus,
  X,
  MailOpen,
  ArrowLeft,
  Check,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getAvatarColor } from "@/lib/utils";

interface Email {
  id: string;
  threadId?: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body?: string;
  date: string;
  rawDate?: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
}

interface ThreadMessage {
  id: string;
  from: string;
  fromEmail: string;
  date: string;
  body: string;
  isFromMe: boolean;
}

type Folder = "inbox" | "sent" | "starred" | "trash";

function InboxContent() {
  const searchParams = useSearchParams();
  const [selectedFolder, setSelectedFolder] = useState<Folder>("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compose form state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Reply form state
  const [replyBody, setReplyBody] = useState("");

  // AI Draft state
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // Check Gmail status on mount
  useEffect(() => {
    checkGmailStatus();
  }, []);

  // Check for Gmail OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const email = searchParams.get("email");
    if (success === "true" && email) {
      setGmailConnected(true);
      setConnectedEmail(email);
      fetchEmails();
      window.history.replaceState({}, "", "/inbox");
    }
  }, [searchParams]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const checkGmailStatus = async () => {
    try {
      const response = await fetch("/api/gmail/status");
      const data = await response.json();
      setGmailConnected(data.connected);
      setConnectedEmail(data.email);

      if (data.connected) {
        await fetchEmails();
      }
    } catch (error) {
      console.error("Failed to check Gmail status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmails = async (folder: Folder = selectedFolder) => {
    setIsRefreshing(true);
    setError(null);
    try {
      let labelIds = "INBOX";
      if (folder === "sent") labelIds = "SENT";
      else if (folder === "starred") labelIds = "STARRED";
      else if (folder === "trash") labelIds = "TRASH";

      const response = await fetch(`/api/gmail/emails?maxResults=50&labelIds=${labelIds}`);
      const data = await response.json();

      if (response.ok) {
        setEmails(data.emails || []);
        setError(null);
      } else if (response.status === 401) {
        setGmailConnected(false);
        setConnectedEmail(null);
        setEmails([]);
        setError(data.error || "Gmail session expired. Please reconnect.");
      } else {
        setError(data.error || "Failed to fetch emails");
      }
    } catch (err) {
      console.error("Failed to fetch emails:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchThread = async (threadId: string) => {
    setIsLoadingThread(true);
    try {
      const response = await fetch(`/api/gmail/thread?threadId=${threadId}`);
      const data = await response.json();

      if (response.ok && data.messages) {
        setThreadMessages(data.messages);
      }
    } catch (error) {
      console.error("Failed to fetch thread:", error);
    } finally {
      setIsLoadingThread(false);
    }
  };

  const handleFolderChange = (folder: Folder) => {
    setSelectedFolder(folder);
    setSelectedEmail(null);
    setThreadMessages([]);
    fetchEmails(folder);
  };

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/gmail/auth");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to connect Gmail:", error);
      setIsConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" });
      setGmailConnected(false);
      setConnectedEmail(null);
      setEmails([]);
    } catch (error) {
      console.error("Failed to disconnect Gmail:", error);
    }
  };

  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      alert("Please fill in all fields");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          content: composeBody,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Email sent successfully!");
        setIsComposing(false);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
        fetchEmails();
      } else {
        alert(data.error || "Failed to send email");
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      alert("Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = async () => {
    if (!selectedEmail || !replyBody) {
      alert("Please enter a reply message");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedEmail.fromEmail,
          subject: selectedEmail.subject,
          content: replyBody,
          threadId: selectedEmail.threadId,
          messageId: selectedEmail.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Reply sent successfully!");
        setIsReplying(false);
        setReplyBody("");
        // Refresh thread
        if (selectedEmail.threadId) {
          fetchThread(selectedEmail.threadId);
        }
        fetchEmails();
      } else {
        alert(data.error || "Failed to send reply");
      }
    } catch (error) {
      console.error("Failed to send reply:", error);
      alert("Failed to send reply. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleEmailAction = async (action: string, emailId: string, additionalData?: Record<string, unknown>) => {
    setActionLoading(action);
    try {
      const response = await fetch("/api/gmail/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, emailId, ...additionalData }),
      });

      const data = await response.json();

      if (response.ok) {
        if (action === "archive") {
          setSuccessMessage("Email archived");
          setSelectedEmail(null);
          setThreadMessages([]);
        } else if (action === "trash") {
          setSuccessMessage("Email moved to trash");
          setSelectedEmail(null);
          setThreadMessages([]);
        } else if (action === "star") {
          setEmails(prev =>
            prev.map(e =>
              e.id === emailId ? { ...e, isStarred: additionalData?.starred as boolean } : e
            )
          );
        } else if (action === "markAsRead") {
          setEmails(prev =>
            prev.map(e => (e.id === emailId ? { ...e, isRead: true } : e))
          );
        } else if (action === "markAsUnread") {
          setEmails(prev =>
            prev.map(e => (e.id === emailId ? { ...e, isRead: false } : e))
          );
        }

        if (action === "archive" || action === "trash") {
          fetchEmails();
        }
      } else {
        alert(data.error || `Failed to ${action}`);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(`Failed to ${action}. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddAsLead = async () => {
    if (!selectedEmail) return;

    setActionLoading("addLead");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedEmail.from,
          email: selectedEmail.fromEmail,
          source: "email",
          notes: `Added from email: "${selectedEmail.subject}"`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`${selectedEmail.from} added as a lead!`);
      } else {
        alert(data.error || "Failed to add as lead");
      }
    } catch (error) {
      console.error("Failed to add as lead:", error);
      alert("Failed to add as lead. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    setIsReplying(false);
    setShowAiPrompt(false);
    setAiPrompt("");
    setThreadMessages([]);

    // Fetch thread messages
    if (email.threadId) {
      fetchThread(email.threadId);
    }

    // Mark as read if unread
    if (!email.isRead) {
      handleEmailAction("markAsRead", email.id);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!selectedEmail) return;

    setIsGeneratingDraft(true);
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: {
            from: selectedEmail.from,
            fromEmail: selectedEmail.fromEmail,
            subject: selectedEmail.subject,
            body: selectedEmail.body || selectedEmail.preview,
          },
          replyType: "professional",
          customPrompt: aiPrompt || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.draft) {
        setReplyBody(data.draft);
        setIsReplying(true);
        setShowAiPrompt(false);
        setAiPrompt("");
        setSuccessMessage("AI draft generated!");
      } else {
        alert(data.error || "Failed to generate draft");
      }
    } catch (error) {
      console.error("Failed to generate AI draft:", error);
      alert("Failed to generate draft. Please try again.");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const toggleStar = async (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    const newStarred = !email.isStarred;
    // Optimistically update UI
    setEmails(prev =>
      prev.map(em => (em.id === email.id ? { ...em, isStarred: newStarred } : em))
    );
    await handleEmailAction("star", email.id, { starred: newStarred });
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
    setThreadMessages([]);
    setIsReplying(false);
    setShowAiPrompt(false);
  };

  const folders = [
    { id: "inbox" as Folder, label: "Inbox", icon: InboxIcon, count: emails.filter(e => !e.isRead && selectedFolder === "inbox").length },
    { id: "sent" as Folder, label: "Sent", icon: Send, count: 0 },
    { id: "starred" as Folder, label: "Starred", icon: Star, count: 0 },
    { id: "trash" as Folder, label: "Trash", icon: Trash2, count: 0 },
  ];

  const filteredEmails = emails;

  if (isLoading) {
    return (
      <AppLayout title="Inbox" subtitle="Welcome back, Heath">
        <div className="bg-white rounded-xl border border-gray-200 h-[calc(100vh-180px)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Inbox" subtitle="Welcome back, Heath">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 h-[calc(100vh-180px)] flex">
        {/* Sidebar */}
        <div className="w-56 border-r border-gray-200 p-4 flex-shrink-0">
          <button
            onClick={() => {
              setIsComposing(true);
              setComposeTo("");
              setComposeSubject("");
              setComposeBody("");
            }}
            disabled={!gmailConnected}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            Compose
          </button>

          <nav className="space-y-1">
            {folders.map((folder) => {
              const Icon = folder.icon;
              return (
                <button
                  key={folder.id}
                  onClick={() => handleFolderChange(folder.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    selectedFolder === folder.id
                      ? "bg-green-50 text-green-600"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {folder.label}
                  </div>
                  {folder.count > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {folder.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">Gmail Status</p>
            {gmailConnected ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-600">Connected</span>
                </div>
                {connectedEmail && (
                  <p className="mt-1 text-xs text-gray-500 truncate">{connectedEmail}</p>
                )}
                <button
                  onClick={handleDisconnectGmail}
                  className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <span className="text-sm text-gray-600">Not Connected</span>
                </div>
                <button
                  onClick={handleConnectGmail}
                  disabled={isConnecting}
                  className="mt-2 text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50 flex items-center gap-1"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect Gmail"
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Content Area - Email List OR Email Detail */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedEmail ? (
            // Email List View
            <>
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search emails..."
                      className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  onClick={() => fetchEmails()}
                  disabled={!gmailConnected || isRefreshing}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4 text-gray-500", isRefreshing && "animate-spin")} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {!gmailConnected ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Mail className="w-12 h-12 mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">Connect Gmail to get started</p>
                    <p className="text-sm text-gray-400 mb-4">View and manage your emails directly from here</p>
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-md text-center">
                        {error}
                      </div>
                    )}
                    <button
                      onClick={handleConnectGmail}
                      disabled={isConnecting}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {isConnecting ? "Connecting..." : "Connect Gmail"}
                    </button>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Mail className="w-12 h-12 mb-4 text-red-300" />
                    <p className="text-lg font-medium text-red-600 mb-2">Error Loading Emails</p>
                    <p className="text-sm text-red-500 mb-4 max-w-md text-center">{error}</p>
                    <button
                      onClick={() => fetchEmails()}
                      disabled={isRefreshing}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {isRefreshing ? "Retrying..." : "Retry"}
                    </button>
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <InboxIcon className="w-12 h-12 mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No emails found</p>
                    <p className="text-sm text-gray-400">
                      {selectedFolder === "inbox" ? "Your inbox is empty" : `No emails in ${selectedFolder}`}
                    </p>
                  </div>
                ) : (
                  filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => handleSelectEmail(email)}
                      className={cn(
                        "flex items-start gap-3 p-4 border-b border-gray-100 cursor-pointer transition-colors",
                        !email.isRead ? "bg-blue-50/30" : "hover:bg-gray-50"
                      )}
                    >
                      <div
                        className={`w-10 h-10 rounded-full ${getAvatarColor(email.from)} flex items-center justify-center text-white font-medium text-sm flex-shrink-0`}
                      >
                        {getInitials(email.from)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              "text-sm truncate",
                              !email.isRead ? "font-semibold text-gray-900" : "text-gray-700"
                            )}
                          >
                            {email.from}
                          </span>
                          <div className="flex items-center gap-2">
                            {email.hasAttachment && (
                              <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                            )}
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {email.date}
                            </span>
                          </div>
                        </div>
                        <p
                          className={cn(
                            "text-sm truncate mb-1",
                            !email.isRead ? "font-medium text-gray-900" : "text-gray-700"
                          )}
                        >
                          {email.subject}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{email.preview}</p>
                      </div>
                      <button
                        onClick={(e) => toggleStar(e, email)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star
                          className={cn(
                            "w-4 h-4",
                            email.isStarred
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          )}
                        />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            // Email Detail View - Full Width
            <div className="flex flex-col h-full">
              {/* Header with back button and actions */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={handleBackToList}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                  </button>
                  <h3 className="font-semibold text-gray-900 text-lg flex-1">
                    {selectedEmail.subject}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap ml-9">
                  <button
                    onClick={() => handleEmailAction("archive", selectedEmail.id)}
                    disabled={actionLoading === "archive"}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "archive" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                    Archive
                  </button>
                  <button
                    onClick={() => handleEmailAction("trash", selectedEmail.id)}
                    disabled={actionLoading === "trash"}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "trash" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                  <button
                    onClick={() => handleEmailAction(
                      selectedEmail.isRead ? "markAsUnread" : "markAsRead",
                      selectedEmail.id
                    )}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MailOpen className="w-4 h-4" />
                    {selectedEmail.isRead ? "Mark Unread" : "Mark Read"}
                  </button>
                  <button
                    onClick={handleAddAsLead}
                    disabled={actionLoading === "addLead"}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "addLead" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Add as Lead
                  </button>
                </div>
              </div>

              {/* Email Thread Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingThread ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : threadMessages.length > 0 ? (
                  // Show thread messages
                  <div className="space-y-6 max-w-4xl">
                    {threadMessages.map((message, index) => (
                      <div key={message.id} className={cn(
                        "rounded-lg border",
                        message.isFromMe ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                      )}>
                        <div className="p-4 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full ${getAvatarColor(message.from)} flex items-center justify-center text-white font-medium`}
                            >
                              {getInitials(message.from)}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{message.from}</p>
                              <p className="text-sm text-gray-500">{message.fromEmail}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              {message.date}
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {message.body}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Show single email
                  <div className="max-w-4xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className={`w-12 h-12 rounded-full ${getAvatarColor(selectedEmail.from)} flex items-center justify-center text-white font-medium`}
                      >
                        {getInitials(selectedEmail.from)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{selectedEmail.from}</p>
                        <p className="text-sm text-gray-500">{selectedEmail.fromEmail}</p>
                      </div>
                      <button
                        onClick={(e) => toggleStar(e, selectedEmail)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Star
                          className={cn(
                            "w-5 h-5",
                            selectedEmail.isStarred
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                      <Clock className="w-4 h-4" />
                      {selectedEmail.date}
                      {selectedEmail.hasAttachment && (
                        <>
                          <span className="mx-2">•</span>
                          <Paperclip className="w-4 h-4" />
                          <span>Has attachment</span>
                        </>
                      )}
                    </div>

                    <div className="prose prose-sm max-w-none">
                      <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-base">
                        {selectedEmail.body || selectedEmail.preview}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply section */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                {isReplying ? (
                  <div className="space-y-3 max-w-4xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Reply to {selectedEmail.from}
                      </span>
                      <button
                        onClick={() => {
                          setIsReplying(false);
                          setReplyBody("");
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white"
                      placeholder="Write your reply..."
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleGenerateAIDraft}
                        disabled={isGeneratingDraft}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isGeneratingDraft ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {isGeneratingDraft ? "Generating..." : "Regenerate with AI"}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsReplying(false);
                            setReplyBody("");
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleReply}
                          disabled={isSending || !replyBody.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                        >
                          {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Send Reply
                        </button>
                      </div>
                    </div>
                  </div>
                ) : showAiPrompt ? (
                  <div className="space-y-3 max-w-4xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        <Sparkles className="w-4 h-4 inline mr-2 text-purple-500" />
                        Guide the AI response
                      </span>
                      <button
                        onClick={() => {
                          setShowAiPrompt(false);
                          setAiPrompt("");
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white"
                      placeholder="E.g., 'Be brief and mention our pricing starts at $500/month' or 'Politely decline and suggest they contact us next quarter'"
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Leave empty to let AI decide the best response
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowAiPrompt(false);
                            setAiPrompt("");
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleGenerateAIDraft}
                          disabled={isGeneratingDraft}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                          {isGeneratingDraft ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {isGeneratingDraft ? "Generating..." : "Generate Draft"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 max-w-4xl">
                    <button
                      onClick={() => setShowAiPrompt(true)}
                      disabled={isGeneratingDraft}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingDraft ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {isGeneratingDraft ? "Drafting..." : "Draft with AI"}
                    </button>
                    <button
                      onClick={() => setIsReplying(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
              <button
                onClick={() => setIsComposing(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="recipient@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Write your message..."
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Paperclip className="w-4 h-4" />
                Attach
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsComposing(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSending || !composeTo || !composeSubject || !composeBody}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <AppLayout title="Inbox" subtitle="Welcome back, Heath">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </AppLayout>
    }>
      <InboxContent />
    </Suspense>
  );
}
