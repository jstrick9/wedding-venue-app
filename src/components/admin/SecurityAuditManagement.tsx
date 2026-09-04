import React, { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { emitDataChanged, on } from '../../utils/appEvents';
import { useRBAC } from '../../hooks/useRBAC';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';
import type { AdminCommonProps } from './AdminTabTypes';

export interface SecuritySettingsConfig {
  sessionTimeoutDays: number;
  passwordMinLength: number;
  requireSpecialChar: boolean;
  guestTokenExpiryDays: number;
  enableAuditLogging: boolean;
}

const DEFAULT_SECURITY: SecuritySettingsConfig = {
  sessionTimeoutDays: 14,
  passwordMinLength: 8,
  requireSpecialChar: true,
  guestTokenExpiryDays: 30,
  enableAuditLogging: true,
};

export function getSecuritySettings(): SecuritySettingsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SECURITY_SETTINGS);
    if (!raw) return DEFAULT_SECURITY;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SECURITY, ...parsed };
  } catch {
    return DEFAULT_SECURITY;
  }
}

export function saveSecuritySettings(settings: SecuritySettingsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SECURITY_SETTINGS, JSON.stringify(settings));
    emitDataChanged('all');
  } catch {
    // ignore quota error
  }
}

export function SecurityAuditManagement(props: AdminCommonProps) {
  const { config, showSuccess } = props;
  const { auditLog } = useRBAC();
  const [settings, setSettings] = useState<SecuritySettingsConfig>(() =>
    getSecuritySettings()
  );
  const [activeTab, setActiveTab] = useState<'security' | 'audit'>('security');
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    return on('spm_data_changed', () => {
      setSettings(getSecuritySettings());
    });
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSecuritySettings(settings);
    showSuccess('System security & privacy settings saved!');
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.LAYOUT_EDIT_SESSIONS);
      localStorage.removeItem(STORAGE_KEYS.COUPLE_SESSION);
      showSuccess('Cleared temporary edit sessions and cache cleanly.');
    } catch {
      showSuccess('Cache cleared.');
    }
  };

  const exportAuditCSV = () => {
    if (!auditLog || auditLog.length === 0) return;
    const headers = ['ID', 'Action', 'PerformedBy', 'PerformedByName', 'Target', 'Details', 'Timestamp'];
    const rows = auditLog.map((a) => [
      a.id,
      a.action,
      a.performedBy,
      a.performedByName,
      a.targetName || a.targetId || '',
      `"${(a.details || '').replace(/"/g, '""')}"`,
      a.timestamp,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sevenpaths_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Exported audit log as CSV.');
  };

  const exportAuditJSON = () => {
    if (!auditLog || auditLog.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLog, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `sevenpaths_audit_log_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Exported audit log as JSON.');
  };

  const filteredAudit = (auditLog || []).filter((entry) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.trim().toLowerCase();
    return (
      entry.action.toLowerCase().includes(q) ||
      entry.performedByName.toLowerCase().includes(q) ||
      (entry.details || '').toLowerCase().includes(q) ||
      (entry.targetName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <BrandedSectionHeader
        icon="🛡️"
        title="Security, Audit Log &amp; Data Privacy Settings"
        description="Configure workspace security rules, session expiry, and export comprehensive administrative audit logs."
        config={config}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'security'
              ? 'text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'security'
              ? { backgroundColor: config?.primaryColor || '#4A1942' }
              : undefined
          }
        >
          🔒 Security &amp; Privacy Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'audit'
              ? 'text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'audit'
              ? { backgroundColor: config?.primaryColor || '#4A1942' }
              : undefined
          }
        >
          📋 Comprehensive Audit Trail ({auditLog.length})
        </button>
      </div>

      {activeTab === 'security' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-base text-gray-900">
              🔒 Workspace Authentication &amp; Security Rules
            </h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Session Timeout Duration
                  </label>
                  <select
                    value={settings.sessionTimeoutDays}
                    onChange={(e) =>
                      setSettings({ ...settings, sessionTimeoutDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value={7}>7 Days (High Security)</option>
                    <option value={14}>14 Days (Standard)</option>
                    <option value={30}>30 Days (Extended)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Minimum Password Length
                  </label>
                  <select
                    value={settings.passwordMinLength}
                    onChange={(e) =>
                      setSettings({ ...settings, passwordMinLength: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value={8}>8 Characters (Standard)</option>
                    <option value={10}>10 Characters (Enhanced)</option>
                    <option value={12}>12 Characters (Strict)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.requireSpecialChar}
                    onChange={(e) =>
                      setSettings({ ...settings, requireSpecialChar: e.target.checked })
                    }
                    className="rounded border-gray-300 text-[#4A1942]"
                  />
                  <span>Require at least one symbol or special character in user passwords</span>
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableAuditLogging}
                    onChange={(e) =>
                      setSettings({ ...settings, enableAuditLogging: e.target.checked })
                    }
                    className="rounded border-gray-300 text-[#4A1942]"
                  />
                  <span>Enable real-time administrative and RBAC audit trail recording</span>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg text-white font-bold text-sm shadow-sm transition-all"
                  style={{ backgroundColor: config?.primaryColor || '#4A1942' }}
                >
                  Save Security Settings
                </button>
              </div>
            </form>
          </div>

          {/* Maintenance Tools Card */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-sm text-purple-900">
              🧹 Workspace Maintenance &amp; Diagnostics
            </h4>
            <p className="text-xs text-purple-700">
              Use these administrative utilities to maintain healthy saved workspace data and remove stale edit sessions.
            </p>
            <button
              type="button"
              onClick={handleClearCache}
              className="w-full py-2.5 rounded-lg bg-white border border-purple-300 hover:bg-purple-100 text-purple-900 font-bold text-xs shadow-sm transition-colors"
            >
              🧹 Clear Expired Sessions &amp; Cache
            </button>
          </div>
        </div>
      ) : (
        /* Audit Trail Tab */
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-base text-gray-900">
                📋 Administrative &amp; Access Control Audit Log ({filteredAudit.length})
              </h3>
              <p className="text-xs text-gray-500">
                Real-time chronological record of role and permission modifications across Seven Paths Manor.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportAuditCSV}
                disabled={auditLog.length === 0}
                className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-sm disabled:opacity-40"
              >
                📥 Export CSV
              </button>
              <button
                type="button"
                onClick={exportAuditJSON}
                disabled={auditLog.length === 0}
                className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-sm disabled:opacity-40"
              >
                📥 Export JSON
              </button>
            </div>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs">🔍</span>
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filter audit entries by action, user, or details..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAudit.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-gray-300 rounded-xl text-gray-400 text-sm">
                No audit entries match your search.
              </div>
            ) : (
              [...filteredAudit]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-gray-200 p-3 text-sm bg-gray-50/50 flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                          {entry.targetName || entry.targetId || entry.targetType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{entry.details}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        by {entry.performedByName} ({entry.performedBy})
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default SecurityAuditManagement;
