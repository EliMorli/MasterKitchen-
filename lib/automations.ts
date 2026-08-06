/**
 * The built-in automation catalog. Each entry is something the backend knows
 * how to do; the automation table stores which ones are switched on. Starting
 * set is invoicing — the chase work the owners do by hand today. The ones that
 * send messages fire through the messaging connection (WhatsApp now, Twilio
 * SMS when it's added); until that's connected they stay saved and ready.
 */
export type AutomationDef = {
  kind: string;
  name: string;
  description: string;
};

export const AUTOMATION_CATALOG: AutomationDef[] = [
  {
    kind: "invoice_draft_on_complete",
    name: "Draft the final invoice when a job completes",
    description:
      "The moment a job is marked complete, a draft invoice for the remaining balance (price + approved change orders − already invoiced) is created on its Money tab, ready to review and send.",
  },
  {
    kind: "invoice_followup_unpaid",
    name: "Follow up on unpaid invoices",
    description:
      "Three days after an invoice is sent with no payment recorded, message the rep a friendly nudge with the invoice link.",
  },
  {
    kind: "invoice_overdue_chase",
    name: "Chase overdue invoices",
    description:
      "The morning an invoice passes its due date, send the rep a reminder with the balance and the PDF link — and keep the job flagged until it's paid.",
  },
  {
    kind: "invoice_receipt_on_paid",
    name: "Send a receipt when an invoice is paid",
    description:
      "When payments cover an invoice in full, thank the rep and confirm the balance is settled.",
  },
];
