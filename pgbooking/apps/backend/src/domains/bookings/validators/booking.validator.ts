import { z } from 'zod';

export const InitiateBookingSchema = z.object({
  bed_id: z.string().uuid('Invalid bed ID'),
  intended_check_in: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d: string) => new Date(d) >= new Date(new Date().toDateString()), {
      message: 'Check-in date must be today or in the future',
    }),
  idempotency_key: z.string().max(100).optional(),
});

export const CancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export const BookingIdParamSchema = z.object({
  id: z.string().uuid('Invalid booking ID'),
});

export const CheckoutBookingSchema = z.object({
  actual_check_out_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  checkout_notes: z.string().trim().max(500).optional(),
});

export type InitiateBookingDto = z.infer<typeof InitiateBookingSchema>;
export type CancelBookingDto  = z.infer<typeof CancelBookingSchema>;
