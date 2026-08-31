import React, { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { emitDataChanged, on } from '../../utils/appEvents';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';
import type { AdminCommonProps } from './AdminTabTypes';

export interface CommunicationTemplateItem {
  id: string;
  label: string;
  text: string;
  category: 'chat' | 'email' | 'sms';
}

const DEFAULT_TEMPLATES: CommunicationTemplateItem[] = [
  {
    id: 'ct-1',
    label: '✨ Layout Approved',
    text: "Hi! We've reviewed and approved your floor plan and seating layout for your wedding day. Everything looks fantastic!",
    category: 'chat',
  },
  {
    id: 'ct-2',
    label: '⏱️ Timeline Check-in',
    text: 'Hi! Just checking in on your wedding day timeline. Let us know if you need any help coordinating vendor setup times.',
    category: 'chat',
  },
  {
    id: 'ct-3',
    label: '📋 Final Headcount Reminder',
    text: 'Reminder: Please confirm your final guest headcount and RSVP meal choices 14 days before your event.',
    category: 'chat',
  },
  {
    id: 'ct-4',
    label: '👋 Welcome & Next Steps',
    text: "Welcome to your Seven Paths Manor Couples Portal! We're here to help you design your dream space. Feel free to message us here anytime.",
    category: 'chat',
  },
];

export function getCommunicationTemplates(): CommunicationTemplateItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMMUNICATION_TEMPLATES);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveCommunicationTemplates(templates: CommunicationTemplateItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COMMUNICATION_TEMPLATES, JSON.stringify(templates));
    emitDataChanged('all');
  } catch {
    // ignore quota error
  }
}

interface EmailWordingDefaults {
  subject: string;
  body: string;
}

const DEFAULT_EMAIL_WORDING: EmailWordingDefaults = {
  subject: 'You are invited to {coupleName}’s Wedding Portal at {venueName}',
  body: 'Welcome! Please click the link below to access your Couples Portal for {coupleName} on {eventDate} at {venueName}.\n\nPortal Link: {portalUrl}',
};

export function loadEmailWording(): EmailWordingDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EMAIL_WORDING_DEFAULTS);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EmailWordingDefaults>;
      if (typeof parsed.subject === 'string' && typeof parsed.body === 'string') {
        return { subject: parsed.subject, body: parsed.body };
      }
    }
  } catch {
    // ignore corrupt storage — fall back to defaults
  }
  return DEFAULT_EMAIL_WORDING;
}

export function CommunicationTemplatesManagement(props: AdminCommonProps) {
  const { config, showSuccess } = props;
  const [templates, setTemplates] = useState<CommunicationTemplateItem[]>(() =>
    getCommunicationTemplates()
  );
  const [activeTab, setActiveTab] = useState<'chat' | 'email'>('chat');

  // Email wording defaults
  const [emailSubject, setEmailSubject] = useState(() => loadEmailWording().subject);
  const [emailBody, setEmailBody] = useState(() => loadEmailWording().body);

  const [newTemplate, setNewTemplate] = useState({
    label: '',
    text: '',
    category: 'chat' as 'chat' | 'email' | 'sms',
  });

  useEffect(() => {
    return on('spm_data_changed', () => {
      setTemplates(getCommunicationTemplates());
    });
  }, []);

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.label.trim() || !newTemplate.text.trim()) return;
    const item: CommunicationTemplateItem = {
      id: `ct-${Date.now()}`,
      label: newTemplate.label.trim(),
      text: newTemplate.text.trim(),
      category: newTemplate.category,
    };
    const updated = [...templates, item];
    setTemplates(updated);
    saveCommunicationTemplates(updated);
    setNewTemplate({ label: '', text: '', category: 'chat' });
    showSuccess('Communication template created!');
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveCommunicationTemplates(updated);
    showSuccess('Template removed!');
  };

  const handleResetToDefaults = () => {
    setTemplates(DEFAULT_TEMPLATES);
    saveCommunicationTemplates(DEFAULT_TEMPLATES);
    showSuccess('Reset to default communication templates.');
  };

  const handleSaveEmailWording = () => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.EMAIL_WORDING_DEFAULTS,
        JSON.stringify({ subject: emailSubject, body: emailBody })
      );
      emitDataChanged('all');
      showSuccess('Email invite wording defaults saved!');
    } catch {
      // ignore quota error
    }
  };

  const chatTemplates = templates.filter((t) => t.category === 'chat');

  return (
    <div className="space-y-6">
      <BrandedSectionHeader
        icon="💬"
        title="Client Communication &amp; Quick Reply Templates"
        description="Configure pre-built Quick Reply chat templates and automated portal invitation wording for Seven Paths Manor."
        config={config}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'chat'
              ? 'text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'chat'
              ? { backgroundColor: config?.primaryColor || '#4A1942' }
              : undefined
          }
        >
          💬 Quick Reply Chat Templates ({chatTemplates.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'email'
              ? 'text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'email'
              ? { backgroundColor: config?.primaryColor || '#4A1942' }
              : undefined
          }
        >
          📧 Email Invite Wording &amp; Merge Tags
        </button>
      </div>

      {activeTab === 'chat' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900">
              ➕ Add Quick Reply Template
            </h3>
            <form onSubmit={handleAddTemplate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Template Title / Label
                </label>
                <input
                  type="text"
                  value={newTemplate.label}
                  onChange={(e) => setNewTemplate({ ...newTemplate, label: e.target.value })}
                  placeholder="e.g., ✨ Floor Plan Approved"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Message Body
                </label>
                <textarea
                  value={newTemplate.text}
                  onChange={(e) => setNewTemplate({ ...newTemplate, text: e.target.value })}
                  placeholder="Write the response wording that venue coordinators can send..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={!newTemplate.label.trim() || !newTemplate.text.trim()}
                className="w-full py-2.5 rounded-lg text-white font-bold text-sm shadow-sm transition-all disabled:opacity-40"
                style={{ backgroundColor: config?.primaryColor || '#4A1942' }}
              >
                Save Template
              </button>
            </form>

            <div className="pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
              >
                🔄 Reset to Venue Defaults
              </button>
            </div>
          </div>

          {/* List of Templates */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900">
                Configured Quick Replies ({chatTemplates.length})
              </h3>
              <span className="text-xs text-gray-500">
                Available in Portal Chat &amp; Direct Messages
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {chatTemplates.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-purple-900">
                        {item.label}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 uppercase">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {item.text}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors shrink-0"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Email Invite Wording Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900">
              📧 Couples Portal Email Invitation Wording
            </h3>
            <p className="text-xs text-gray-500">
              Configure the default subject line and email body sent to couples when their portal invitation is dispatched.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Email Body
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveEmailWording}
                className="px-6 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm transition-all"
                style={{ backgroundColor: config?.primaryColor || '#4A1942' }}
              >
                Save Wording Defaults
              </button>
            </div>
          </div>

          {/* Merge Tags Reference */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-sm text-purple-900">
              🏷️ Available Dynamic Merge Tags
            </h4>
            <p className="text-xs text-purple-700">
              Click any tag below to copy it to your clipboard.
            </p>
            <div className="space-y-2">
              {[
                { tag: '{coupleName}', desc: "Couple's name (e.g., Sarah & John)" },
                { tag: '{eventDate}', desc: "Formatted wedding date" },
                { tag: '{venueName}', desc: "Your venue name from branding" },
                { tag: '{portalUrl}', desc: "Unique encrypted portal invitation link" },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(item.tag);
                    showSuccess(`Copied ${item.tag} to clipboard`);
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-purple-200 hover:border-purple-400 transition-colors flex items-center justify-between"
                >
                  <code className="text-xs font-bold text-purple-900">{item.tag}</code>
                  <span className="text-[11px] text-gray-500">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CommunicationTemplatesManagement;
