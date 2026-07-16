-- Add Razorpay tracking columns to payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
