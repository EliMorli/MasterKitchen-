-- Invoices grow real line rows (description + amount each). Stored as jsonb —
-- the invoice stays one row, `amount` remains the authoritative total. Feeds
-- both the from-scratch editor (add rows as needed) and the PDF import that
-- brings existing invoices over from the old system.
alter table invoice add column if not exists line_items jsonb not null default '[]'::jsonb;
