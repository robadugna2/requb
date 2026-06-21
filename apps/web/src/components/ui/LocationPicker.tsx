'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { Button } from './button';

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: { address: string; latitude: number; longitude: number }) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  initialAddress?: string;
}

const loadLeaflet = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as any).L) {
      resolve();
      return;
    }
    // Load CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      document.body.appendChild(script);
    } else {
      // Script is already in body but not yet loaded
      const checkInterval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    }
  });
};

export default function LocationPicker({
  isOpen,
  onClose,
  onConfirm,
  initialLatitude,
  initialLongitude,
  initialAddress = '',
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [address, setAddress] = useState(initialAddress);
  const [coords, setCoords] = useState({
    lat: initialLatitude || 8.9806, // default to Addis Ababa
    lng: initialLongitude || 38.7578,
  });

  useEffect(() => {
    if (initialAddress) setAddress(initialAddress);
    if (initialLatitude && initialLongitude) {
      setCoords({ lat: initialLatitude, lng: initialLongitude });
    }
  }, [initialAddress, initialLatitude, initialLongitude, isOpen]);

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    let isSubscribed = true;

    loadLeaflet().then(() => {
      if (!isSubscribed) return;
      const L = (window as any).L;
      if (!L) return;

      const lat = coords.lat;
      const lng = coords.lng;

      if (leafletMap.current) {
        leafletMap.current.remove();
      }

      // Initialize Map
      const map = L.map(mapRef.current).setView([lat, lng], 13);
      leafletMap.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Initialize Marker
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current = marker;

      // Event: Map click
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        setCoords({ lat: clickLat, lng: clickLng });
        reverseGeocode(clickLat, clickLng);
      });

      // Event: Marker drag
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        setCoords({ lat: position.lat, lng: position.lng });
        reverseGeocode(position.lat, position.lng);
      });
    });

    return () => {
      isSubscribed = false;
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [isOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const displayName = data[0].display_name;

        setCoords({ lat, lng: lon });
        setAddress(displayName);

        if (leafletMap.current && markerRef.current) {
          leafletMap.current.setView([lat, lon], 15);
          markerRef.current.setLatLng([lat, lon]);
        }
      } else {
        alert('Location not found. Please try another query.');
      }
    } catch (err) {
      console.error('Geocoding search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      address: address || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
      latitude: coords.lat,
      longitude: coords.lng,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl flex flex-col shadow-xl overflow-hidden h-[90vh] max-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary-600" />
            Pick Physical Location
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="p-4 border-b border-gray-100 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search location (e.g. Bole Medhanialem, Addis Ababa)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
          <Button type="submit" loading={searching} variant="secondary">
            Search
          </Button>
        </form>

        {/* Map Area */}
        <div className="flex-1 bg-gray-50 relative">
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: '300px' }} />
        </div>

        {/* Selected Address Display & Confirmation */}
        <div className="p-6 border-t border-gray-150 bg-gray-50">
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Selected Address
            </p>
            <p className="text-sm font-medium text-gray-800 line-clamp-2">
              {address || 'Click map or search above to select address'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Coords: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!address}>
              Confirm Location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
