import React, { useState, useEffect, useRef } from 'react'

const GLOFOX_URL = 'https://app.glofox.com/portal/#/branch/6245c53b0ebd700576474a53/memberships/6894e1eb88caf8da2203cd37/plan/1754587438328/buy'

const NAV_LINKS = [
  { label: 'Programs', href: '#programs' },
  { label: 'About', href: '#about' },
  { label: 'Results', href: '#results' },
  { label: 'Contact', href: '#contact' },
]

const STATS = [
  { value: '197', label: 'Active Athletes' },
  { value: '6+', label: 'Sports Trained' },
  { value: '3', label: 'Programs Running' },
  { value: '100%', label: 'Data-Driven' },
]

const PROGRAMS = [
  {
    id: 'youth',
    tag: 'MEMBERSHIP',
    title: 'Youth Development',
    subtitle: 'Ages 8–18 · All Sports',
    description: 'Weekly dryland training built for young athletes who want to get faster, stronger, and more explosive — regardless of sport or season.',
    cta: 'Register Now',
    ctaType: 'glofox',
    accent: '#3fae52',
  },
  {
    id: 'adult',
    tag: 'MEMBERSHIP',
    title: 'Train Like an Athlete',
    subtitle: 'Adults · All Levels',
    description: 'Athletic performance training for adults who are done with generic gym workouts. Train the way real athletes train.',
    cta: 'Register Now',
    ctaType: 'glofox',
    accent: '#3fae52',
  },
  {
    id: 'seasonal',
    tag: 'PROGRAM',
    title: 'Seasonal Programs',
    subtitle: 'Limited Spots · Fixed Dates',
    description: 'Intensive sport-specific training blocks with a defined start and end date. Spots fill fast — secure yours before registration closes.',
    cta: 'View Programs',
    ctaType: 'scroll',
    accent: '#ffffff',
  },
  {
    id: 'private',
    tag: '1-ON-1',
    title: 'Private Training',
    subtitle: 'Fully Personalized',
    description: 'One coach. One athlete. Maximum focus. Private sessions designed around your specific goals, weaknesses, and sport demands.',
    cta: 'Inquire Now',
    ctaType: 'inquiry',
    accent: '#3fae52',
  },
  {
    id: 'group',
    tag: 'SMALL GROUP',
    title: 'Small Group Training',
    subtitle: '2–4 Athletes',
    description: 'The accountability of a team with the attention of private coaching. Ideal for athletes who train together and want results together.',
    cta: 'Inquire Now',
    ctaType: 'inquiry',
    accent: '#3fae52',
  },
]

const TESTIMONIALS = [
  {
    name: 'Parent of U16 Hockey Player',
    text: 'After one off-season with PFA, our son came back to camp noticeably faster and stronger. The coaches genuinely care about each athlete.',
    sport: 'Hockey',
  },
  {
    name: 'Parent of U14 Soccer Player',
    text: 'The data tracking alone is worth it — we can actually see the progress over time. Our daughter loves coming in every week.',
    sport: 'Soccer',
  },
  {
    name: 'Adult Member',
    text: "I've tried regular gyms for years. Training like an athlete is completely different. I'm in the best shape of my life at 34.",
    sport: 'Adult Training',
  },
]

function useCountUp(target, duration = 1500, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    const numeric = parseInt(target.replace(/\D/g, ''))
    if (!numeric) { setCount(target); return }
    let startTime = null
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * numeric))
      if (progress < 1) requestAnimationFrame(step)
      else setCount(target)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function StatCard({ value, label, animate }) {
  const display = useCountUp(value, 1200, animate)
  return (
    <div>
      <div className="text-5xl md:text-7xl font-black text-white mb-3 leading-none">{display}</div>
      <div className="text-xs uppercase tracking-widest text-gray-500 leading-snug">{label}</div>
    </div>
  )
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [inquiryType, setInquiryType] = useState('')
  const [showInquireModal, setShowInquireModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', sport: '', message: '' })
  const [formStatus, setFormStatus] = useState(null)
  const statsRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const handleProgramCTA = () => {
    setShowInquireModal(true)
  }

  const handleInquirySubmit = async (e) => {
    e.preventDefault()
    setFormStatus('sending')
    try {
      const res = await fetch('/.netlify/functions/send-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, inquiryType }),
      })
      if (res.ok) {
        setFormStatus('success')
        setForm({ name: '', email: '', phone: '', sport: '', message: '' })
      } else {
        setFormStatus('error')
      }
    } catch {
      setFormStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white font-sans">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f0a]/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-24 hidden md:flex items-center justify-between">
          <div className="flex items-center gap-10 flex-1">
            <a href="#programs" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Programs</a>
            <a href="#about" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">About</a>
            <a href="#results" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Results</a>
          </div>
          <div className="flex justify-center flex-shrink-0 px-8">
            <a href="/"><img src="/logos/pfa_logo.png" alt="PFA" className="h-28 w-auto" /></a>
          </div>
          <div className="flex items-center justify-end gap-10 flex-1">
            <a href="#contact" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Contact</a>
            <a href="/login" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Athlete Login</a>
            <a href={GLOFOX_URL} target="_blank" rel="noreferrer" className="bg-[#3fae52] text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded hover:bg-[#35963f] transition-colors">
              Register
            </a>
          </div>
        </div>
        <div className="md:hidden flex items-center justify-between px-4 h-16">
          <a href="/"><img src="/logos/pfa_logo.png" alt="PFA" className="h-14 w-auto" /></a>
          <button className="text-white" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-[#0d140d] border-t border-white/5 px-4 py-4 flex flex-col gap-4">
            <a href="#programs" className="text-xs font-bold uppercase tracking-wider text-gray-400" onClick={() => setMenuOpen(false)}>Programs</a>
            <a href="#about" className="text-xs font-bold uppercase tracking-wider text-gray-400" onClick={() => setMenuOpen(false)}>About</a>
            <a href="#results" className="text-xs font-bold uppercase tracking-wider text-gray-400" onClick={() => setMenuOpen(false)}>Results</a>
            <a href="#contact" className="text-xs font-bold uppercase tracking-wider text-gray-400" onClick={() => setMenuOpen(false)}>Contact</a>
            <a href="/login" className="text-xs font-bold uppercase tracking-wider text-gray-400" onClick={() => setMenuOpen(false)}>Athlete Login</a>
            <a href={GLOFOX_URL} target="_blank" rel="noreferrer" className="bg-[#3fae52] text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded text-center">Register</a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/group_photos/pfa_team.jpg')" }} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#0a0f0a]" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black uppercase leading-none mb-6 tracking-tighter drop-shadow-2xl">
            Fundamentals.<br />
            <span className="text-[#3fae52]">Perfected.</span>
          </h1>
          <p className="text-base md:text-xl text-gray-200 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-lg px-2">
            Elite performance is built on the basics executed relentlessly with intensity, precision, and purpose. At PFA, we develop athletes who don't chase trends — they set standards.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://calendly.com/peakfitnessdieppe-info/peak-athletics"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                background: '#3fae52',
                color: '#0a0f0a',
                fontWeight: 700,
                fontSize: '16px',
                borderRadius: '12px',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                boxShadow: '0 14px 35px rgba(63,174,82,0.35)',
                border: '1px solid rgba(63,174,82,0.6)'
              }}
              className="transition-transform duration-200 hover:-translate-y-0.5"
            >
              Get in Touch →
            </a>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* TRUST BAR + STATS */}
      <section ref={statsRef} className="bg-[#0a0f0a] border-y border-white/5 py-20">
        <div className="max-w-6xl mx-auto px-4">

          {/* Trusted by */}
          <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-500 mb-8">Trusted by athletes in the:</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-10 mb-16">
            <img src="/logos/05_NHL_Shield.svg" alt="NHL" className="h-10 md:h-12 w-auto opacity-30 grayscale hover:opacity-60 transition-opacity" />
            <img src="/logos/qmjhl.png" alt="QMJHL" className="h-10 md:h-12 w-auto opacity-30 grayscale hover:opacity-60 transition-opacity" />
            <img src="/logos/hnb_logo.png" alt="Hockey NB" className="h-10 md:h-12 w-auto opacity-30 grayscale hover:opacity-60 transition-opacity" />
            <img src="/logos/Primary_horizontal_4x.avif" alt="CANPL" className="h-10 md:h-12 w-auto opacity-30 grayscale hover:opacity-60 transition-opacity" />
            <img src="/logos/weightliftingcanada.png" alt="Weightlifting Canada" className="h-10 md:h-12 w-auto opacity-30 grayscale hover:opacity-60 transition-opacity" />
            <img src="/logos/soccerdieppe.png" alt="Soccer Dieppe" className="h-10 md:h-12 w-auto opacity-30 grayscale hover:opacity-60 transition-opacity" />
            <img src="/logos/aus.png" alt="AUS" className="h-10 md:h-12 w-auto opacity-30 grayscale hover:opacity-60 transition-opacity" />
          </div>

          {/* Tagline */}
          <p className="text-center text-sm md:text-base font-bold uppercase tracking-widest text-gray-300 max-w-3xl mx-auto mb-16 leading-relaxed">
            Every rep is earned. These aren't vanity metrics — they're the result of athletes trusting the process, and coaches demanding more.
          </p>

          {/* Stat counters */}
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { value: '200+', label: 'Athletes Trained' },
              { value: '37', label: 'AAA & Junior Athletes' },
              { value: '12', label: 'University & College' },
              { value: '6', label: 'Pro & Drafted Athletes' },
            ].map((s, i) => (
              <div key={s.label} className={`py-10 px-6 text-left ${i !== 0 ? 'border-l border-white/10' : ''}`}>
                <StatCard value={s.value} label={s.label} animate={statsVisible} />
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* PROGRAMS */}
      <section id="programs" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[#3fae52] text-sm font-bold uppercase tracking-widest mb-3">What We Offer</div>
            <h2 className="text-4xl md:text-5xl font-black uppercase">Programs Built<br />for <span className="text-[#3fae52]">Real Results</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROGRAMS.map(p => (
              <div key={p.id} className="bg-[#0d140d] border border-white/10 rounded-lg p-7 flex flex-col hover:border-[#3fae52]/40 transition-colors group">
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: p.accent === '#ffffff' ? '#9ca3af' : '#3fae52' }}>{p.tag}</div>
                <h3 className="text-2xl font-black uppercase mb-1">{p.title}</h3>
                <div className="text-sm text-gray-500 mb-4">{p.subtitle}</div>
                <p className="text-gray-400 text-sm leading-relaxed flex-1 mb-6">{p.description}</p>
                <button
                  onClick={() => handleProgramCTA()}
                  className="w-full py-3 rounded font-bold uppercase tracking-wider text-sm transition-colors"
                  style={{
                    background: '#3fae52',
                    color: '#0a0f0a',
                    border: '1px solid rgba(63,174,82,0.6)',
                  }}
                >
                  Inquire Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="bg-[#0d140d] border-y border-white/5 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black uppercase text-center mb-16 leading-tight">
            What is Peak Fitness Athletics?
          </h2>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                Peak Fitness Athletics is a premier performance training facility based in Dieppe, New Brunswick, built with one mission: to develop the fastest, strongest, and most explosive athletes — no matter the sport or level of play.
              </p>
              <p className="text-white font-black text-lg mb-6">
                We don't chase trends. <span className="text-[#3fae52]">WE SET THE STANDARD.</span>
              </p>
              <p className="text-gray-300 text-lg leading-relaxed mb-8">
                From youth athletes to university standouts and professional competitors, PFA has become a proven pipeline for elite performance in Atlantic Canada. Our results speak louder than promises, and the athletes we produce are living proof of the system.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#programs" className="bg-[#3fae52] text-white font-bold uppercase tracking-wider px-6 py-3 rounded text-sm hover:bg-[#35963f] transition-colors text-center">
                  See Programs
                </a>
                <a
                  href="https://calendly.com/peakfitnessdieppe-info/peak-athletics"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '12px 22px',
                    background: 'linear-gradient(135deg, rgba(63,174,82,0.18), rgba(63,174,82,0.08))',
                    color: '#d7ffe0',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    border: '1px solid rgba(63,174,82,0.5)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.25)'
                  }}
                  className="transition-transform duration-200 hover:-translate-y-0.5"
                >
                  Get in Touch
                </a>
              </div>
            </div>
            <div className="bg-[#0a0f0a] border border-white/10 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
              <div className="text-center px-8">
                <img src="/logos/pfa_logo.png" alt="Peak Fitness Athletics" className="h-24 w-auto mx-auto mb-4 opacity-20" />
                <p className="text-gray-600 text-sm uppercase tracking-widest">Photo Coming Soon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ATHLETE SHOWCASE */}
      <section id="results" className="py-24 px-4 bg-[#0a0f0a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[#3fae52] text-sm font-bold uppercase tracking-widest mb-3">Athlete Results</div>
            <h2 className="text-5xl md:text-7xl font-black uppercase leading-none">
              Real Athletes.<br />Real Results.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { img: '/athletes/1.png', name: 'Athlete 1' },
              { img: '/athletes/2.png', name: 'Athlete 2' },
              { img: '/athletes/3.png', name: 'Athlete 3' },
              { img: '/athletes/4.png', name: 'Athlete 4' },
              { img: '/athletes/5.png', name: 'Athlete 5' },
              { img: '/athletes/6.png', name: 'Athlete 6' },
              { img: null, name: 'Coming Soon' },
              { img: null, name: 'Coming Soon' },
              { img: null, name: 'Coming Soon' },
              { img: null, name: 'Coming Soon' },
              { img: null, name: 'Coming Soon' },
              { img: null, name: 'Coming Soon' },
            ].map((athlete, i) => (
              <div key={i} className="relative aspect-[3/4] overflow-hidden bg-[#0d140d] border border-white/5">
                {athlete.img ? (
                  <img
                    src={athlete.img}
                    alt={athlete.name}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <img src="/logos/pfa_logo.png" alt="PFA" className="h-16 w-auto mx-auto mb-3 opacity-10" />
                      <p className="text-gray-700 text-xs uppercase tracking-widest">Coming Soon</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-4">
                  <div className="text-white font-black uppercase text-sm md:text-base tracking-wide">{athlete.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT CTA */}
      <section id="contact" className="bg-[#3fae52] py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase text-white mb-4">Ready to Get Started?</h2>
          <p className="text-white/80 text-lg mb-8">Join 197 athletes already training at Peak Fitness Athletics in Dieppe.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://calendly.com/peakfitnessdieppe-info/peak-athletics" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '14px 32px', background: '#ffffff', color: '#0a0f0a', fontWeight: 800, fontSize: '16px', borderRadius: '14px', textDecoration: 'none', boxShadow: '0 18px 45px rgba(10,15,10,0.25)', border: '1px solid rgba(10,15,10,0.12)' }} className="transition-transform duration-200 hover:-translate-y-0.5">
              Speak with Rick →
            </a>
            <a href="mailto:info@peakfitnessdieppe.ca" style={{ display: 'inline-block', padding: '14px 32px', background: '#0a0f0a', color: '#3fae52', fontWeight: 800, fontSize: '16px', borderRadius: '14px', textDecoration: 'none', border: '1px solid rgba(10,15,10,0.45)', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }} className="transition-transform duration-200 hover:-translate-y-0.5">
              Send Us An Email
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0a0f0a] border-t border-white/5 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <img src="/logos/pfa_logo.png" alt="PFA" className="h-10 w-auto" />
          <div className="flex gap-6 text-sm text-gray-500">
            {NAV_LINKS.map(l => <a key={l.label} href={l.href} className="hover:text-white transition-colors">{l.label}</a>)}
            <a href="/login" className="hover:text-white transition-colors">Athlete Login</a>
          </div>
          <div className="text-xs text-gray-600">© {new Date().getFullYear()} Peak Fitness Athletics. Dieppe, NB.</div>
        </div>
      </footer>

      {/* INQUIRY MODAL */}
      {inquiryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setInquiryOpen(false)}>
          <div className="bg-[#0d140d] border border-white/10 rounded-xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black uppercase">{inquiryType}</h3>
              <button onClick={() => setInquiryOpen(false)} className="text-gray-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {formStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="text-[#3fae52] text-5xl mb-4">✓</div>
                <div className="font-bold text-lg mb-2">Message Sent!</div>
                <div className="text-gray-400 text-sm">Rick and Cody will be in touch within 24 hours.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <input className="bg-[#0a0f0a] border border-white/10 rounded px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3fae52]" placeholder="Your Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className="bg-[#0a0f0a] border border-white/10 rounded px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3fae52]" placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <input className="bg-[#0a0f0a] border border-white/10 rounded px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3fae52]" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input className="bg-[#0a0f0a] border border-white/10 rounded px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3fae52]" placeholder="Sport / Goal" value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} />
                <textarea className="bg-[#0a0f0a] border border-white/10 rounded px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3fae52] resize-none" rows={3} placeholder="Tell us about yourself or your athlete..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                <button
                  onClick={handleInquirySubmit}
                  disabled={formStatus === 'sending'}
                  className="bg-[#3fae52] text-white font-bold uppercase tracking-wider py-3 rounded text-sm hover:bg-[#35963f] transition-colors disabled:opacity-50"
                >
                  {formStatus === 'sending' ? 'Sending...' : 'Send Message'}
                </button>
                {formStatus === 'error' && <div className="text-red-400 text-xs text-center">Something went wrong. Please try again or email us directly.</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {showInquireModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowInquireModal(false) }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
        >
          <div style={{
            background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)',
            borderRadius: '20px', padding: '40px', maxWidth: '420px', width: '100%',
            textAlign: 'center', position: 'relative'
          }}>
            <button
              onClick={() => setShowInquireModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '8px', color: '#3fae52', cursor: 'pointer', padding: '6px 12px', fontSize: '13px' }}
            >
              Close
            </button>
            <h3 style={{ color: '#f4fff6', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Get in Touch</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '28px' }}>Choose how you'd like to connect with us.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                href="https://calendly.com/peakfitnessdieppe-info/peak-athletics"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', padding: '14px 24px', background: '#3fae52', color: '#0a0f0a', fontWeight: 700, fontSize: '15px', borderRadius: '12px', textDecoration: 'none' }}
              >
                Speak with Rick →
              </a>
              <a
                href="mailto:info@peakfitnessdieppe.ca"
                onClick={(e) => {
                  e.preventDefault()
                  const mailtoLink = 'mailto:info@peakfitnessdieppe.ca'
                  const newWindow = window.open(mailtoLink, '_blank')
                  if (!newWindow) {
                    window.location.href = mailtoLink
                  }
                }}
                style={{ display: 'block', padding: '14px 24px', background: 'transparent', color: '#3fae52', fontWeight: 700, fontSize: '15px', borderRadius: '12px', textDecoration: 'none', border: '1px solid rgba(63,174,82,0.4)' }}
              >
                Send Us An Email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
