'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { dictionary } from '@/shared/i18n';
import { requestJson } from '@/shared/api';
import { formatMoney } from '@/shared/format';
import type { Currency, Locale } from '@/shared/types';
import { useAppSelector } from '@/store/hooks';
import { selectInventory } from '@/store/store';

const ProductChart = dynamic(() => import('./ProductChart'), { ssr: false });
const StorageMap = dynamic(() => import('./StorageMap'), { ssr: false });
type Summary = {
  orderCount: number;
  productCount: number;
  totals: { currency: Currency; amountMinor: number }[];
};

export function AnalyticsPage({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const inventory = useAppSelector(selectInventory);
  const [result, setResult] = useState<{ source: typeof inventory; summary: Summary } | null>(null);
  const [failed, setFailed] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ data?: { summary: Summary }; errors?: unknown[] }>('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        query: '{ summary { orderCount productCount totals { currency amountMinor } } }',
      }),
    })
      .then((body) => {
        if (!body.data?.summary || body.errors?.length) throw new Error('Invalid summary response');
        setResult({ source: inventory, summary: body.data.summary });
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) setFailed(true);
      });
    return () => controller.abort();
  }, [inventory, retry]);
  const summary = result?.source === inventory ? result.summary : null;
  return (
    <section className="route-view">
      <div className="analytics-heading">
        <h1>{t.analyticsTitle}</h1>
        <p>{t.analyticsHint}</p>
      </div>
      <div className="analytics-grid">
        <section className="analytics-card">
          <h2>{t.chartTitle}</h2>
          <ProductChart locale={locale} />
        </section>
        <section className="analytics-card">
          <h2>{t.graphqlTitle}</h2>
          {failed ? (
            <div role="alert">
              <p>{t.graphqlUnavailable}</p>
              <button className="button button--secondary" onClick={() => setRetry(retry + 1)}>
                {t.retry}
              </button>
            </div>
          ) : summary ? (
            <>
              <div className="analytics-card__totals">
                <div className="analytics-card__metric">
                  <strong>{summary.orderCount}</strong>
                  <span>{t.orders}</span>
                </div>
                <div className="analytics-card__metric">
                  <strong>{summary.productCount}</strong>
                  <span>{t.products}</span>
                </div>
              </div>
              <div className="analytics-card__money">
                {summary.totals.map((total) => (
                  <span key={total.currency}>
                    {formatMoney(total.amountMinor, total.currency, locale)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p role="status">{t.loading}</p>
          )}
        </section>
        <section className="analytics-card analytics-card--wide">
          <h2>{t.locations}</h2>
          <p className="map-note">{t.mapHint}</p>
          {showMap ? (
            <StorageMap locale={locale} />
          ) : (
            <div className="map-placeholder">
              <button className="button button--secondary" onClick={() => setShowMap(true)}>
                {t.openMap}
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
