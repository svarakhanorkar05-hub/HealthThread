import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, ArrowRight, ArrowLeft, Check, Shield, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BLOOD_TYPES } from '@/lib/constants';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [biologicalSex, setBiologicalSex] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [menstrualTracking, setMenstrualTracking] = useState(false);

  const steps = ['Welcome', 'Basic Info', 'Health Details', 'Emergency Contact', 'Privacy & Cycle'];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName.trim() || null,
          date_of_birth: dateOfBirth || null,
          biological_sex: biologicalSex || null,
          blood_type: bloodType || null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          emergency_contact_name: emergencyContactName.trim() || null,
          emergency_contact_phone: emergencyContactPhone.trim() || null,
          menstrual_tracking_enabled: menstrualTracking,
          onboarding_completed: true,
        }, { onConflict: 'id' });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      await refreshProfile();
      navigate('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save your profile.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-teal-50/30 to-sage-50/30">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-700 text-white">
            <HeartPulse className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold text-slate-900">HealthThread</span>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-300 ${
                  i < step
                    ? 'bg-teal-700 text-white'
                    : i === step
                    ? 'bg-teal-700 text-white ring-4 ring-teal-100'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                    i < step ? 'bg-teal-700' : 'bg-slate-100'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="card p-6 sm:p-8 animate-fade-in">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Welcome to HealthThread</h2>
              <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
                Let's set up your health profile. This takes about 2 minutes, and you can skip
                any question that doesn't apply to you. Your information is private and encrypted.
              </p>
              <div className="flex items-center justify-center gap-2 mt-6 text-sm text-sage-600">
                <Shield className="w-4 h-4" />
                <span>Protected by row-level security — only you can see your data</span>
              </div>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Basic information</h2>
              <p className="text-sm text-slate-500 mb-4">Helps personalize your health overview.</p>

              <div>
                <label className="label" htmlFor="fullName">Full name</label>
                <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="Jane Doe" />
              </div>

              <div>
                <label className="label" htmlFor="dob">Date of birth</label>
                <input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="input" />
              </div>

              <div>
                <label className="label">Biological sex (optional)</label>
                <p className="text-xs text-slate-400 mb-2">Used for age-appropriate health insights. You can change this later.</p>
                <div className="flex flex-wrap gap-2">
                  {['male', 'female', 'intersex'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBiologicalSex(s)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                        biologicalSex === s
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Health Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Health details</h2>
              <p className="text-sm text-slate-500 mb-4">Basic health information for your records.</p>

              <div>
                <label className="label" htmlFor="bloodType">Blood type (optional)</label>
                <select id="bloodType" value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="input">
                  <option value="">Select blood type</option>
                  {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="height">Height (cm)</label>
                  <input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="input" placeholder="170" min="0" />
                </div>
                <div>
                  <label className="label" htmlFor="weight">Weight (kg)</label>
                  <input id="weight" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="input" placeholder="65" min="0" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Emergency Contact */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Emergency contact</h2>
              <p className="text-sm text-slate-500 mb-4">Who should be contacted in case of emergency? This is optional.</p>

              <div>
                <label className="label" htmlFor="emName">Contact name</label>
                <input id="emName" type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className="input" placeholder="John Doe" />
              </div>

              <div>
                <label className="label" htmlFor="emPhone">Contact phone</label>
                <input id="emPhone" type="tel" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} className="input" placeholder="+1 555 000 0000" />
              </div>
            </div>
          )}

          {/* Step 4: Privacy & Cycle */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Privacy & cycle tracking</h2>
              <p className="text-sm text-slate-500 mb-4">Your menstrual data is always private. Only you can access it.</p>

              <div className="p-4 rounded-xl bg-cream-100 border border-sage-100">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">Enable menstrual cycle tracking?</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Track periods, symptoms, and cycle patterns. Your data is stored separately,
                      protected by RLS, and never shared automatically with anyone — including
                      parents or caregivers.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setMenstrualTracking(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          menstrualTracking
                            ? 'bg-teal-700 text-white'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        Yes, enable
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenstrualTracking(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          !menstrualTracking
                            ? 'bg-slate-700 text-white'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        No, skip
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-sage-50 border border-sage-100">
                <Shield className="w-4 h-4 text-sage-600 mt-0.5 shrink-0" />
                <p className="text-xs text-sage-700">
                  You can change this setting anytime in Settings. Menstrual tracking is
                  age-appropriate and includes educational content. We never infer pregnancy or
                  make medical diagnoses.
                </p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-6 border-t border-slate-100">
            {step > 0 ? (
              <button onClick={handleBack} className="btn-ghost">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              {step > 0 && step < steps.length - 1 && (
                <button onClick={handleSkip} className="btn-ghost text-slate-400">
                  Skip
                </button>
              )}
              <button onClick={handleNext} disabled={loading} className="btn-primary">
                {loading ? 'Saving...' : step === steps.length - 1 ? 'Finish' : 'Continue'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Step {step + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
}
