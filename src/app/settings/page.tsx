"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import {
  User,
  Mail,
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Check,
  Loader2,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "email" | "integrations" | "notifications" | "security" | "appearance" | "data";

const tabs = [
  { id: "profile" as SettingsTab, label: "Profile", icon: User },
  { id: "email" as SettingsTab, label: "Email Integration", icon: Mail },
  { id: "integrations" as SettingsTab, label: "Lead Sources", icon: Megaphone },
  { id: "notifications" as SettingsTab, label: "Notifications", icon: Bell },
  { id: "security" as SettingsTab, label: "Security", icon: Shield },
  { id: "appearance" as SettingsTab, label: "Appearance", icon: Palette },
  { id: "data" as SettingsTab, label: "Data & Export", icon: Database },
];

interface MetaPage {
  id: string;
  name: string;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);

  // Meta state
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaUserName, setMetaUserName] = useState<string | null>(null);
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [isSyncingLeads, setIsSyncingLeads] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Check statuses on mount
  useEffect(() => {
    checkStatuses();
  }, []);

  // Check for OAuth callbacks
  useEffect(() => {
    // Gmail callback
    const success = searchParams.get("success");
    const email = searchParams.get("email");
    const error = searchParams.get("error");

    if (success === "true" && email) {
      setGmailConnected(true);
      setConnectedEmail(email);
      setActiveTab("email");
      window.history.replaceState({}, "", "/settings");
    }

    if (error) {
      alert(`Gmail connection failed: ${error}`);
      window.history.replaceState({}, "", "/settings");
    }

    // Meta callback
    const metaSuccess = searchParams.get("meta_success");
    const metaUser = searchParams.get("meta_user");
    const metaPagesParam = searchParams.get("meta_pages");
    const metaError = searchParams.get("meta_error");

    if (metaSuccess === "true") {
      setMetaConnected(true);
      setMetaUserName(metaUser);
      setActiveTab("integrations");
      window.history.replaceState({}, "", "/settings");
    }

    if (metaError) {
      alert(`Meta connection failed: ${metaError}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  const checkStatuses = async () => {
    try {
      // Check Gmail and Meta status in parallel
      const [gmailRes, metaRes] = await Promise.all([
        fetch("/api/gmail/status"),
        fetch("/api/meta/status"),
      ]);

      const gmailData = await gmailRes.json();
      setGmailConnected(gmailData.connected);
      setConnectedEmail(gmailData.email);

      const metaData = await metaRes.json();
      setMetaConnected(metaData.connected);
      setMetaUserName(metaData.userName);
      setMetaPages(metaData.pages || []);
    } catch (error) {
      console.error("Failed to check statuses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    try {
      const response = await fetch("/api/gmail/auth");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to connect Gmail:", error);
      setIsConnectingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" });
      setGmailConnected(false);
      setConnectedEmail(null);
    } catch (error) {
      console.error("Failed to disconnect Gmail:", error);
    }
  };

  const handleConnectMeta = async () => {
    setIsConnectingMeta(true);
    try {
      const response = await fetch("/api/meta/auth");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to connect Meta:", error);
      setIsConnectingMeta(false);
    }
  };

  const handleDisconnectMeta = async () => {
    try {
      await fetch("/api/meta/disconnect", { method: "POST" });
      setMetaConnected(false);
      setMetaUserName(null);
      setMetaPages([]);
    } catch (error) {
      console.error("Failed to disconnect Meta:", error);
    }
  };

  const handleSyncLeads = async () => {
    setIsSyncingLeads(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/meta/sync-leads", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setSyncMessage(`Imported ${data.leadsImported} new leads from Meta`);
      } else {
        setSyncMessage(data.error || "Failed to sync leads");
      }
    } catch (error) {
      console.error("Failed to sync leads:", error);
      setSyncMessage("Failed to sync leads");
    } finally {
      setIsSyncingLeads(false);
    }
  };

  return (
    <AppLayout title="Settings" subtitle="Manage your account settings">
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-56 border-r border-gray-200 p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-green-50 text-green-600"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {activeTab === "profile" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h2>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden">
                      <img
                        src="/avatar.svg"
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                        Change Photo
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        defaultValue="Heath"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        defaultValue="Maes"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue="contact@seammedia.com.au"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      defaultValue="Admin"
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
                    />
                  </div>

                  <button className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "email" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Email Integration</h2>

                <div className="border border-gray-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <Mail className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Gmail</h3>
                        <p className="text-sm text-gray-500">
                          Connect your Gmail account to send and receive emails
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      ) : gmailConnected ? (
                        <>
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <Check className="w-4 h-4" />
                            Connected
                          </span>
                          <button
                            onClick={handleDisconnectGmail}
                            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleConnectGmail}
                          disabled={isConnectingGmail}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isConnectingGmail ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect Gmail"
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {gmailConnected && connectedEmail && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 mb-2">Connected Account</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="text-sm text-gray-900">{connectedEmail}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Email Settings</h3>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Auto-sync emails</p>
                      <p className="text-sm text-gray-500">Automatically sync new emails every 5 minutes</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Track email opens</p>
                      <p className="text-sm text-gray-500">Track when leads open your emails</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Lead Sources</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Connect your advertising platforms to automatically import leads
                </p>

                {/* Meta/Facebook Ads */}
                <div className="border border-gray-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Meta Ads</h3>
                        <p className="text-sm text-gray-500">
                          Import leads from Facebook & Instagram Lead Ads
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      ) : metaConnected ? (
                        <>
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <Check className="w-4 h-4" />
                            Connected
                          </span>
                          <button
                            onClick={handleDisconnectMeta}
                            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleConnectMeta}
                          disabled={isConnectingMeta}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isConnectingMeta ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect Meta"
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {metaConnected && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Connected Account</p>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm text-gray-900">{metaUserName}</span>
                          </div>
                        </div>
                        <button
                          onClick={handleSyncLeads}
                          disabled={isSyncingLeads}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={cn("w-4 h-4", isSyncingLeads && "animate-spin")} />
                          {isSyncingLeads ? "Syncing..." : "Sync Leads Now"}
                        </button>
                      </div>

                      {syncMessage && (
                        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                          {syncMessage}
                        </div>
                      )}

                      {metaPages.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Connected Pages</p>
                          <div className="space-y-2">
                            {metaPages.map((page) => (
                              <div
                                key={page.id}
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                              >
                                <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">
                                    {page.name.charAt(0)}
                                  </span>
                                </div>
                                <span className="text-sm text-gray-700">{page.name}</span>
                                <span className="ml-auto text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">
                          <strong>Auto-sync enabled:</strong> New leads from your Meta Lead Ads will automatically appear in your leads list.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Google Ads (Coming Soon) */}
                <div className="border border-gray-200 rounded-xl p-6 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#FBBC04" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Google Ads</h3>
                        <p className="text-sm text-gray-500">
                          Import leads from Google Lead Form Extensions
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                      Coming Soon
                    </span>
                  </div>
                </div>

                {/* LinkedIn Ads (Coming Soon) */}
                <div className="border border-gray-200 rounded-xl p-6 mt-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">LinkedIn Ads</h3>
                        <p className="text-sm text-gray-500">
                          Import leads from LinkedIn Lead Gen Forms
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Notification Settings</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">New lead notifications</p>
                      <p className="text-sm text-gray-500">Get notified when a new lead is added</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email notifications</p>
                      <p className="text-sm text-gray-500">Get notified when you receive new emails</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Meta lead alerts</p>
                      <p className="text-sm text-gray-500">Get notified when new leads come from Meta Ads</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Weekly digest</p>
                      <p className="text-sm text-gray-500">Receive a weekly summary of your leads</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Security Settings</h2>
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Key className="w-5 h-5 text-gray-500" />
                      <h3 className="font-medium text-gray-900">Change Password</h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <button className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                        Update Password
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Two-factor authentication</p>
                      <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                    </div>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                      Enable
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Appearance Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Theme
                    </label>
                    <div className="flex gap-3">
                      <button className="flex-1 p-4 border-2 border-green-500 rounded-lg bg-white">
                        <div className="w-full h-8 bg-gray-100 rounded mb-2" />
                        <p className="text-sm font-medium text-gray-900">Light</p>
                      </button>
                      <button className="flex-1 p-4 border border-gray-200 rounded-lg bg-gray-900">
                        <div className="w-full h-8 bg-gray-700 rounded mb-2" />
                        <p className="text-sm font-medium text-white">Dark</p>
                      </button>
                      <button className="flex-1 p-4 border border-gray-200 rounded-lg bg-gradient-to-b from-white to-gray-900">
                        <div className="w-full h-8 bg-gray-400 rounded mb-2" />
                        <p className="text-sm font-medium text-gray-600">System</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Accent Color
                    </label>
                    <div className="flex gap-3">
                      {["bg-green-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"].map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "w-10 h-10 rounded-full",
                            color,
                            color === "bg-green-500" && "ring-2 ring-offset-2 ring-green-500"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "data" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Data & Export</h2>
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Export Leads</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Download all your leads data in CSV or JSON format
                    </p>
                    <div className="flex gap-3">
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                        Export CSV
                      </button>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                        Export JSON
                      </button>
                    </div>
                  </div>

                  <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <h3 className="font-medium text-red-900 mb-2">Danger Zone</h3>
                    <p className="text-sm text-red-700 mb-4">
                      Permanently delete your account and all associated data
                    </p>
                    <button className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <AppLayout title="Settings" subtitle="Manage your account settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </AppLayout>
    }>
      <SettingsContent />
    </Suspense>
  );
}
