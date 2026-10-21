'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { Prices } from '@/components/Prices';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  orderSelected,
  refreshInventory,
  selectOrders,
  selectOrderSummaries,
  selectVisibleOrders,
} from '@/store/store';
import { dictionary } from '@/shared/i18n';
import { formatDate } from '@/shared/format';
import { requestJson, RequestError } from '@/shared/api';
import type { ApiCode, Locale } from '@/shared/types';
import { OrderForm } from './OrderForm';
import { ProductForm } from '../products/ProductForm';

export function OrdersPage({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const dispatch = useAppDispatch();
  const orders = useAppSelector(selectOrders);
  const visible = useAppSelector(selectVisibleOrders);
  const summaries = useAppSelector(selectOrderSummaries);
  const selectedId = useAppSelector((state) => state.ui.selectedOrderId);
  const selected = orders.find((order) => order.id === selectedId);
  const selectedProducts = selected ? (summaries.get(selected.id)?.products ?? []) : [];
  const [closingId, setClosingId] = useState<number | null>(null);
  const [addingOrder, setAddingOrder] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<ApiCode | null>(null);
  const target = orders.find((order) => order.id === deleteId);

  useEffect(() => {
    if (closingId === null || closingId !== selectedId) return;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
    const timer = window.setTimeout(() => {
      dispatch(orderSelected(null));
      setClosingId(null);
      document.querySelector<HTMLButtonElement>(`[data-order-id="${closingId}"]`)?.focus();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [closingId, dispatch, selectedId]);

  function saved() {
    setAddingOrder(false);
    setAddingProduct(false);
    void dispatch(refreshInventory());
  }
  async function remove() {
    if (!target || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await requestJson(`/api/orders/${target.id}`, { method: 'DELETE' });
      if (selectedId === target.id) dispatch(orderSelected(null));
      setDeleteId(null);
      void dispatch(refreshInventory());
    } catch (failure) {
      setError(failure instanceof RequestError ? failure.code : 'unavailable');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="route-view">
      <div className="page-heading">
        <button
          className="add-button"
          type="button"
          aria-label={t.addOrder}
          onClick={() => setAddingOrder(true)}
        >
          <Icon name="plus" />
        </button>
        <h1>
          {t.orders} <span>/ {orders.length}</span>
        </h1>
      </div>
      {!visible.length && (
        <div className="empty-state">
          <Icon name="box" size={36} />
          <h2>{t.noOrders}</h2>
          <p>{t.emptyHint}</p>
        </div>
      )}
      <div className={`orders-layout ${selected ? 'orders-layout--expanded' : ''}`}>
        <div className="orders-list" aria-label={t.orders}>
          {visible.map((order) => {
            const summary = summaries.get(order.id)!;
            const items = summary.products;
            return (
              <article
                className={`order-row ${selectedId === order.id ? 'order-row--selected' : ''}`}
                key={order.id}
              >
                <button
                  type="button"
                  className="order-row__open"
                  data-order-id={order.id}
                  onClick={() => {
                    setClosingId(null);
                    dispatch(orderSelected(order.id));
                  }}
                  aria-expanded={selectedId === order.id}
                  aria-controls={selected ? 'order-details' : undefined}
                  aria-label={`${t.selectOrder}: ${order.title}`}
                >
                  <span className="order-row__title">{order.title}</span>
                  <span className="order-row__quantity">
                    <span className="order-row__list-icon">
                      <Icon name="list" size={22} />
                    </span>
                    <span>
                      <strong>{items.length}</strong>
                      <small>{t.quantity}</small>
                    </span>
                  </span>
                  <span className="date-stack">
                    <small>{formatDate(order.createdAt, locale, true)}</small>
                    <time dateTime={order.createdAt}>{formatDate(order.createdAt, locale)}</time>
                  </span>
                  <span className="order-row__totals">
                    <Prices prices={summary.totals} locale={locale} />
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button order-row__delete"
                  aria-label={`${t.delete}: ${order.title}`}
                  onClick={() => {
                    setDeleteId(order.id);
                    setError(null);
                  }}
                >
                  <Icon name="trash" size={17} />
                </button>
                <span className="order-row__arrow" aria-hidden="true">
                  <Icon name="chevron" />
                </span>
              </article>
            );
          })}
        </div>
        {selected && (
          <aside
            className={`order-details ${closingId === selectedId ? 'order-details--closing' : ''}`}
            id="order-details"
            aria-label={t.selectedOrder}
          >
            <button
              className="icon-button order-details__close"
              type="button"
              aria-label={t.close}
              onClick={() => setClosingId(selectedId)}
            >
              <Icon name="close" />
            </button>
            <h2>{selected.title}</h2>
            <button
              type="button"
              className="text-button order-details__add"
              onClick={() => setAddingProduct(true)}
            >
              <span className="mini-plus">
                <Icon name="plus" size={15} />
              </span>
              {t.addProduct}
            </button>
            {selected.description && (
              <p className="order-details__description">{selected.description}</p>
            )}
            <ul className="detail-products">
              {selectedProducts.map((product) => (
                <li className="detail-products__row" key={product.id}>
                  <span className="status-dot" />
                  <Image src={product.photo} width={52} height={38} alt="" unoptimized />
                  <div>
                    <span className="detail-products__name">{product.title}</span>
                    <small>SN-{product.serialNumber}</small>
                  </div>
                  <span className="detail-products__condition">
                    {product.isNew ? t.new : t.used}
                  </span>
                </li>
              ))}
            </ul>
            {!selectedProducts.length && <p className="order-details__empty">{t.noProducts}</p>}
          </aside>
        )}
      </div>
      {addingOrder && (
        <OrderForm locale={locale} onClose={() => setAddingOrder(false)} onSaved={saved} />
      )}
      {addingProduct && (
        <ProductForm
          locale={locale}
          orders={orders}
          orderId={selected?.id}
          onClose={() => setAddingProduct(false)}
          onSaved={saved}
        />
      )}
      {target && (
        <Modal
          title={t.deleteOrder}
          closeLabel={t.close}
          className="dialog--delete"
          onClose={() => {
            if (!deleting) setDeleteId(null);
          }}
        >
          <div className="delete-summary">
            <Icon name="box" size={36} />
            <div>
              <strong>{target.title}</strong>
              <p>{t.deleteHint}</p>
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {t[error]}
            </p>
          )}
          <div className="dialog__actions dialog__actions--green">
            <button
              type="button"
              className="button button--transparent"
              disabled={deleting}
              onClick={() => setDeleteId(null)}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="button button--delete"
              disabled={deleting}
              onClick={() => {
                void remove();
              }}
            >
              <Icon name="trash" size={17} />
              {deleting ? t.deleting : t.delete}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
