'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Prices } from '@/components/Prices';
import { dictionary } from '@/shared/i18n';
import { formatDate, formatWarrantyDate } from '@/shared/format';
import type { Locale } from '@/shared/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  orderSelected,
  productTypeChanged,
  refreshInventory,
  selectOrders,
  selectOrdersById,
  selectProducts,
  selectProductTypes,
  selectVisibleProducts,
} from '@/store/store';
import { ProductForm } from './ProductForm';

export function ProductsPage({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const dispatch = useAppDispatch();
  const products = useAppSelector(selectProducts);
  const visible = useAppSelector(selectVisibleProducts);
  const types = useAppSelector(selectProductTypes);
  const type = useAppSelector((state) => state.ui.productType);
  const orders = useAppSelector(selectOrders);
  const ordersById = useAppSelector(selectOrdersById);
  const [adding, setAdding] = useState(false);
  return (
    <section className="route-view">
      <div className="page-heading page-heading--products">
        <h1>
          {t.products} <span>/ {products.length}</span>
        </h1>
        <div className="product-filter">
          <label htmlFor="product-type">{t.type}</label>
          <select
            id="product-type"
            value={type}
            onChange={(event) => dispatch(productTypeChanged(event.target.value))}
          >
            <option value="">{t.allTypes}</option>
            {types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <button
          className="button button--small"
          type="button"
          disabled={!orders.length}
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={16} />
          {t.addProduct}
        </button>
      </div>
      {!visible.length && (
        <div className="empty-state">
          <Icon name="box" size={36} />
          <h2>{t.noProducts}</h2>
          <p>{t.emptyHint}</p>
          {type && (
            <button
              type="button"
              className="text-button"
              onClick={() => dispatch(productTypeChanged(''))}
            >
              {t.allTypes}
            </button>
          )}
        </div>
      )}
      <div
        className="products-scroll"
        tabIndex={visible.length ? 0 : undefined}
        aria-label={t.products}
      >
        <div className="products-list">
          {visible.map((product) => {
            const order = ordersById.get(product.orderId);
            return (
              <article className="product-row" key={product.id}>
                <span className="status-dot" aria-hidden="true" />
                <Image
                  className="product-row__image"
                  src={product.photo}
                  alt=""
                  width={60}
                  height={44}
                  unoptimized
                />
                <div className="product-row__identity">
                  <h2>{product.title}</h2>
                  <small>SN-{product.serialNumber}</small>
                </div>
                <div className="product-row__type">
                  <span className="mobile-label">{t.type}</span>
                  {product.type}
                  <small>{product.isNew ? t.new : t.used}</small>
                </div>
                <div className="product-row__warranty">
                  <span className="mobile-label">{t.warranty}</span>
                  <span>
                    <small>{t.from}</small>
                    <time dateTime={product.warrantyStart}>
                      {formatDate(product.warrantyStart, locale)}
                    </time>
                  </span>
                  <span>
                    <small>{t.to}</small>
                    <time dateTime={product.warrantyEnd}>
                      {formatWarrantyDate(product.warrantyEnd, locale)}
                    </time>
                  </span>
                </div>
                <div className="product-row__prices">
                  <span className="mobile-label">{t.price}</span>
                  <Prices prices={product.prices} locale={locale} />
                </div>
                <div className="product-row__order">
                  <span className="mobile-label">{t.order}</span>
                  <Link
                    href={`/${locale}/orders`}
                    onClick={() => dispatch(orderSelected(product.orderId))}
                  >
                    {order?.title ?? '—'}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {adding && (
        <ProductForm
          locale={locale}
          orders={orders}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void dispatch(refreshInventory());
          }}
        />
      )}
    </section>
  );
}
