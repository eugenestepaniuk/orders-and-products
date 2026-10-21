import type { Locale, Price } from '@/shared/types';
import { formatMoney } from '@/shared/format';

export function Prices({ prices, locale }: { prices: Price[]; locale: Locale }) {
  return (
    <span className="prices">
      {(['USD', 'UAH'] as const).map((currency) => {
        const price = prices.find((item) => item.currency === currency);
        return (
          <span key={currency} className={`prices__${currency.toLowerCase()}`}>
            {formatMoney(price?.amountMinor ?? 0, currency, locale)}
          </span>
        );
      })}
    </span>
  );
}
