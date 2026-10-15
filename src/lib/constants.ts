import {
  Stethoscope,
  HeartPulse,
  Syringe,
  Pill,
  AlertCircle,
  Activity,
  FileText,
  Calendar,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { HealthRecordType } from '@/types/database';

export const RECORD_TYPE_LABELS: Record<HealthRecordType, string> = {
  doctor_visit: 'Doctor Visit',
  hospitalization: 'Hospitalization',
  surgery: 'Surgery',
  injury: 'Injury',
  lab_report: 'Lab Report',
  prescription: 'Prescription',
  screening: 'Screening',
  condition: 'Medical Condition',
  allergy: 'Allergy',
  custom: 'Custom Event',
};

export function normalizeHealthRecordType(value: unknown): HealthRecordType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RECORD_TYPE_LABELS, value)
    ? value as HealthRecordType
    : 'custom';
}

export const RECORD_TYPE_ICONS: Record<HealthRecordType, LucideIcon> = {
  doctor_visit: Stethoscope,
  hospitalization: Activity,
  surgery: HeartPulse,
  injury: AlertCircle,
  lab_report: FileText,
  prescription: FileText,
  screening: HeartPulse,
  condition: AlertCircle,
  allergy: AlertCircle,
  custom: Activity,
};

export const RECORD_TYPE_COLORS: Record<HealthRecordType, string> = {
  doctor_visit: 'bg-teal-50 text-teal-700 border-teal-100',
  hospitalization: 'bg-rose-50 text-rose-700 border-rose-100',
  surgery: 'bg-rose-50 text-rose-700 border-rose-100',
  injury: 'bg-orange-50 text-orange-700 border-orange-100',
  lab_report: 'bg-blue-50 text-blue-700 border-blue-100',
  prescription: 'bg-sage-50 text-sage-700 border-sage-100',
  screening: 'bg-teal-50 text-teal-700 border-teal-100',
  condition: 'bg-amber-50 text-amber-700 border-amber-100',
  allergy: 'bg-rose-50 text-rose-700 border-rose-100',
  custom: 'bg-slate-50 text-slate-700 border-slate-100',
};

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Health Records', icon: FileText, path: '/records' },
  { label: 'Medications', icon: Pill, path: '/medications' },
  { label: 'Vaccinations', icon: Syringe, path: '/vaccinations' },
  { label: 'Appointments', icon: Calendar, path: '/appointments' },
  { label: 'Cycle Tracking', icon: HeartPulse, path: '/menstrual' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-sage-50 text-sage-700 border-sage-100',
  moderate: 'bg-amber-50 text-amber-700 border-amber-100',
  severe: 'bg-rose-50 text-rose-700 border-rose-100',
};
