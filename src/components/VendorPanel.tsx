import { useState, useMemo } from 'react';
import { useVendors } from '../hooks/useVendors';
import { Vendor, VendorCategory, VENDOR_CATEGORIES } from '../types/vendor';
import { showToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

interface VendorPanelProps {
  onClose: () => void;
  /** When true, renders inline (not a full-screen overlay) for dashboard embedding. */
  inline?: boolean;
}

export function VendorPanel({ onClose, inline = false }: VendorPanelProps) {
  const {
    vendors,
    addVendor,
    updateVendor,
    deleteVendor,
    getVendorsByCategory,
    getTotalBudget,
    getTotalPaid,
    getPaymentsForVendor,
    addPayment,
    updatePayment,
    deletePayment,
  } = useVendors();

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'budget' | 'payments'>('list');
  const [filterCategory, setFilterCategory] = useState<VendorCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'other' as VendorCategory,
    contactName: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    contractAmount: 0,
    contractSigned: false,
    depositPaid: false,
    rating: 0,
    isPreferred: false,
  });

  const handleStartEdit = (vendor: Vendor) => {
    setEditForm({
      name: vendor.name,
      category: vendor.category,
      contactName: vendor.contactName || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      website: vendor.website || '',
      notes: vendor.notes || '',
      contractAmount: vendor.contractAmount || 0,
      contractSigned: vendor.contractSigned || false,
      depositPaid: vendor.depositPaid || false,
      rating: vendor.rating || 0,
      isPreferred: vendor.isPreferred || false,
    });
    setEditingVendor(vendor);
  };

  const handleSaveEdit = () => {
    if (!editingVendor || !editForm.name.trim()) return;
    updateVendor(editingVendor.id, {
      name: editForm.name.trim(),
      category: editForm.category,
      contactName: editForm.contactName,
      email: editForm.email,
      phone: editForm.phone,
      website: editForm.website,
      notes: editForm.notes,
      contractAmount: editForm.contractAmount,
      contractSigned: editForm.contractSigned,
      depositPaid: editForm.depositPaid,
      rating: editForm.rating,
      isPreferred: editForm.isPreferred,
    });
    setEditingVendor(null);
    showToast('Vendor updated.', 'success');
  };

  // Payment recording state
  const [paymentVendorId, setPaymentVendorId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentIsPaid, setPaymentIsPaid] = useState(true);

  const handleAddPayment = () => {
    if (!paymentVendorId || paymentAmount <= 0) {
      showToast('Select a vendor and enter a payment amount.', 'warning');
      return;
    }
    addPayment({
      vendorId: paymentVendorId,
      amount: paymentAmount,
      dueDate: paymentDueDate || new Date().toISOString().slice(0, 10),
      description: 'Vendor payment',
      isPaid: paymentIsPaid,
    });
    setPaymentAmount(0);
    setPaymentDueDate('');
    setPaymentIsPaid(true);
  };

  const [newVendor, setNewVendor] = useState({
    name: '',
    category: 'other' as VendorCategory,
    contactName: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    contractAmount: 0,
  });

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesCategory = filterCategory === 'all' || v.category === filterCategory;
      const matchesSearch = !searchTerm || 
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.contactName?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [vendors, filterCategory, searchTerm]);

  const getCategoryInfo = (category: VendorCategory) => {
    return VENDOR_CATEGORIES.find(c => c.id === category) || VENDOR_CATEGORIES[VENDOR_CATEGORIES.length - 1];
  };

  const handleAddVendor = () => {
    if (!newVendor.name.trim()) return;
    addVendor({
      name: newVendor.name.trim(),
      category: newVendor.category,
      contactName: newVendor.contactName || undefined,
      email: newVendor.email || undefined,
      phone: newVendor.phone || undefined,
      website: newVendor.website || undefined,
      notes: newVendor.notes || undefined,
      contractAmount: newVendor.contractAmount || undefined,
    });
    setNewVendor({
      name: '',
      category: 'other',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      notes: '',
      contractAmount: 0,
    });
    setActiveTab('list');
  };

  const totalBudget = getTotalBudget();
  const totalPaid = getTotalPaid();

  return (
    <div className={inline ? "w-full h-full bg-white flex flex-col" : "fixed inset-0 bg-black/50 flex items-center justify-center p-4"} style={inline ? undefined : { zIndex: 10000 }}>
      <div className={inline ? "w-full h-full flex flex-col" : "w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4A1942] to-[#3d1a45] text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">🤝 Vendor Management</h2>
            <p className="text-sm text-white/70">{vendors.length} vendor(s) tracked</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'list', label: '📋 Vendors', count: vendors.length },
            { id: 'add', label: '➕ Add Vendor' },
            { id: 'payments', label: '💳 Payments' },
            { id: 'budget', label: '💰 Budget' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-[#4A1942] text-[#4A1942]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Vendor List */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search vendors..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value as VendorCategory | 'all')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {VENDOR_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor Cards */}
              {filteredVendors.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">🤝</div>
                  <p>No vendors found. Add your first vendor!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVendors.map(vendor => {
                    const catInfo = getCategoryInfo(vendor.category);
                    return (
                      <div
                        key={vendor.id}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{catInfo.icon}</span>
                            <div>
                              <h3 className="font-semibold text-gray-800">{vendor.name}</h3>
                              <p className="text-xs text-gray-500">{catInfo.label}</p>
                            </div>
                          </div>
                          {vendor.isPreferred && (
                            <span className="text-yellow-500" title="Preferred Vendor">⭐</span>
                          )}
                        </div>

                        {vendor.contactName && (
                          <p className="text-sm text-gray-600 mb-1">👤 {vendor.contactName}</p>
                        )}
                        {vendor.email && (
                          <p className="text-sm text-gray-600 mb-1">✉️ {vendor.email}</p>
                        )}
                        {vendor.phone && (
                          <p className="text-sm text-gray-600 mb-1">📞 {vendor.phone}</p>
                        )}
                        {vendor.contractAmount && (
                          <p className="text-sm font-medium text-green-600 mb-1">
                            💰 ${vendor.contractAmount.toLocaleString()}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                          {vendor.contractSigned ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                              ✓ Contract Signed
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                              Pending Contract
                            </span>
                          )}
                          {vendor.depositPaid && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                              Deposit Paid
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleStartEdit(vendor)}
                            className="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => setPendingDelete(vendor)}
                            className="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-xs transition-colors"
                            aria-label={`Delete ${vendor.name}`}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add Vendor Form */}
          {activeTab === 'add' && (
            <div className="max-w-lg mx-auto space-y-4">
              <h3 className="text-lg font-semibold">Add New Vendor</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  value={newVendor.name}
                  onChange={e => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Elegant Flowers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newVendor.category}
                  onChange={e => setNewVendor(prev => ({ ...prev, category: e.target.value as VendorCategory }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {VENDOR_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newVendor.contactName}
                    onChange={e => setNewVendor(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newVendor.phone}
                    onChange={e => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newVendor.email}
                  onChange={e => setNewVendor(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Amount ($)</label>
                <input
                  type="number"
                  value={newVendor.contractAmount || ''}
                  onChange={e => setNewVendor(prev => ({ ...prev, contractAmount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newVendor.notes}
                  onChange={e => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <button
                onClick={handleAddVendor}
                disabled={!newVendor.name.trim()}
                className="w-full py-3 bg-[#4A1942] text-white rounded-lg font-medium hover:bg-[#3b1435] disabled:opacity-50 transition-colors"
              >
                Add Vendor
              </button>
            </div>
          )}

          {/* Budget View */}
          {activeTab === 'budget' && (
            <div className="space-y-6">
              {/* Budget Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ${totalBudget.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-800">Total Budget</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ${totalPaid.toLocaleString()}
                  </div>
                  <div className="text-sm text-green-800">Total Paid</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    ${(totalBudget - totalPaid).toLocaleString()}
                  </div>
                  <div className="text-sm text-amber-800">Remaining</div>
                </div>
              </div>

              {/* Breakdown by Category */}
              <div>
                <h4 className="font-semibold mb-3">Budget by Category</h4>
                <div className="space-y-2">
                  {VENDOR_CATEGORIES.map(cat => {
                    const catVendors = getVendorsByCategory(cat.id);
                    const catTotal = catVendors.reduce((sum, v) => sum + (v.contractAmount || 0), 0);
                    if (catTotal === 0) return null;
                    const percentage = totalBudget > 0 ? (catTotal / totalBudget) * 100 : 0;
                    return (
                      <div key={cat.id} className="flex items-center gap-3">
                        <span className="text-xl w-8">{cat.icon}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{cat.label}</span>
                            <span className="font-medium">${catTotal.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#4A1942] rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Record a payment */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="font-semibold mb-3">Record a Payment</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Vendor</label>
                    <select
                      value={paymentVendorId}
                      onChange={(e) => setPaymentVendorId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select vendor…</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      min={0}
                      value={paymentAmount || ''}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Due date</label>
                    <input
                      type="date"
                      value={paymentDueDate}
                      onChange={(e) => setPaymentDueDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <input
                        type="checkbox"
                        checked={paymentIsPaid}
                        onChange={(e) => setPaymentIsPaid(e.target.checked)}
                      />
                      Paid
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddPayment}
                  className="mt-3 px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#5b2352]"
                >
                  + Add Payment
                </button>
              </div>

              {/* Payments list */}
              <div>
                <h4 className="font-semibold mb-3">All Payments</h4>
                {vendors.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                    Add vendors first to start tracking payments.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vendors.flatMap((v) =>
                      getPaymentsForVendor(v.id).map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                          <div>
                            <div className="font-medium text-gray-800">{v.name}</div>
                            <div className="text-xs text-gray-500">
                              Due {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'} · {p.description}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">${p.amount.toLocaleString()}</span>
                            <span className={`text-xs rounded-full px-2 py-0.5 ${p.isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {p.isPaid ? 'Paid' : 'Due'}
                            </span>
                            <label className="flex items-center gap-1 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={p.isPaid}
                                onChange={(e) => updatePayment(p.id, { isPaid: e.target.checked })}
                              />
                              Mark paid
                            </label>
                            <button
                              type="button"
                              onClick={() => deletePayment(p.id)}
                              className="text-red-500 hover:text-red-700 px-1"
                              aria-label={`Delete payment for ${v.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Edit Vendor modal */}
        {editingVendor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingVendor(null)}>
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">✏️ Edit Vendor</h3>
                <button onClick={() => setEditingVendor(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value as VendorCategory }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {VENDOR_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                    <input type="text" value={editForm.contactName} onChange={e => setEditForm(prev => ({ ...prev, contactName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input type="text" value={editForm.website} onChange={e => setEditForm(prev => ({ ...prev, website: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Amount ($)</label>
                  <input type="number" value={editForm.contractAmount || ''} onChange={e => setEditForm(prev => ({ ...prev, contractAmount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={editForm.contractSigned} onChange={e => setEditForm(prev => ({ ...prev, contractSigned: e.target.checked }))} /> ✓ Contract Signed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={editForm.depositPaid} onChange={e => setEditForm(prev => ({ ...prev, depositPaid: e.target.checked }))} /> 💵 Deposit Paid
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={editForm.isPreferred} onChange={e => setEditForm(prev => ({ ...prev, isPreferred: e.target.checked }))} /> ⭐ Preferred
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <select value={editForm.rating} onChange={e => setEditForm(prev => ({ ...prev, rating: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value={0}>Unrated</option>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5-n)}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={editForm.notes} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={handleSaveEdit} disabled={!editForm.name.trim()} className="flex-1 py-2.5 bg-[#4A1942] text-white rounded-lg font-medium hover:bg-[#3b1435] disabled:opacity-50 transition-colors">
                    Save Changes
                  </button>
                  <button onClick={() => setEditingVendor(null)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!pendingDelete}
          title="Delete vendor"
          message={`Are you sure you want to delete ${pendingDelete?.name ?? 'this vendor'}? This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => {
            if (pendingDelete) deleteVendor(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    </div>
  );
}

export default VendorPanel;