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
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "email" | "notifications" | "security" | "appearance" | "data";

const tabs = [
  { id: "profile" as SettingsTab, label: "Profile", icon: User },
  { id: "email" as SettingsTab, label: "Email Integration", icon: Mail },
  { id: "notifications" as SettingsTab, label: "Notifications", icon: Bell },
  { id: "security" as SettingsTab, label: "Security", icon: Shield },
  { id: "appearance" as SettingsTab, label: "Appearance", icon: Palette },
  { id: "data" as SettingsTab, label: "Data & Export", icon: Database },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check Gmail status on mount
  useEffect(() => {
    checkGmailStatus();
  }, []);

  // Check for Gmail OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const email = searchParams.get("email");
    const error = searchParams.get("error");

    if (success === "true" && email) {
      setGmailConnected(true);
      setConnectedEmail(email);
      setActiveTab("email"); // Switch to email tab to show connection
      // Clear the URL params
      window.history.replaceState({}, "", "/settings");
    }

    if (error) {
      alert(`Gmail connection failed: ${error}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  const checkGmailStatus = async () => {
    try {
      const response = await fetch("/api/gmail/status");
      const data = await response.json();
      setGmailConnected(data.connected);
      setConnectedEmail(data.email);
    } catch (error) {
      console.error("Failed to check Gmail status:", error);
    } finally {
      setIsLoading(false);
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
    } catch (error) {
      console.error("Failed to disconnect Gmail:", error);
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
                          disabled={isConnecting}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isConnecting ? (
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

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email signature</p>
                      <p className="text-sm text-gray-500">Add a signature to all outgoing emails</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
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
                      <p className="text-sm font-medium text-gray-900">Stage change alerts</p>
                      <p className="text-sm text-gray-500">Get notified when a lead changes stage</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
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
