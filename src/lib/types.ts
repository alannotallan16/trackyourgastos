export type SplitType = "equal" | "percentage" | "fixed";

export interface Profile {
  id: string;
  display_name: string;
  short_name: string;
  avatar_url: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface SplitPreset {
  id: string;
  name: string;
  description: string | null;
  split_type: SplitType;
  members: SplitPresetMember[];
}

export interface SplitPresetMember {
  preset_id: string;
  user_id: string;
  percentage: number | null;
  fixed_amount: number | null;
}

export interface MerchantRule {
  id: string;
  keyword: string;
  suggested_category_id: string | null;
  suggested_split_preset_id: string | null;
}

export interface Expense {
  id: string;
  expense_date: string;
  merchant: string;
  total_amount: number;
  currency: string;
  exchange_rate: number | null;
  category_id: string | null;
  paid_by_user_id: string;
  split_preset_id: string | null;
  notes: string | null;
  receipt_file_id: string | null;
  recurring_expense_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  split_type: SplitType;
  percentage: number | null;
  fixed_amount: number | null;
  calculated_amount: number;
  settlement_status: SettlementStatus;
  settlement_id: string | null;
  settled_at: string | null;
}

export type SettlementStatus = "unpaid" | "in_settlement" | "settled";
export type SettlementStateValue = "open" | "partially_paid" | "paid" | "cancelled";

export interface ReceiptFile {
  id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  ocr_text: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface RecurringExpense {
  id: string;
  merchant: string;
  category_id: string | null;
  amount: number;
  currency: string;
  paid_by_user_id: string;
  split_preset_id: string | null;
  frequency: "weekly" | "monthly" | "yearly";
  next_due_date: string;
  active: boolean;
  notes: string | null;
}

export interface Settlement {
  id: string;
  settlement_number: string;
  from_user_id: string;
  to_user_id: string;
  currency: string;
  total_amount: number;
  amount_paid: number;
  remaining_amount: number;
  status: SettlementStateValue;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SettlementItem {
  id: string;
  settlement_id: string;
  expense_id: string;
  expense_split_id: string;
  amount: number;
  created_at: string;
}

export interface SettlementPayment {
  id: string;
  settlement_id: string;
  payment_date: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  notes: string | null;
  reference_number: string | null;
  attachment_path: string | null;
  created_by: string;
  created_at: string;
}

export interface SplitInput {
  user_id: string;
  split_type: SplitType;
  percentage?: number | null;
  fixed_amount?: number | null;
}
