export type Clinic = {
  id: string;
  name: string;
  owner_name: string | null;
  clinic_type: string | null;
};

export type Patient = {
  id: string;
  clinic_id: string;
  full_name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  locality: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  patients?: { full_name: string } | null;
};

export type Invoice = {
  id: string;
  clinic_id: string;
  patient_id: string;
  invoice_date: string;
  total_amount: number;
  status: "unpaid" | "partial" | "paid";
  patients?: { full_name: string } | null;
  payments?: { amount: number }[];
};

export type InventoryItem = {
  id: string;
  clinic_id: string;
  item_name: string;
  category: string | null;
  unit: string | null;
  reorder_level: number;
  cost_price: number | null;
  selling_price: number | null;
  supplier_name: string | null;
};

export type InventoryBatch = {
  id: string;
  clinic_id: string;
  item_id: string;
  batch_number: string | null;
  quantity: number;
  expiry_date: string | null;
};
