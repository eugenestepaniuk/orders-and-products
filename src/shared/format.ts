import type { Currency, Locale, Price, Product } from './types.ts';

const locales = { ru: 'ru-RU', en: 'en-GB' };

export function formatMoney(amountMinor: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(locales[locale], {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatDate(value: string, locale: Locale, compact = false): string {
  const timestamp = value.length === 10 ? `${value}T12:00:00Z` : value;
  return new Intl.DateTimeFormat(locales[locale], {
    day: '2-digit',
    month: compact ? '2-digit' : 'short',
    ...(compact ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(new Date(timestamp));
}

export function sumPrices(products: Pick<Product, 'prices'>[]): Price[] {
  return (['USD', 'UAH'] as const).map((currency) => ({
    currency,
    amountMinor: products.reduce(
      (total, product) =>
        total + (product.prices.find((price) => price.currency === currency)?.amountMinor ?? 0),
      0,
    ),
  }));
}

export function formatWarrantyDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locales[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}
