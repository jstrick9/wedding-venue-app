import { useState, useCallback, useEffect } from 'react';
import { Vendor } from '../types/vendor';
import { STORAGE_KEYS } from '../constants/storageKeys';

const VENDORS_KEY = STORAGE_KEYS.VENDORS;

function loadVendors(): Vendor[] {
  try {
    const raw = localStorage.getItem(VENDORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVendors(vendors: Vendor[]): void {
  localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
}

/** Synchronous read of the venue's vendor list (read-only reference in the couples portal). */
export function getVenueVendors(): Vendor[] {
  try {
    const raw = localStorage.getItem(VENDORS_KEY);
    return raw ? (JSON.parse(raw) as Vendor[]) : [];
  } catch {
    return [];
  }
}

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>(() => loadVendors());

  useEffect(() => {
    saveVendors(vendors);
  }, [vendors]);

  const addVendor = useCallback((vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Vendor => {
    const newVendor: Vendor = {
      ...vendor,
      id: `vendor-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setVendors(prev => [...prev, newVendor]);
    return newVendor;
  }, []);

  const updateVendor = useCallback((id: string, updates: Partial<Vendor>) => {
    setVendors(prev => prev.map(v =>
      v.id === id ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v
    ));
  }, []);

  const deleteVendor = useCallback((id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
  }, []);

  const getVendorsByCategory = useCallback((category: string): Vendor[] => {
    return vendors.filter(v => v.category === category);
  }, [vendors]);

  return {
    vendors,
    addVendor,
    updateVendor,
    deleteVendor,
    getVendorsByCategory,
  };
}
