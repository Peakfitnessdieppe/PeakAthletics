import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'

const todayStr = () => new Date().toISOString().split('T')[0]

const flagKeywords = {
  soreness: ['knee', 'back', 'shoulder', 'head', 'neck', 'ankle', 'hip'],
  notes: ['hurt', 'pain', 'tired', 'stressed', 'injured', 'injury', 'sick'],
}

const Checkin = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [form, setForm] = useState({
    sleep_quality: null,
    energy_level: null,
    stress_level: null,
    nutrition_quality: null,
    soreness: false,
    soreness_location: '',
    open_notes: '',
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alreadyChecked, setAlreadyChecked] = useState(false)
  const [success, setSuccess] = useState(false)

  const firstName = useMemo(() => profile?.full_name?.split(' ')[0] || 'Athlete', [profile?.full_name])

  const fetchTodayStatus = async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('athlete_checkins')
        .select('id')
        .eq('athlete_id', profile.id)
        .eq('checkin_date', todayStr())
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      setAlreadyChecked(!!data)
    } catch (err) {
      console.error('Check-in status load error', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTodayStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const shouldFlag = (values) => {
    const stressSleep = values.stress_level >= 4 && values.sleep_quality <= 2
    const sorenessRisk =
      values.soreness === true &&
      (values.soreness_location || '')
        .toLowerCase()
        .split(/\s+/)
        .some((w) => flagKeywords.soreness.some((k) => w.includes(k)))
    const notesRisk = (values.open_notes || '')
      .toLowerCase()
      .split(/\s+/)
      .some((w) => flagKeywords.notes.some((k) => w.includes(k)))
    return stressSleep || sorenessRisk || notesRisk
  }

  const allRequiredSelected =
    form.sleep_quality &&
    form.energy_level &&
    form.stress_level &&
    form.nutrition_quality &&
    (!form.soreness || form.soreness_location.trim().length > 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!profile?.id || !allRequiredSelected) return
    setSubmitting(true)
    try {
      const payload = {
        athlete_id: profile.id,
        checkin_date: todayStr(),
        sleep_quality: form.sleep_quality,
        energy_level: form.energy_level,
        stress_level: form.stress_level,
        nutrition_quality: form.nutrition_quality,
        soreness: form.soreness,
        soreness_location: form.soreness ? form.soreness_location : null,
        open_notes: form.open_notes ? form.open_notes.trim() : null,
        flagged: shouldFlag(form),
      }
      const { error } = await supabase.from('athlete_checkins').insert(payload)
      if (error) throw error
      setSuccess(true)
      setAlreadyChecked(true)
    } catch (err) {
      console.error('Check-in submit error', err)
      alert('Unable to submit check-in right now. Please try again.')
    }
    setSubmitting(false)
  }

  const renderScale = (field, label, helper) => (
    <div className="space-y-3">
      <div className="text-white text-sm font-semibold">{label}</div>
      {helper && <div className="text-white/60 text-xs">{helper}</div>}
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((val) => {
          const selected = form[field] === val
          return (
            <button
              key={val}
              type="button"
              onClick={() => setField(field, val)}
              className={`h-12 rounded-xl border text-sm font-semibold transition-colors ${
                selected ? 'bg-[#3fae52] text-black border-[#3fae52]' : 'bg-white/5 text-white border-white/10'
              }`}
            >
              {val}
            </button>
          )
        })}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-[#3fae52] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    )
  }

  if (alreadyChecked && !success) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] text-white flex flex-col items-center justify-center px-6">
        <img
          src="https://iilysafrbbnklelzzqyh.supabase.co/storage/v1/object/public/Assets/Peak%20Athletics%20Logo%202.png"
          alt="PFA"
          className="w-12 h-12 mb-4"
        />
        <div className="text-xl font-semibold text-center mb-2">You already checked in today.</div>
        <div className="text-white/70 text-center mb-6">See you next time!</div>
        <button
          onClick={() => navigate('/card')}
          className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/90 w-full max-w-xs"
        >
          Back to my card
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] text-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-[#0f2012] border border-[#3fae52] flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3fae52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-2xl font-semibold mb-2">Check-in submitted!</div>
        <div className="text-white/70 mb-6">Thanks {firstName}. Keep it up.</div>
        <button
          onClick={() => navigate('/card')}
          className="w-full max-w-xs bg-[#3fae52] text-black font-semibold py-3 rounded-xl"
        >
          Back to my card
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img
            src="https://iilysafrbbnklelzzqyh.supabase.co/storage/v1/object/public/Assets/Peak%20Athletics%20Logo%202.png"
            alt="Peak Fitness Athletics"
            className="w-12 h-12 mb-3"
          />
          <div className="text-[20px] font-semibold text-center">How are you doing this week?</div>
          <div className="text-[#3fae52] text-sm">{profile?.full_name}</div>
        </div>

        <form className="space-y-6 pb-10" onSubmit={handleSubmit}>
          {renderScale('sleep_quality', 'How well did you sleep this week?', '1 = Poor, 5 = Great')}
          {renderScale('energy_level', 'Energy at practice?')}
          {renderScale('stress_level', 'Stress outside of sport?', '1 = Low, 5 = High')}
          {renderScale('nutrition_quality', 'How was your nutrition?')}

          <div className="space-y-3">
            <div className="text-white text-sm font-semibold">Any pain or soreness?</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'No', value: false },
                { label: 'Yes', value: true },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setField('soreness', opt.value)}
                  className={`h-12 rounded-xl border text-sm font-semibold transition-colors ${
                    form.soreness === opt.value
                      ? 'bg-[#3fae52] text-black border-[#3fae52]'
                      : 'bg-white/5 text-white border-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.soreness === true && (
              <input
                type="text"
                value={form.soreness_location}
                onChange={(e) => setField('soreness_location', e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-3 text-sm placeholder-white/40"
                placeholder="Where? (e.g. left knee, lower back)"
                required
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="text-white text-sm font-semibold">Anything you want your coach or PFA staff to know?</div>
            <textarea
              rows={4}
              value={form.open_notes}
              onChange={(e) => setField('open_notes', e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-3 text-sm placeholder-white/40"
              placeholder="Optional — share anything on your mind"
            />
          </div>

          <button
            type="submit"
            disabled={!allRequiredSelected || submitting}
            className={`w-full py-3 rounded-xl font-semibold ${
              !allRequiredSelected || submitting
                ? 'bg-[#1f3524] text-white/60 cursor-not-allowed'
                : 'bg-[#3fae52] text-black'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit Check-in'}
          </button>
          <div className="text-xs text-white/50 text-center">
            Your responses are shared with your coach and PFA staff.
          </div>
        </form>
      </div>
    </div>
  )
}

export default Checkin
