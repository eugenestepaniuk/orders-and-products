'use client';

import { useEffect, useRef, useState } from 'react';
import { dictionary } from '@/shared/i18n';
import type { Locale } from '@/shared/types';
import { useAppSelector } from '@/store/hooks';
import { selectProducts } from '@/store/store';

type Group = { type: string; count: number };

export default function ProductChart({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const products = useAppSelector(selectProducts);
  const [result, setResult] = useState<{ source: typeof products; groups: Group[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    const requestId = ++revision.current;
    let worker: Worker | undefined;
    try {
      worker = new Worker('/workers/analytics.js', { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ requestId: number; groups: Group[] }>) => {
        if (event.data.requestId === requestId) {
          setResult({ source: products, groups: event.data.groups });
          setFailed(false);
        }
      };
      worker.onerror = () => setFailed(true);
      worker.postMessage({ requestId, products: products.map(({ type }) => ({ type })) });
    } catch {
      queueMicrotask(() => setFailed(true));
    }
    return () => worker?.terminate();
  }, [products]);
  if (failed) return <p role="alert">{t.workerUnavailable}</p>;
  if (!result || result.source !== products) return <p role="status">{t.workerLoading}</p>;
  const groups = result.groups;
  const max = Math.max(1, ...groups.map((group) => group.count));
  return (
    <div>
      <svg
        className="analytics-chart"
        viewBox={`0 0 440 ${Math.max(50, groups.length * 42)}`}
        role="img"
        aria-label={t.chartTitle}
      >
        {groups.map((group, index) => (
          <g key={group.type}>
            <text className="analytics-chart__label" x="0" y={index * 42 + 24}>
              {group.type.slice(0, 16)}
            </text>
            <rect
              className="analytics-chart__bar"
              x="145"
              y={index * 42 + 6}
              width={(group.count / max) * 240}
              height="26"
              rx="2"
            />
            <text className="analytics-chart__label" x="402" y={index * 42 + 24}>
              {group.count}
            </text>
          </g>
        ))}
      </svg>
      <table className="analytics-table">
        <caption className="visually-hidden">{t.chartTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{t.type}</th>
            <th scope="col">{t.count}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.type}>
              <th scope="row">{group.type}</th>
              <td>{group.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
