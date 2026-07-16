-- Migration: Add notifications table + missing payment columns
-- These are auto-created by the server on startup, but you can also run this manually.

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    type VARCHAR(50),
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Missing columns on payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Missing column on queries
ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS message TEXT;
