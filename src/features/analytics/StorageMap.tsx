'use client';

import { useEffect, useRef, useState } from 'react';
import { dictionary } from '@/shared/i18n';
import type { Locale } from '@/shared/types';
import 'leaflet/dist/leaflet.css';

export default function StorageMap({ locale }: { locale: Locale }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const t = dictionary(locale);
  useEffect(() => {
    let disposed = false;
    let remove: (() => void) | undefined;
    void import('leaflet')
      .then((L) => {
        if (disposed || !ref.current) return;
        const map = L.map(ref.current).setView([50.45, 30.52], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);
        L.circleMarker([50.45, 30.52], {
          color: '#4c7d24',
          fillColor: '#85bc45',
          fillOpacity: 0.8,
          radius: 9,
        })
          .addTo(map)
          .bindTooltip('A');
        L.circleMarker([50.43, 30.49], {
          color: '#4c7d24',
          fillColor: '#85bc45',
          fillOpacity: 0.8,
          radius: 9,
        })
          .addTo(map)
          .bindTooltip('B');
        remove = () => map.remove();
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      remove?.();
    };
  }, []);
  return (
    <>
      {failed && <p role="alert">{t.mapUnavailable}</p>}
      <div className="map" ref={ref} role="region" aria-label={t.locations} />
    </>
  );
}
