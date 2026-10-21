import { z } from 'zod';

const title = z.string().trim().min(1).max(160);
const date = z.iso
  .date()
  .refine((value) => value >= '1000-01-01', { message: 'Date is outside the supported range.' });
const amount = z.number().int().min(0).max(100_000_000_000);

export const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(60),
    password: z.string().min(1).max(128),
  })
  .strict();

export const orderInputSchema = z
  .object({
    title,
    description: z.string().trim().max(1000),
    date,
  })
  .strict();

export const productInputSchema = z
  .object({
    orderId: z.number().int().positive().max(4_294_967_295),
    title,
    type: z.string().trim().min(1).max(60),
    serialNumber: z.string().trim().min(1).max(80),
    isNew: z.boolean(),
    warrantyStart: date,
    warrantyEnd: date,
    usdMinor: amount,
    uahMinor: amount,
  })
  .strict()
  .refine((value) => value.warrantyEnd >= value.warrantyStart, {
    path: ['warrantyEnd'],
    message: 'Warranty end must not precede its start.',
  });

const priceSchema = z.object({
  currency: z.enum(['USD', 'UAH']),
  amountMinor: amount,
});

export const inventorySchema = z.object({
  orders: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string(),
      description: z.string(),
      createdAt: z.string(),
    }),
  ),
  products: z.array(
    z.object({
      id: z.number().int().positive(),
      orderId: z.number().int().positive(),
      title: z.string(),
      type: z.string(),
      serialNumber: z.string(),
      isNew: z.boolean(),
      photo: z.string(),
      warrantyStart: date,
      warrantyEnd: date,
      createdAt: z.string(),
      prices: z.array(priceSchema),
    }),
  ),
});

export type OrderInput = z.infer<typeof orderInputSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
