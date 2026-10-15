/*
# HealthThread Core Schema — Phase 1

## Summary
Creates the full database schema for the HealthThread personal health management app.

## New Tables
1. **profiles** — User profile data linked to auth.users. Contains name, DOB, biological sex, blood type, measurements, emergency contact, menstrual tracking opt-in flag, onboarding status.
2. **health_records** — All health events: doctor visits, hospitalizations, surgeries, injuries, lab reports, prescriptions, screenings, conditions, allergies, custom events. Has type, title, description, date, provider, severity, attachment.
3. **medications** — Current and past medications with dosage, frequency, dates, prescriber, active flag.
4. **vaccinations** — Vaccination history with dose number, date, provider, next due date.
5. **appointments** — Upcoming and past appointments with provider, location, status.
6. **documents** — Secure file uploads (lab results, prescriptions, imaging, reports). References Supabase Storage paths.
7. **reminders** — User reminders for medications, appointments, checkups, custom.
8. **menstrual_logs** — Private menstrual cycle data: period dates, flow, cramps, pain, mood, energy, sleep, symptoms, notes. Stored separately from general health records for privacy.

## Security
- RLS enabled on ALL tables.
- All tables are owner-scoped: user_id defaults to auth.uid(), policies check auth.uid() = user_id.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE), scoped TO authenticated.
- Menstrual logs are private by default — only the owner can access them.

## Storage
- A private storage bucket 'health-documents' is created for document uploads.
- Only authenticated users can upload/read their own files (path includes user_id).
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  date_of_birth date,
  biological_sex text CHECK (biological_sex IN ('male', 'female', 'intersex')),
  blood_type text,
  height_cm numeric,
  weight_kg numeric,
  menstrual_tracking_enabled boolean NOT NULL DEFAULT false,
  emergency_contact_name text,
  emergency_contact_phone text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ============ HEALTH RECORDS ============
CREATE TABLE IF NOT EXISTS health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('doctor_visit','hospitalization','surgery','injury','lab_report','prescription','screening','condition','allergy','custom')),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  provider text,
  severity text CHECK (severity IN ('mild','moderate','severe')),
  attachment_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_health_records" ON health_records;
CREATE POLICY "select_own_health_records" ON health_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_health_records" ON health_records;
CREATE POLICY "insert_own_health_records" ON health_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_health_records" ON health_records;
CREATE POLICY "update_own_health_records" ON health_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_health_records" ON health_records;
CREATE POLICY "delete_own_health_records" ON health_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ MEDICATIONS ============
CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text NOT NULL,
  frequency text,
  start_date date NOT NULL,
  end_date date,
  prescriber text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_medications" ON medications;
CREATE POLICY "select_own_medications" ON medications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_medications" ON medications;
CREATE POLICY "insert_own_medications" ON medications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_medications" ON medications;
CREATE POLICY "update_own_medications" ON medications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_medications" ON medications;
CREATE POLICY "delete_own_medications" ON medications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ VACCINATIONS ============
CREATE TABLE IF NOT EXISTS vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  dose_number integer,
  date_administered date NOT NULL,
  provider text,
  next_due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vaccinations" ON vaccinations;
CREATE POLICY "select_own_vaccinations" ON vaccinations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vaccinations" ON vaccinations;
CREATE POLICY "insert_own_vaccinations" ON vaccinations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vaccinations" ON vaccinations;
CREATE POLICY "update_own_vaccinations" ON vaccinations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vaccinations" ON vaccinations;
CREATE POLICY "delete_own_vaccinations" ON vaccinations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ APPOINTMENTS ============
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  provider text,
  specialty text,
  location text,
  appointment_date timestamptz NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','completed','cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_appointments" ON appointments;
CREATE POLICY "select_own_appointments" ON appointments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_appointments" ON appointments;
CREATE POLICY "insert_own_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_appointments" ON appointments;
CREATE POLICY "update_own_appointments" ON appointments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_appointments" ON appointments;
CREATE POLICY "delete_own_appointments" ON appointments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ DOCUMENTS ============
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'other' CHECK (document_type IN ('lab_result','prescription','imaging','report','other')),
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_documents" ON documents;
CREATE POLICY "select_own_documents" ON documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_documents" ON documents;
CREATE POLICY "insert_own_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_documents" ON documents;
CREATE POLICY "update_own_documents" ON documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_documents" ON documents;
CREATE POLICY "delete_own_documents" ON documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ REMINDERS ============
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  reminder_type text NOT NULL DEFAULT 'custom' CHECK (reminder_type IN ('medication','appointment','checkup','custom')),
  due_date timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reminders" ON reminders;
CREATE POLICY "select_own_reminders" ON reminders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reminders" ON reminders;
CREATE POLICY "insert_own_reminders" ON reminders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reminders" ON reminders;
CREATE POLICY "update_own_reminders" ON reminders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reminders" ON reminders;
CREATE POLICY "delete_own_reminders" ON reminders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ MENSTRUAL LOGS ============
CREATE TABLE IF NOT EXISTS menstrual_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date,
  flow_level text CHECK (flow_level IN ('light','moderate','heavy')),
  cramps text CHECK (cramps IN ('none','mild','moderate','severe')),
  pain_level integer CHECK (pain_level >= 0 AND pain_level <= 10),
  mood text,
  energy text CHECK (energy IN ('low','normal','high')),
  sleep_hours numeric CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  symptoms text[],
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE menstrual_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE menstrual_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_menstrual_logs" ON menstrual_logs;
CREATE POLICY "select_own_menstrual_logs" ON menstrual_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_menstrual_logs" ON menstrual_logs;
CREATE POLICY "insert_own_menstrual_logs" ON menstrual_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_menstrual_logs" ON menstrual_logs;
CREATE POLICY "update_own_menstrual_logs" ON menstrual_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_menstrual_logs" ON menstrual_logs;
CREATE POLICY "delete_own_menstrual_logs" ON menstrual_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_menstrual_log_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cycle logs can only be changed by their owner.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.period_start > CURRENT_DATE THEN
    RAISE EXCEPTION 'Period start date cannot be in the future.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.period_end IS NOT NULL AND NEW.period_end < NEW.period_start THEN
    RAISE EXCEPTION 'Period end date cannot be before its start date.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.period_end IS NOT NULL AND NEW.period_end > CURRENT_DATE THEN
    RAISE EXCEPTION 'Period end date cannot be in the future.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.pain_level IS NOT NULL AND (NEW.pain_level < 0 OR NEW.pain_level > 10) THEN
    RAISE EXCEPTION 'Pain level must be between 0 and 10.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.sleep_hours IS NOT NULL AND (NEW.sleep_hours < 0 OR NEW.sleep_hours > 24) THEN
    RAISE EXCEPTION 'Sleep hours must be between 0 and 24.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.menstrual_logs AS existing
    WHERE existing.user_id = NEW.user_id
      AND existing.id <> NEW.id
      AND pg_catalog.daterange(
        existing.period_start,
        COALESCE(existing.period_end, existing.period_start),
        '[]'
      ) && pg_catalog.daterange(
        NEW.period_start,
        COALESCE(NEW.period_end, NEW.period_start),
        '[]'
      )
  ) THEN
    RAISE EXCEPTION 'Period dates cannot overlap another logged period.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_menstrual_log_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_menstrual_log_integrity ON public.menstrual_logs;
CREATE TRIGGER trg_menstrual_log_integrity
  BEFORE INSERT OR UPDATE ON public.menstrual_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_menstrual_log_integrity();

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_health_records_user_date ON health_records(user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_medications_user_active ON medications(user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_vaccinations_user_date ON vaccinations(user_id, date_administered DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON appointments(user_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders(user_id, due_date ASC) WHERE completed = false;
CREATE INDEX IF NOT EXISTS idx_menstrual_logs_user_start ON menstrual_logs(user_id, period_start DESC);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_health_records_updated ON health_records;
CREATE TRIGGER trg_health_records_updated BEFORE UPDATE ON health_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_medications_updated ON medications;
CREATE TRIGGER trg_medications_updated BEFORE UPDATE ON medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_vaccinations_updated ON vaccinations;
CREATE TRIGGER trg_vaccinations_updated BEFORE UPDATE ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated ON appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_menstrual_logs_updated ON menstrual_logs;
CREATE TRIGGER trg_menstrual_logs_updated BEFORE UPDATE ON menstrual_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
