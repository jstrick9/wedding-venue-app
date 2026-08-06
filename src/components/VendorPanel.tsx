// @ts-nocheck
import { useState, useMemo } from 'react';
import { useVendors } from '../hooks/useVendors';
import { Vendor } from '../types/vendor';
import { showToast } from './Toast';
import { Button, EmptyState } from './ui';
import { ConfirmDialog } from './ConfirmDialog';
import { getCoupleEvents } from '../services/couples/coupleService';
import { getCoupleVendors } from '../services/couples/coupleVendorService';
import {
  getVendorCategories,
  addVendorCategory,
  removeVendorCategory,
  vendorCategoryLabel,
  VendorCategoryDef,
} from '../services/vendors/vendorCategoryService';

interface VendorPanelProps {
  onClose: () => void;
  /** When true, renders inline (not a full-screen overlay) for dashboard embedding. */
  inline?: boolean;
}

/**
 * Preferred-vendors showcase: the venue curates its preferred vendors by
 * category (Food & Catering, Bar Service, Photography, Floral, …) so couples can
 * browse and choose from them. Payments/budget are intentionally removed — this
 * is a showcase/directory, not a ledger.
 */
export function VendorPanel({ onClose, inline = false }: VendorPanelProps) {
  const { vendors, addVendor, updateVendor, deleteVendor } = useVendors();
  const categories = useMemo(() => getVendorCategories(), [vendors]);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Vendor | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  const [form, setForm] = useState({
    name: '',
    category: categories[0]?.id || 'other',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    description: '',
    imageUrl: '',
    rating: 0,
    isPreferred: true,
  });

  const handleStartEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setForm({
      name: vendor.name,
      category: vendor.category,
      contactName: vendor.contactName || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      website: vendor.website || '',
      notes: vendor.notes || '',
      description: vendor.description || '',
      imageUrl: vendor.imageUrl || '',
      rating: vendor.rating || 0,
      isPreferred: vendor.isPreferred ?? true,
    });
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vendors.filter((v) => {
      if (activeCategory !== 'all' && v.category !== activeCategory) return false;
      if (q && !`${v.name} ${v.contactName || ''} ${v.notes || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [vendors, activeCategory, searchTerm]);

  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    vendors.forEach((v) => { map[v.category] = (map[v.category] || 0) + 1; });
    return map;
  }, [vendors]);

  // How many couples are using each preferred vendor (couples pick from this list).
  const couplesUsingVendor = useMemo(() => {
    const map: Record<string, number> = {};
    getCoupleEvents().forEach((ev) => {
      getCoupleVendors(ev.id).forEach((cv) => {
        if (cv.venueVendorId) map[cv.venueVendorId] = (map[cv.venueVendorId] || 0) + 1;
      });
    });
    return map;
  }, [vendors]);

  const saveVendor = () => {
    if (!form.name.trim()) { showToast('Enter a vendor name.', 'warning'); return; }
    const payload = { name: form.name, category: form.category, contactName: form.contactName, email: form.email, phone: form.phone, website: form.website, notes: form.notes, description: form.description, imageUrl: form.imageUrl, rating: form.rating, isPreferred: form.isPreferred };
    if (editingVendor) { updateVendor(editingVendor.id, payload); showToast('Vendor updated.', 'success'); }
    else { addVendor(payload); showToast('Preferred vendor added.', 'success'); }
    setEditingVendor(null);
    setForm({ name: '', category: categories[0]?.id || 'other', contactName: '', email: '', phone: '', website: '', notes: '', description: '', imageUrl: '', rating: 0, isPreferred: true });
  };

  const saveCategory = () => {
    if (!newCategoryLabel.trim()) return;
    addVendorCategory({ label: newCategoryLabel });
    setNewCategoryLabel('');
  };

  const cat = (id: string) => categories.find((c) => c.id === id);

  return (
    <div className={inline ? "w-full h-full bg-white flex flex-col" : "fixed inset-0 bg-black/50 flex items-center justify-center p-4"} style={inline ? undefined : { zIndex: 10000 }}>
      <div className={inline ? "w-full h-full flex flex-col" : "w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"}>
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ background: 'linear-gradient(to right, #4A1942, #6b2c5c)' }}>
          <div className="text-white">
            <h1 className="text-lg font-bold">🧰 Preferred Vendors</h1>
            <p className="text-xs opacity-80">Curate the vendors you recommend to your couples, organized by category.</p>
          </div>
          <button type="button" onClick={onClose} className="text-white text-xl hover:opacity-80" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Category filter tiles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setActiveCategory('all')} className={`px-3 py-1.5 rounded-full text-sm ${activeCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>All ({vendors.length})</button>
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => setActiveCategory(c.id)} className={`px-3 py-1.5 rounded-full text-sm ${activeCategory === c.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                {c.icon} {c.label} ({countsByCategory[c.id] || 0})
              </button>
            ))}
            <button type="button" onClick={() => setShowCategoryManager((v) => !v)} className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">⚙️ Categories</button>
          </div>

          {/* Category manager */}
          {showCategoryManager && (
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700">Manage categories</div>
              <div className="flex gap-2">
                <input type="text" value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)} placeholder="New category (e.g. Bar Service)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="New category" />
                <Button type="button" tone="primary" onClick={saveCategory}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-1 text-gray-700">
                    {c.icon} {c.label}
                    <button type="button" onClick={() => removeVendorCategory(c.id)} className="text-red-400 hover:text-red-600" aria-label={`Remove ${c.label}`}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add / edit vendor */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">{editingVendor ? `Edit ${editingVendor.name}` : 'Add a preferred vendor'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vendor name *" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Vendor name" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Category">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Contact name" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Contact name" />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Email" />
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Phone" />
              <input type="text" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Website" />
              <input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Photo URL" className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:col-span-2" aria-label="Photo URL" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description shown to couples" className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:col-span-2" rows={2} aria-label="Description" />
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:col-span-2" aria-label="Notes" />
            </div>
            <div className="flex gap-2">
              <Button type="button" tone="primary" onClick={saveVendor}>{editingVendor ? '💾 Save changes' : '+ Add vendor'}</Button>
              {editingVendor && <Button type="button" onClick={() => setEditingVendor(null)}>Cancel</Button>}
            </div>
          </div>

          {/* Search */}
          <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search vendors…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Search vendors" />

          {/* Vendor cards */}
          {filtered.length === 0 ? (
            <EmptyState icon="🧰" title="No vendors here yet" hint="Add a preferred vendor above, or create a new category." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((v) => (
                <div key={v.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {v.imageUrl ? (
                        <img src={v.imageUrl} alt={v.name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">{cat(v.category)?.icon || '🧰'}</div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate">{v.name}</div>
                        <div className="text-xs text-gray-500 truncate">{vendorCategoryLabel(v.category)}</div>
                        {v.contactName && <div className="text-xs text-gray-400">{v.contactName}</div>}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">⭐ Preferred</span>
                  </div>
                  {v.description && <p className="text-sm text-gray-600 mt-2">{v.description}</p>}
                  {couplesUsingVendor[v.id] ? (
                    <div className="mt-2 text-xs text-gray-500">
                      Used by <span className="font-semibold text-indigo-600">{couplesUsingVendor[v.id]}</span> couple{couplesUsingVendor[v.id] === 1 ? '' : 's'}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {v.phone && <a href={`tel:${v.phone}`} className="text-indigo-600 hover:underline">📞 {v.phone}</a>}
                    {v.email && <a href={`mailto:${v.email}`} className="text-indigo-600 hover:underline">✉️</a>}
                    {v.website && <a href={v.website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">🌐</a>}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button type="button" onClick={() => handleStartEdit(v)} className="text-xs text-gray-600 hover:underline">Edit</button>
                    <button type="button" onClick={() => setPendingDelete(v)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove vendor?"
        message={`Remove ${pendingDelete?.name} from your preferred vendors?`}
        confirmLabel="Remove"
        onConfirm={() => { if (pendingDelete) deleteVendor(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
