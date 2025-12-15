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
  MoreHorizontal,
  Paperclip,
  Clock,
  Loader2,
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

type Folder = "inbox" | "sent" | "starred" | "trash";

function InboxContent() {
  const searchParams = useSearchParams();
  const [selectedFolder, setSelectedFolder] = useState<Folder>("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      // Clear the URL params
      window.history.replaceState({}, "", "/inbox");
    }
  }, [searchParams]);

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

  const fetchEmails = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/gmail/emails?maxResults=20");
      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
      } else if (response.status === 401) {
        // Token expired or invalid
        setGmailConnected(false);
        setConnectedEmail(null);
        setEmails([]);
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setIsRefreshing(false);
    }
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

  const folders = [
    { id: "inbox" as Folder, label: "Inbox", icon: InboxIcon, count: emails.filter(e => !e.isRead).length },
    { id: "sent" as Folder, label: "Sent", icon: Send, count: 0 },
    { id: "starred" as Folder, label: "Starred", icon: Star, count: emails.filter(e => e.isStarred).length },
    { id: "trash" as Folder, label: "Trash", icon: Trash2, count: 0 },
  ];

  const filteredEmails = emails.filter((email) => {
    if (selectedFolder === "starred") return email.isStarred;
    return true;
  });

  const toggleStar = (emailId: string) => {
    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
      )
    );
  };

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
      <div className="bg-white rounded-xl border border-gray-200 h-[calc(100vh-180px)] flex">
        {/* Sidebar */}
        <div className="w-56 border-r border-gray-200 p-4">
          <button
            onClick={() => setIsComposing(true)}
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
                  onClick={() => setSelectedFolder(folder.id)}
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

        {/* Email List */}
        <div className="flex-1 flex flex-col">
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
              onClick={fetchEmails}
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
                <button
                  onClick={handleConnectGmail}
                  disabled={isConnecting}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect Gmail"}
                </button>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <InboxIcon className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No emails found</p>
                <p className="text-sm text-gray-400">Your inbox is empty</p>
              </div>
            ) : (
              filteredEmails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={cn(
                    "flex items-start gap-3 p-4 border-b border-gray-100 cursor-pointer transition-colors",
                    !email.isRead ? "bg-blue-50/30" : "hover:bg-gray-50",
                    selectedEmail?.id === email.id && "bg-green-50"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(email.id);
                    }}
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
        </div>

        {/* Email Detail */}
        {selectedEmail && (
          <div className="w-[400px] border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 truncate pr-4">
                {selectedEmail.subject}
              </h3>
              <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                <MoreHorizontal className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-full ${getAvatarColor(selectedEmail.from)} flex items-center justify-center text-white font-medium text-sm`}
                >
                  {getInitials(selectedEmail.from)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedEmail.from}</p>
                  <p className="text-sm text-gray-500">{selectedEmail.fromEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Clock className="w-4 h-4" />
                {selectedEmail.date}
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {selectedEmail.body || selectedEmail.preview}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors">
                <Send className="w-4 h-4" />
                Reply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
              <button
                onClick={() => setIsComposing(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <input
                  type="email"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={10}
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
                <button className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                  <Send className="w-4 h-4" />
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
