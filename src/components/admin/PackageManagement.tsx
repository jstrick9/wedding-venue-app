import { useEffect, useState } from 'react';
import { useConfirm } from '../useConfirm';
import {
  WeddingPackage,
  WeddingPackageDuration,
  WeddingSeasonPrice,
  PackageAddOnCategory,
} from '../../types';
import {
  getWeddingPackages,
  saveWeddingPackage,
  deleteWeddingPackage,
  seedDefaultWeddingPackages,
  INCLUDED_ITEMS,
  PACKAGE_DURATIONS,
  suggestSetupTaskTitles,
} from '../../services/couples/couplePackageService';
import {
  getPackageAddOns,
  savePackageAddOn,
  deletePackageAddOn,
  seedDefaultPackageAddOns,
  ADD_ON_CATEGORIES,
} from '../../services/couples/coupleAddOnService';

interface Props {
  onShowSuccess: (msg: string) => void;
  venues: { id: string; name: string; category: string }[];
}

type Section = 'packages' | 'addons';

export function PackageManagement({ onShowSuccess, venues }: Props) {
  useEffect(() => {
    seedDefaultWeddingPackages();
    seedDefaultPackageAddOns();
    setPackages(getWeddingPackages());
    setAddOns(getPackageAddOns());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [section, setSection] = useState<Section>('packages');
  const [packages, setPackages] = useState<WeddingPackage[]>(() => getWeddingPackages());
  const [addOns, setAddOns] = useState(getPackageAddOns());
  const { confirm, confirmDialog } = useConfirm();

  // ── Package form state ────────────────────────────────────────────────────
  const [pkgForm, setPkgForm] = useState({
    id: '' as string,
    name: '',
    description: '',
    durationType: 'single-day' as WeddingPackageDuration,
    nonPeak: '',
    peak: '',
    premier: '',
    maxGuests: '200',
    maxOvernightGuests: '0',
    lodgingIncluded: false,
    includedLodgingVenueIds: [] as string[],
    includedItems: [] as string[],
    active: true,
  });

  const startNewPkg = () => {
    setPkgForm({ id: '', name: '', description: '', durationType: 'single-day', nonPeak: '', peak: '', premier: '', maxGuests: '200', maxOvernightGuests: '0', lodgingIncluded: false, includedLodgingVenueIds: [], includedItems: [], active: true });
  };
  const startEditPkg = (p: WeddingPackage) => {
    setPkgForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      durationType: p.durationType,
      nonPeak: String(p.price.nonPeak || ''),
      peak: String(p.price.peak || ''),
      premier: String(p.price.premier || ''),
      maxGuests: String(p.maxGuests),
      maxOvernightGuests: String(p.maxOvernightGuests),
      lodgingIncluded: p.lodgingIncluded,
      includedLodgingVenueIds: p.includedLodgingVenueIds || [],
      includedItems: p.includedItems || [],
      active: p.active,
    });
  };
  const toggleInclude = (id: string) => {
    setPkgForm((f) => ({
      ...f,
      includedItems: f.includedItems.includes(id) ? f.includedItems.filter((x) => x !== id) : [...f.includedItems, id],
    }));
  };
  const savePkg = () => {
    if (!pkgForm.name.trim()) { onShowSuccess('Enter a package name.'); return; }
    // Guard numeric fields against NaN / negatives / empty→0 so a package can't
    // end up "unlimited" (0 guests) or with invalid pricing by accident.
    const num = (v: string, fallback = 0) => {
      const n = Number(v.trim());
      return Number.isNaN(n) || n < 0 ? fallback : n;
    };
    const price: WeddingSeasonPrice = {
      nonPeak: num(pkgForm.nonPeak),
      peak: num(pkgForm.peak),
      premier: num(pkgForm.premier),
    };
    const maxGuests = Math.round(num(pkgForm.maxGuests));
    const maxOvernightGuests = Math.round(num(pkgForm.maxOvernightGuests));
    if (maxGuests <= 0) { onShowSuccess('Enter a guest limit greater than 0.'); return; }
    saveWeddingPackage({
      id: pkgForm.id || undefined,
      name: pkgForm.name,
      description: pkgForm.description,
      durationType: pkgForm.durationType,
      price,
      maxGuests,
      maxOvernightGuests,
      lodgingIncluded: pkgForm.lodgingIncluded,
      includedLodgingVenueIds: pkgForm.includedLodgingVenueIds,
      includedItems: pkgForm.includedItems,
      active: pkgForm.active,
    });
    setPackages(getWeddingPackages());
    startNewPkg();
    onShowSuccess('Package saved.');
  };
  const removePkg = async (id: string) => {
    const ok = await confirm({ title: 'Delete package?', message: 'This package will be permanently removed.', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    deleteWeddingPackage(id);
    setPackages(getWeddingPackages());
    onShowSuccess('Package deleted.');
  };

  // ── Add-on form state ─────────────────────────────────────────────────────
  const [aoForm, setAoForm] = useState({
    id: '' as string,
    name: '',
    category: 'service' as PackageAddOnCategory,
    price: '',
    priceNote: '',
    description: '',
    venueVendorId: '' as string,
    active: true,
  });
  const startNewAo = () => setAoForm({ id: '', name: '', category: 'service', price: '', priceNote: '', description: '', venueVendorId: '', active: true });
  const saveAo = () => {
    if (!aoForm.name.trim()) { onShowSuccess('Enter an add-on name.'); return; }
    savePackageAddOn({
      id: aoForm.id || undefined,
      name: aoForm.name,
      category: aoForm.category,
      price: (() => { const n = Number((aoForm.price || '').trim()); return Number.isNaN(n) || n < 0 ? 0 : n; })(),
      priceNote: aoForm.priceNote,
      description: aoForm.description,
      venueVendorId: aoForm.venueVendorId || undefined,
      active: aoForm.active,
    });
    setAddOns(getPackageAddOns());
    startNewAo();
    onShowSuccess('Add-on saved.');
  };
  const removeAo = async (id: string) => {
    const ok = await confirm({ title: 'Delete add-on?', message: 'This add-on will be permanently removed.', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    deletePackageAddOn(id);
    setAddOns(getPackageAddOns());
    onShowSuccess('Add-on deleted.');
  };

  const money = (n: number) => (n ? `$${n.toLocaleString()}` : '$0');

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-[#4A1942] to-purple-600 p-4 text-white">
        <h2 className="text-base font-bold">🎁 Wedding Packages & Add-ons</h2>
        <p className="text-xs text-white/80 mt-1">
          Configure the packages you sell (single-day, multi-day, full weekend) with season
          pricing, guest/lodging limits, and included items. Couples can add paid add-ons
          (lodging, activities, horse &amp; carriage, etc.) after booking.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSection('packages')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${section === 'packages' ? 'bg-[#4A1942] text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
        >
          📦 Packages
        </button>
        <button
          type="button"
          onClick={() => setSection('addons')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${section === 'addons' ? 'bg-[#4A1942] text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
        >
          ➕ Add-ons
        </button>
      </div>

      {section === 'packages' && (
        <>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{pkgForm.id ? 'Edit package' : 'New package'}</h3>
              <button type="button" onClick={startNewPkg} className="text-xs text-[#4A1942] hover:underline">New</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} placeholder="Package name" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Package name" />
              <select value={pkgForm.durationType} onChange={(e) => setPkgForm({ ...pkgForm, durationType: e.target.value as WeddingPackageDuration })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Package duration">
                {PACKAGE_DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <textarea value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} placeholder="Description" className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:col-span-2" rows={2} aria-label="Package description" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs text-gray-600">
                Non-Peak $
                <input type="number" value={pkgForm.nonPeak} onChange={(e) => setPkgForm({ ...pkgForm, nonPeak: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Non-peak price" />
              </label>
              <label className="text-xs text-gray-600">
                Peak $
                <input type="number" value={pkgForm.peak} onChange={(e) => setPkgForm({ ...pkgForm, peak: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Peak price" />
              </label>
              <label className="text-xs text-gray-600">
                Premier $
                <input type="number" value={pkgForm.premier} onChange={(e) => setPkgForm({ ...pkgForm, premier: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Premier price" />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-xs text-gray-600">
                Included guests
                <input type="number" value={pkgForm.maxGuests} onChange={(e) => setPkgForm({ ...pkgForm, maxGuests: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Included guests" />
              </label>
              <label className="text-xs text-gray-600">
                Overnight guests included
                <input type="number" value={pkgForm.maxOvernightGuests} onChange={(e) => setPkgForm({ ...pkgForm, maxOvernightGuests: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Overnight guests" />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={pkgForm.lodgingIncluded} onChange={(e) => setPkgForm({ ...pkgForm, lodgingIncluded: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
              On-site lodging included with this package
            </label>
            {pkgForm.lodgingIncluded && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Lodging properties included</div>
                <div className="flex flex-wrap gap-2">
                  {venues.filter((v) => v.category === 'lodging').map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPkgForm((f) => ({
                        ...f,
                        includedLodgingVenueIds: f.includedLodgingVenueIds.includes(v.id) ? f.includedLodgingVenueIds.filter((x) => x !== v.id) : [...f.includedLodgingVenueIds, v.id],
                      }))}
                      className={`px-3 py-1.5 rounded-full border text-sm ${pkgForm.includedLodgingVenueIds.includes(v.id) ? 'border-[#4A1942] bg-[#4A1942]/10 text-[#4A1942]' : 'border-gray-300 text-gray-600'}`}
                    >
                      {v.name}
                    </button>
                  ))}
                  {venues.filter((v) => v.category === 'lodging').length === 0 && (
                    <span className="text-xs text-gray-400">No lodging venues exist yet.</span>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-600 mb-1">Included items</div>
              <div className="flex flex-wrap gap-2">
                {INCLUDED_ITEMS.map((it) => (
                  <button key={it.id} type="button" onClick={() => toggleInclude(it.id)} className={`px-3 py-1.5 rounded-full border text-xs ${pkgForm.includedItems.includes(it.id) ? 'border-[#4A1942] bg-[#4A1942]/10 text-[#4A1942]' : 'border-gray-300 text-gray-600'}`}>
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={pkgForm.active} onChange={(e) => setPkgForm({ ...pkgForm, active: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
              Active (available to book)
            </label>
            <button type="button" onClick={savePkg} className="px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]">
              💾 Save Package
            </button>
          </div>

          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">Packages ({packages.length})</h3>
            <div className="space-y-2">
              {packages.length === 0 ? <p className="text-xs text-gray-400">No packages yet.</p> : (
                packages.map((p) => (
                  <div key={p.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${p.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{p.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#4A1942]/10 text-[#4A1942]">{PACKAGE_DURATIONS.find((d) => d.id === p.durationType)?.label}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {money(p.price.nonPeak)} / {money(p.price.peak)} / {money(p.price.premier)} (NP/P/PR) · {p.maxGuests} guests
                          {p.maxOvernightGuests > 0 ? ` · ${p.maxOvernightGuests} overnight` : ''}
                          {p.lodgingIncluded ? ' · 🛏️ lodging incl.' : ''}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1">
                          {p.includedItems.slice(0, 5).map((id) => <span key={id} className="bg-gray-100 rounded px-1.5 py-0.5">{INCLUDED_ITEMS.find((x) => x.id === id)?.label || id}</span>)}
                          {p.includedItems.length > 5 && <span className="text-gray-400">+{p.includedItems.length - 5}</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Suggested setup: {suggestSetupTaskTitles(p).length} task(s)
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => startEditPkg(p)} className="text-xs text-gray-600 hover:underline">Edit</button>
                        <button type="button" onClick={() => removePkg(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {section === 'addons' && (
        <>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">{aoForm.id ? 'Edit add-on' : 'New add-on'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={aoForm.name} onChange={(e) => setAoForm({ ...aoForm, name: e.target.value })} placeholder="Add-on name (e.g. Horse & Carriage)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Add-on name" />
              <select value={aoForm.category} onChange={(e) => setAoForm({ ...aoForm, category: e.target.value as PackageAddOnCategory })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Add-on category">
                {ADD_ON_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <label className="text-xs text-gray-600">
                Price $
                <input type="number" value={aoForm.price} onChange={(e) => setAoForm({ ...aoForm, price: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Add-on price" />
              </label>
              <input type="text" value={aoForm.priceNote} onChange={(e) => setAoForm({ ...aoForm, priceNote: e.target.value })} placeholder="Pricing note (e.g. per hour, max 2 hours)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Add-on price note" />
              <input type="text" value={aoForm.description} onChange={(e) => setAoForm({ ...aoForm, description: e.target.value })} placeholder="Description" className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:col-span-2" aria-label="Add-on description" />
              {aoForm.category === 'lodging' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Lodging property</label>
                  <select value={aoForm.venueVendorId} onChange={(e) => setAoForm({ ...aoForm, venueVendorId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Lodging property">
                    <option value="">General lodging (not tied to a property)</option>
                    {venues.filter((v) => v.category === 'lodging').map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={aoForm.active} onChange={(e) => setAoForm({ ...aoForm, active: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
              Active
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={saveAo} className="px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]">💾 Save Add-on</button>
              <button type="button" onClick={startNewAo} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">New</button>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">Add-ons ({addOns.length})</h3>
            <div className="space-y-2">
              {addOns.length === 0 ? <p className="text-xs text-gray-400">No add-ons yet.</p> : (
                addOns.map((a) => (
                  <div key={a.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${a.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{a.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{ADD_ON_CATEGORIES.find((c) => c.id === a.category)?.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ${a.price.toLocaleString()}{a.priceNote ? ` · ${a.priceNote}` : ''}
                        {a.description ? ` · ${a.description}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => setAoForm({ id: a.id, name: a.name, category: a.category, price: String(a.price), priceNote: a.priceNote || '', description: a.description || '', venueVendorId: a.venueVendorId || '', active: a.active })} className="text-xs text-gray-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => removeAo(a.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  );
}
