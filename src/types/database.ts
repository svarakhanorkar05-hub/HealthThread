export type HealthRecordType =
  | 'doctor_visit'
  | 'hospitalization'
  | 'surgery'
  | 'injury'
  | 'lab_report'
  | 'prescription'
  | 'screening'
  | 'condition'
  | 'allergy'
  | 'custom';

export interface Profile {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  biological_sex: 'male' | 'female' | 'intersex' | null;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  menstrual_tracking_enabled: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthRecord {
  id: string;
  user_id: string;
  record_type: HealthRecordType;
  title: string;
  description: string | null;
  event_date: string;
  provider: string | null;
  severity: 'mild' | 'moderate' | 'severe' | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  start_date: string;
  end_date: string | null;
  prescriber: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vaccination {
  id: string;
  user_id: string;
  vaccine_name: string;
  dose_number: number | null;
  date_administered: string;
  provider: string | null;
  next_due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  provider: string | null;
  specialty: string | null;
  location: string | null;
  appointment_date: string;
  reason: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  title: string;
  document_type: 'lab_result' | 'prescription' | 'imaging' | 'report' | 'other';
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  reminder_type: 'medication' | 'appointment' | 'checkup' | 'custom';
  due_date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
}

export interface MenstrualLog {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string | null;
  flow_level: 'light' | 'moderate' | 'heavy' | null;
  cramps: 'none' | 'mild' | 'moderate' | 'severe' | null;
  pain_level: number | null;
  mood: string | null;
  energy: 'low' | 'normal' | 'high' | null;
  sleep_hours: number | null;
  symptoms: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
