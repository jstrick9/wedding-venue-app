import { useEffect, useId, useRef, useState } from 'react';
import { autocompleteVenueAddress } from '../services/platform/geocodingService';
import { suggestionLabel, type StandardizedAddress } from '../utils/geoapifyAddress';
import { withTimeout } from '../utils/withTimeout';
import { describeUnknownError } from '../utils/unknownError';

export interface AddressValue {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
}

interface AddressAutocompleteProps {
  value: AddressValue;
  onChange: (next: AddressValue, picked?: StandardizedAddress) => void;
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  disabled?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  verified,
  onVerifiedChange,
  disabled,
}: AddressAutocompleteProps) {
  const listId = useId();
  const [query, setQuery] = useState(value.addressLine1);
  const [suggestions, setSuggestions] = useState<StandardizedAddress[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (verified) setQuery(value.addressLine1);
  }, [verified, value.addressLine1]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const search = (text: string) => {
    setQuery(text);
    onVerifiedChange(false);
    onChange({ ...value, addressLine1: text }, undefined);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setLookupError('');
      void withTimeout(
        autocompleteVenueAddress(text),
        15000,
        'Looking up addresses timed out. Check your connection and try again.',
      )
        .then((results) => {
          setSuggestions(results);
          setOpen(true);
          setActiveIndex(results.length ? 0 : -1);
        })
        .catch((error: unknown) => {
          setSuggestions([]);
          setLookupError(describeUnknownError(error, 'Could not look up addresses. Check your connection and try again.'));
          setOpen(false);
        })
        .finally(() => setLoading(false));
    }, 250);
  };

  const select = (suggestion: StandardizedAddress) => {
    if (!suggestion.verified) {
      setLookupError('Choose a complete street address (house number, city, state, and ZIP).');
      return;
    }
    onChange({
      addressLine1: suggestion.addressLine1,
      addressLine2: value.addressLine2 || '',
      city: suggestion.city,
      stateRegion: suggestion.stateRegion,
      postalCode: suggestion.postalCode,
      country: 'US',
    }, suggestion);
    onVerifiedChange(true);
    setQuery(suggestion.addressLine1);
    setSuggestions([]);
    setOpen(false);
    setLookupError('');
  };

  return (
    <div className="space-y-3 md:col-span-2">
      {verified ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-900">Verified street address</p>
              <p className="mt-1 text-sm text-emerald-950">{value.addressLine1}</p>
              <p className="text-xs text-emerald-800">{[value.city, value.stateRegion, value.postalCode].filter(Boolean).join(', ')}</p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onVerifiedChange(false);
                setQuery(value.addressLine1);
              }}
              className="shrink-0 text-xs font-semibold text-emerald-800 underline"
            >
              Change address
            </button>
          </div>
        </div>
      ) : (
        <label className="block text-xs font-semibold text-gray-700">
          Street address *
          <input
            value={query}
            disabled={disabled}
            onChange={(event) => search(event.target.value)}
            onKeyDown={(event) => {
              if (!open || suggestions.length === 0) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % suggestions.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
              } else if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                select(suggestions[activeIndex]);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Start typing a US street address…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      )}
      {open && (
        <ul id={listId} role="listbox" className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.placeId}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => select(suggestion)}
                className={`block w-full px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              >
                <span className="font-medium text-gray-900">{suggestionLabel(suggestion)}</span>
                {!suggestion.verified && <span className="ml-2 text-[11px] text-amber-700">Incomplete</span>}
              </button>
            </li>
          ))}
          {suggestions.length === 0 && !loading && (
            <li className="px-3 py-2 text-xs text-gray-500">No matching US street addresses.</li>
          )}
        </ul>
      )}
      {loading && <p className="text-[11px] text-gray-500">Looking up addresses…</p>}
      {lookupError && <p role="alert" className="text-xs text-red-700">{lookupError}</p>}
      <label className="block text-xs font-semibold text-gray-700">
        Address line 2
        <input
          value={value.addressLine2 || ''}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, addressLine2: event.target.value })}
          placeholder="Suite, unit, building (optional)"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs font-semibold text-gray-700">City *<input value={value.city} readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-gray-700">State *<input value={value.stateRegion} readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-gray-700">ZIP *<input value={value.postalCode} readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" /></label>
      </div>
      <p className="text-[11px] text-gray-500">
        City, state, and ZIP fill from the selected verified street address so they cannot be mistyped. Country is United States.
        {' '}<a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Powered by Geoapify</a>
        {' '}· © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a>
      </p>
    </div>
  );
}
