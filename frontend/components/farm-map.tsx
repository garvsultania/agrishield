'use client';

import * as React from 'react';
import type { Farm, FarmStatusResponse } from '@/lib/types';

interface FarmMapProps {
  farms: Farm[];
  farmStatuses: Record<string, FarmStatusResponse | undefined>;
  selectedFarmId: string | null;
  onFarmSelect: (farmId: string) => void;
}

/**
 * FarmMap — Leaflet + ESRI World Imagery satellite tiles.
 * Fly-to-on-select, keyboard-focusable container, accessible legend (see caller).
 */
export default function FarmMap({
  farms,
  farmStatuses,
  selectedFarmId,
  onFarmSelect,
}: FarmMapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const layersRef = React.useRef<Record<string, any>>({});
  const labelsRef = React.useRef<Record<string, any>>({});
  const lastSelectedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [27.5706, 80.6822],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
        keyboard: true,
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, Maxar, USDA, USGS, GeoEye, GIS User Community',
          maxZoom: 19,
        }
      ).addTo(map);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Labels &copy; Esri',
          maxZoom: 19,
          opacity: 0.7,
        }
      ).addTo(map);

      // Add a 1 km scalebar
      L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

      mapRef.current = map;
    }

    const map = mapRef.current;

    // Reset polygons + labels
    Object.values(layersRef.current).forEach((layer: any) => {
      try {
        map.removeLayer(layer);
      } catch {
        /* ignore */
      }
    });
    Object.values(labelsRef.current).forEach((layer: any) => {
      try {
        map.removeLayer(layer);
      } catch {
        /* ignore */
      }
    });
    layersRef.current = {};
    labelsRef.current = {};

    farms.forEach((farm) => {
      const farmStatus = farmStatuses[farm.farmId];
      const isDrought = farmStatus?.status === 'drought';
      const isSelected = farm.farmId === selectedFarmId;

      const fillColor = isDrought ? '#ef4444' : '#84cc16';
      const strokeColor = isDrought ? '#fecaca' : '#ecfccb';
      const fillOpacity = isSelected ? 0.65 : 0.42;
      const weight = isSelected ? 3 : 2;

      const polygon = L.polygon(
        farm.polygon.map(([lat, lng]) => [lat, lng]),
        {
          color: strokeColor,
          fillColor,
          fillOpacity,
          weight,
          dashArray: isSelected ? null : '5, 3',
          interactive: true,
        }
      );

      const ndviDisplay =
        farmStatus?.ndvi !== undefined ? farmStatus.ndvi.toFixed(3) : '—';
      const rainDisplay =
        farmStatus?.rainfall_mm !== undefined
          ? `${farmStatus.rainfall_mm}mm`
          : '—';
      const statusLabel = farmStatus
        ? isDrought
          ? 'DROUGHT'
          : 'Healthy'
        : 'Loading';
      const statusColor = isDrought ? '#ef4444' : '#84cc16';

      polygon.bindTooltip(
        `<div style="font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: var(--tooltip-bg); border: 1px solid var(--tooltip-border); border-radius: 10px; padding: 10px 12px; color: var(--tooltip-text); box-shadow: 0 12px 32px rgba(0,0,0,0.35);">
          <div style="font-weight: 700; font-size: 12px; letter-spacing: 0.05em; margin-bottom: 3px;">${farm.farmId}</div>
          <div style="color: var(--tooltip-muted);">${farm.farmerName}</div>
          <div style="color: var(--tooltip-muted);">${farm.cropType?.toUpperCase()} · ${farm.areaSqKm} km²</div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--tooltip-border);">
            <span style="color: ${statusColor}; font-weight: 700; letter-spacing: 0.08em;">${statusLabel}</span>
          </div>
          <div style="margin-top: 2px;">NDVI <span style="color: var(--tooltip-text);">${ndviDisplay}</span> · Rain <span style="color: var(--tooltip-text);">${rainDisplay}</span></div>
        </div>`,
        { permanent: false, sticky: true, className: 'agri-tooltip', direction: 'top' }
      );

      polygon.on('click', () => onFarmSelect(farm.farmId));
      polygon.on('keypress', (e: any) => {
        if (e?.originalEvent?.key === 'Enter' || e?.originalEvent?.key === ' ') {
          onFarmSelect(farm.farmId);
        }
      });

      polygon.addTo(map);
      layersRef.current[farm.farmId] = polygon;

      // Persistent farm-ID label at the polygon centroid
      const center = polygon.getBounds().getCenter();
      const idSuffix = farm.farmId.replace('SITAPUR_', '');
      const labelMarker = L.marker(center, {
        icon: L.divIcon({
          className: '',
          html: `<div style="background: rgba(0,0,0,0.5); color: white; padding: 2px 6px; border-radius: 999px; font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; white-space: nowrap; border: 1px solid rgba(255,255,255,0.3); transform: translate(-50%, -50%);">${idSuffix}</div>`,
          iconSize: [0, 0],
        }),
        interactive: false,
        keyboard: false,
      });
      labelMarker.addTo(map);
      labelsRef.current[farm.farmId] = labelMarker;
    });
  }, [farms, farmStatuses, selectedFarmId, onFarmSelect]);

  // Fly-to when selectedFarmId changes
  React.useEffect(() => {
    if (!mapRef.current || !selectedFarmId) return;
    if (lastSelectedRef.current === selectedFarmId) return;
    const farm = farms.find((f) => f.farmId === selectedFarmId);
    if (!farm) return;
    const L = require('leaflet');
    const bounds = L.latLngBounds(farm.polygon.map(([lat, lng]) => [lat, lng]));
    mapRef.current.flyToBounds(bounds, { duration: 0.6, padding: [80, 80], maxZoom: 16 });
    lastSelectedRef.current = selectedFarmId;
  }, [selectedFarmId, farms]);

  React.useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Interactive satellite map of Sitapur farms"
      tabIndex={0}
      className="h-full w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    />
  );
}
