import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import useAuth from '../hooks/useAuth'

const SPORT_COLORS = {
  hockey: 'text-blue-400',
  soccer: 'text-green-400',
  ringette: 'text-purple-400',
  basketball: 'text-orange-400',
  all: 'text-[#3fae52]',
}

const SESSION_TYPE_COLORS = {
  Speed: 'bg-blue-900/40 text-blue-300',
  Strength: 'bg-purple-900/40 text-purple-300',
  Power: 'bg-amber-900/40 text-amber-300',
  Recovery: 'bg-teal-900/40 text-teal-300',
  Rest: 'bg-gray-800 text-gray-400',
  Training: 'bg-[#3fae52]/20 text-[#3fae52]',
}

const STAGE_LABELS = {
  beginner: { stage: 'Stage 1', label: 'Learn to Train', ages: 'Ages 10–13', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/40' },
  intermediate: { stage: 'Stage 2', label: 'Train to Train', ages: 'Ages 13–15', color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800/40' },
  advanced: { stage: 'Stage 3', label: 'Train to Compete', ages: 'Ages 15–18', color: 'text-[#3fae52]', bg: 'bg-[#3fae52]/10 border-[#3fae52]/30' },
}

export default function Pro() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [days, setDays] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [exercises, setExercises] = useState([])
  const [weekLoading, setWeekLoading] = useState(false)
  const [dayLoading, setDayLoading] = useState(false)
  const [videoModal, setVideoModal] = useState(null)

  useEffect(() => {
    loadPrograms()
  }, [])

  const loadPrograms = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pfa_programs')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
    setPrograms(data || [])
    setLoading(false)
  }

  const openProgram = async (prog) => {
    setSelectedProgram(prog)
    setSelectedWeek(null)
    setSelectedDay(null)
    setDays([])
    setExercises([])
    setWeekLoading(true)
    const { data } = await supabase
      .from('pfa_weeks')
      .select('*')
      .eq('program_id', prog.id)
      .order('week_number')
    setWeeks(data || [])
    if (data && data.length > 0) {
      await selectWeek(data[0])
    }
    setWeekLoading(false)
  }

  const selectWeek = async (week) => {
    setSelectedWeek(week)
    setSelectedDay(null)
    setExercises([])
    setDayLoading(true)
    const { data } = await supabase
      .from('pfa_days')
      .select('*')
      .eq('week_id', week.id)
      .order('day_number')
    setDays(data || [])
    if (data && data.length > 0) {
      await selectDay(data[0])
    }
    setDayLoading(false)
  }

  const selectDay = async (day) => {
    setSelectedDay(day)
    const { data } = await supabase
      .from('pfa_exercises')
      .select('*')
      .eq('day_id', day.id)
      .order('sort_order')
    setExercises(data || [])
  }

  const getVideoEmbedUrl = (url, provider) => {
    if (!url) return null
    if (provider === 'youtube') {
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/)
      return match ? `https://www.youtube.com/embed/${match[1]}` : null
    }
    if (provider === 'vimeo') {
      const match = url.match(/vimeo\.com\/(\d+)/)
      return match ? `https://player.vimeo.com/video/${match[1]}` : null
    }
    return null
  }

  const filteredPrograms = filter === 'all'
    ? programs
    : programs.filter((p) => p.sport === filter || (p.tags || []).includes(filter))

  const filters = ['all', 'hockey', 'soccer', 'ringette', 'speed', 'strength', 'power', 'offseason']

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <div className="text-[#3fae52] text-sm uppercase tracking-widest animate-pulse">Loading Programs...</div>
      </div>
    )
  }

  if (selectedProgram) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0f0a', color: 'white', overflow: 'hidden' }}>

        {/* Video Modal */}
        {videoModal && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setVideoModal(null)}
          >
            <div
              className="bg-[#0d1a0d] border border-[#1a2e1a] rounded-xl overflow-hidden w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {getVideoEmbedUrl(videoModal.url, videoModal.provider) ? (
                <div className="aspect-video">
                  <iframe
                    src={getVideoEmbedUrl(videoModal.url, videoModal.provider)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video bg-[#0a120a] flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-[#3fae52]/20 border border-[#3fae52]/40 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#3fae52] ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">Video coming soon</p>
                </div>
              )}
              <div className="p-5">
                <div className="text-white font-bold text-lg uppercase tracking-wide mb-1">{videoModal.name}</div>
                {videoModal.notes && <div className="text-gray-400 text-sm leading-relaxed">{videoModal.notes}</div>}
                {videoModal.sets_reps && <div className="text-[#3fae52] text-sm mt-2 font-semibold">{videoModal.sets_reps}</div>}
                <button
                  onClick={() => setVideoModal(null)}
                  className="mt-4 text-xs text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky header */}
        <div style={{ flexShrink: 0 }} className="border-b border-[#1a2e1a] bg-[#0d1a0d] px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedProgram(null)
              setWeeks([])
              setDays([])
              setExercises([])
            }}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wide font-semibold"
          >
            ← Programs
          </button>
          <div className="text-center">
            <div className="font-bold uppercase tracking-wide text-xs text-white">{selectedProgram.title}</div>
            <div className="text-xs text-gray-500">{selectedProgram.weeks_total}w · {selectedProgram.days_per_week}d/wk · {selectedProgram.minutes_per_session}min</div>
          </div>
          {selectedProgram.pdf_url ? (
            <a
              href={selectedProgram.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 border border-[#3fae52]/40 text-[#3fae52] text-xs font-bold uppercase tracking-wide rounded hover:bg-[#3fae52]/10 transition-colors"
            >
              ↓ PDF
            </a>
          ) : (
            <div className="w-12" />
          )}
        </div>

        {/* Description strip */}
        <div style={{ flexShrink: 0 }} className="px-4 py-2 border-b border-[#1a2e1a] bg-[#0a120a]">
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{selectedProgram.description}</p>
          <div className="hidden sm:flex gap-1.5 mt-1.5 flex-wrap">
            {(selectedProgram.tags || []).map((tag) => (
              <span key={tag} className="text-xs font-semibold px-2 py-0.5 rounded bg-[#3fae52]/10 text-[#3fae52] uppercase tracking-wide">{tag}</span>
            ))}
          </div>
        </div>

        {/* Mobile week scroller */}
        <div style={{ flexShrink: 0, height: '48px', overflowX: 'auto', overflowY: 'hidden' }} className="sm:hidden border-b border-[#1a2e1a] bg-[#0a120a]">
          <div style={{ display: 'flex', height: '100%' }}>
            {weeks.map((w) => (
              <button
                key={w.id}
                onClick={() => selectWeek(w)}
                style={{
                  flexShrink: 0,
                  height: '100%',
                  padding: '0 14px',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: selectedWeek?.id === w.id ? '2px solid #3fae52' : '2px solid transparent',
                  color: selectedWeek?.id === w.id ? '#3fae52' : 'rgba(255,255,255,0.4)',
                  background: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Wk {w.week_number}
              </button>
            ))}
          </div>
        </div>

        {/* Body — fills all remaining space */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Desktop week sidebar */}
          <div className="hidden sm:flex flex-col w-44 flex-shrink-0 border-r border-[#1a2e1a] bg-[#0a120a] overflow-y-auto">
            <div className="px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-bold border-b border-[#1a2e1a] flex-shrink-0">Weeks</div>
            {weekLoading ? (
              <div className="p-4 text-xs text-gray-600 animate-pulse">Loading...</div>
            ) : weeks.length === 0 ? (
              <div className="p-4 text-xs text-gray-600">No weeks added yet.</div>
            ) : (
              weeks.map((w) => (
                <button
                  key={w.id}
                  onClick={() => selectWeek(w)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-[#1a2e1a]/50 transition-colors flex-shrink-0 ${
                    selectedWeek?.id === w.id
                      ? 'bg-[#3fae52]/10 text-white border-l-2 border-l-[#3fae52]'
                      : 'text-gray-400 hover:text-white hover:bg-[#0d1a0d]'
                  }`}
                >
                  <div className="font-semibold">Week {w.week_number}</div>
                  {w.focus && <div className="text-xs text-gray-600 mt-0.5 leading-tight">{w.focus}</div>}
                </button>
              ))
            )}
          </div>

          {/* Day tabs + exercises — scrollable */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Day tabs */}
            {days.length > 0 && (
              <div style={{ flexShrink: 0, overflowX: 'auto' }} className="flex border-b border-[#1a2e1a] bg-[#0a120a]">
                {days.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => selectDay(d)}
                    className={`flex-shrink-0 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
                      selectedDay?.id === d.id
                        ? 'border-[#3fae52] text-[#3fae52]'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Day {d.day_number}
                    <span className="hidden md:inline ml-1 font-normal normal-case tracking-normal text-xs opacity-70">— {d.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Day header */}
            {selectedDay && (
              <div style={{ flexShrink: 0 }} className="px-4 py-3 border-b border-[#1a2e1a] flex items-center gap-3">
                <div className="font-bold uppercase tracking-wide text-white text-sm">{selectedDay.label}</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${SESSION_TYPE_COLORS[selectedDay.session_type] || SESSION_TYPE_COLORS.Training}`}>
                  {selectedDay.session_type}
                </span>
              </div>
            )}

            {/* Exercise list — this div scrolls */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div className="p-3 sm:p-5 space-y-2.5">
                {dayLoading ? (
                  <div className="text-xs text-gray-600 animate-pulse">Loading...</div>
                ) : !selectedDay ? (
                  <div className="text-gray-600 text-sm">Select a week and day to view exercises.</div>
                ) : exercises.length === 0 ? (
                  <div className="text-gray-600 text-sm">No exercises added to this day yet.</div>
                ) : (
                  exercises.map((ex, i) => (
                    <div
                      key={ex.id}
                      className="bg-[#0d1a0d] border border-[#1a2e1a] rounded-lg p-3 flex items-start gap-3 hover:border-[#3fae52]/30 transition-colors"
                    >
                      <button
                        onClick={() => setVideoModal({ name: ex.name, url: ex.video_url, provider: ex.video_provider, notes: ex.coaching_notes, sets_reps: ex.sets_reps })}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3fae52]/15 border border-[#3fae52]/30 flex items-center justify-center hover:bg-[#3fae52]/25 transition-colors mt-0.5"
                      >
                        <svg className="w-3.5 h-3.5 text-[#3fae52] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-white text-sm">{ex.name}</div>
                          <div className="text-xs text-gray-500 flex-shrink-0">#{i + 1}</div>
                        </div>
                        {ex.sets_reps && (
                          <div className="text-[#3fae52] text-xs font-semibold mt-1">{ex.sets_reps}</div>
                        )}
                        {ex.coaching_notes && (
                          <div className="text-gray-400 text-xs mt-1 leading-relaxed">{ex.coaching_notes}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // PROGRAM LIBRARY VIEW
  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white">

      {/* Nav */}
      <div className="border-b border-[#1a2e1a] bg-[#0d1a0d] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <div className="font-black uppercase tracking-wide text-lg">PFA <span className="text-[#3fae52]">PRO</span></div>
          <div className="text-xs text-gray-500">Program Library</div>
        </div>
        <button
          onClick={() => navigate('/card')}
          className="text-xs text-gray-500 hover:text-white uppercase tracking-wide transition-colors"
        >
          ← My Card
        </button>
      </div>

      <div className="px-4 py-4 max-w-5xl mx-auto">

        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-xl font-black uppercase tracking-wide">
            {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}.` : 'Program Library'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Choose a program and follow it week by week. One subscription, every program.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap mb-4 -mx-1 px-1 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-colors ${
                filter === f
                  ? 'bg-[#3fae52]/20 border-[#3fae52]/60 text-[#3fae52]'
                  : 'border-[#1a2e1a] text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Program grid */}
        {filteredPrograms.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <div className="text-4xl mb-3">—</div>
            <div className="text-sm uppercase tracking-widest">No programs available yet</div>
            <div className="text-xs text-gray-700 mt-2">Check back soon — programs are being added.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPrograms.map((prog) => (
              <button
                key={prog.id}
                onClick={() => openProgram(prog)}
                className="text-left bg-[#0d1a0d] border border-[#1a2e1a] rounded-xl overflow-hidden hover:border-[#3fae52]/50 transition-all hover:translate-y-[-2px] group"
              >
                {/* Thumbnail or gradient placeholder */}
                {prog.thumbnail_url ? (
                  <img src={prog.thumbnail_url} alt={prog.title} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-[#0a120a] flex items-center justify-center border-b border-[#1a2e1a] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#3fae52]/5 to-transparent" />
                    <span className={`font-black text-4xl uppercase tracking-tight ${SPORT_COLORS[prog.sport] || 'text-[#3fae52]'} opacity-30 group-hover:opacity-50 transition-opacity`}>
                      {prog.title.split(' ').map((w) => w[0]).join('').slice(0, 3)}
                    </span>
                  </div>
                )}
                <div className="p-3">
                  {STAGE_LABELS[prog.level] && (
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-bold mb-2 ${STAGE_LABELS[prog.level].bg}`}>
                      <span className={STAGE_LABELS[prog.level].color}>{STAGE_LABELS[prog.level].stage}</span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-400">{STAGE_LABELS[prog.level].label}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-600 font-normal">{STAGE_LABELS[prog.level].ages}</span>
                    </div>
                  )}
                  <div className="font-bold text-white uppercase tracking-wide text-sm leading-tight mb-1">{prog.title}</div>
                  <div className="text-xs text-gray-500 mb-3">{prog.weeks_total} weeks · {prog.days_per_week} days/wk · {prog.minutes_per_session} min</div>
                  {prog.description && (
                    <div className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-3">{prog.description}</div>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {(prog.tags || []).slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs font-semibold px-2 py-0.5 rounded bg-[#3fae52]/10 text-[#3fae52] uppercase tracking-wide">{tag}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
