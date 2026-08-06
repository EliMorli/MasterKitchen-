-- Proof of payment: a photo of the check (or a screenshot of the Zelle) filed
-- with the payment itself, so every received dollar carries its evidence.
-- The file lives in the documents bucket under the job, same as everything.

alter table payment
    add column if not exists proof_path text,   -- storage path in the documents bucket
    add column if not exists proof_name text;   -- original filename, for display
