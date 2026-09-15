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
  patient_number: number | null;
  created_at: string;
};

export type Doctor = {
  id: string;
  clinic_id: string;
  name: string;
  specialty: string | null;
};

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_date: string;
  appointment_time: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  referred_to_lab?: boolean;
  lab_name?: string | null;
  patients?: { full_name: string } | null;
  doctors?: { name: string; specialty: string | null } | null;
};

export type Invoice = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  treatment: string | null;
  invoice_date: string;
  total_amount: number;
  status: "unpaid" | "partial" | "paid";
  patients?: { full_name: string } | null;
  doctors?: { name: string } | null;
  payments?: { id: string; amount: number; payment_method: string; paid_at: string }[];
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
