-- VEXORA: speed up unread-message count queries under concurrent traffic.
CREATE INDEX IF NOT EXISTS messages_unread_receiver_idx
  ON public.messages (receiver_id)
  WHERE is_read = false;
