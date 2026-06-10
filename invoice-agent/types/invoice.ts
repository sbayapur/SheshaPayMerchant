export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ParsedInvoice {
  customer_name: string;
  customer_email: string;
  line_items: LineItem[];
  subtotal: number;
  total: number;
  due_date: string; // ISO date string YYYY-MM-DD
  confidence_notes: string[];
}
