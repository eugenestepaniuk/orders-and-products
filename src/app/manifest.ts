import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Inventory — Orders & Products',
    short_name: 'Inventory',
    description: 'Orders, products and warranty records.',
    start_url: '/ru/orders',
    scope: '/',
    display: 'standalone',
    background_color: '#f1f4f5',
    theme_color: '#85bc45',
    icons: [
      { src: '/icons/inventory-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/inventory-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/inventory.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
