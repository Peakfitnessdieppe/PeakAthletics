import React from 'react'
import { useNavigate } from 'react-router-dom'

const LandingPage = () => {
  const navigate = useNavigate()

  const handleSignIn = () => navigate('/login')

  const handleLearnMore = () => {
    const el = document.getElementById('services')
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const heroStyles = {
    minHeight: '100vh',
    background: '#0a0f0a',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '0 24px',
  }

  const servicesStyles = {
    background: '#0d1a0e',
    padding: '80px 24px',
  }

  const gridStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  }

  const cardStyles = {
    background: '#0a0f0a',
    border: '1px solid rgba(63,174,82,0.2)',
    borderRadius: '14px',
    padding: '28px',
  }

  const ctaStyles = {
    background: '#0a0f0a',
    padding: '80px 24px',
    textAlign: 'center',
  }

  const footerStyles = {
    background: '#060c06',
    padding: '24px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: '12px',
  }

  const services = [
    {
      icon: '🏃',
      title: 'Group Classes',
      desc: 'High-energy group training sessions designed for all fitness levels.',
    },
    {
      icon: '👥',
      title: 'Small Group Training',
      desc: 'Personalized coaching in small groups of 4-8 athletes for maximum attention.',
    },
    {
      icon: '🎯',
      title: '1-on-1 Coaching',
      desc: 'Dedicated one-on-one sessions tailored to your specific goals.',
    },
    {
      icon: '🏒',
      title: 'Team Training',
      desc: 'Sport-specific conditioning programs for competitive teams.',
    },
    {
      icon: '📊',
      title: 'Athletic Performance Testing',
      desc: 'Comprehensive physical testing with standardized scoring, rankings, and progress tracking through PeakCard.',
    },
    {
      icon: '🧠',
      title: 'FMS Testing',
      desc: 'Functional Movement Screen assessments to identify movement limitations and injury risk.',
    },
  ]

  return (
    <div style={{ background: '#0a0f0a', color: 'white', minHeight: '100vh' }}>
      <section style={heroStyles}>
        <div
          style={{
            background: 'rgba(63,174,82,0.15)',
            color: '#3fae52',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            padding: '6px 16px',
            borderRadius: '20px',
            marginBottom: '24px',
          }}
        >
          Dieppe, New Brunswick
        </div>
        <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '0.08em', color: '#3fae52' }}>PEAK FITNESS ATHLETICS</div>
        <div style={{ fontSize: '20px', color: 'white', marginTop: '16px', fontWeight: 700 }}>
          Elite Athletic Performance Testing
        </div>
        <button
          onClick={handleSignIn}
          style={{
            background: '#3fae52',
            color: 'black',
            fontWeight: 800,
            fontSize: '16px',
            padding: '16px 40px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.03em',
            marginTop: '32px',
          }}
        >
          Athlete Login
        </button>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '16px',
          }}
        >
          <button
            onClick={handleLearnMore}
            style={{
              background: 'transparent',
              border: '2px solid rgba(63,174,82,0.4)',
              color: '#3fae52',
              fontWeight: 600,
              fontSize: '14px',
              padding: '12px 24px',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Our Services
          </button>
          <button
            onClick={() => (window.location.href = 'mailto:info@peakfitnessdieppe.ca')}
            style={{
              background: 'transparent',
              border: '2px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 600,
              fontSize: '14px',
              padding: '12px 24px',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Contact Us
          </button>
          <button
            onClick={handleSignIn}
            style={{
              background: 'transparent',
              border: '2px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 600,
              fontSize: '14px',
              padding: '12px 24px',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Join Now
          </button>
        </div>
        <div
          onClick={handleLearnMore}
          style={{
            marginTop: '16px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          ↓ Learn More
        </div>
      </section>

      <section id="services" style={servicesStyles}>
        <div style={{ fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '48px' }}>What We Offer</div>
        <div style={gridStyles}>
          {services.map((service) => (
            <div key={service.title} style={cardStyles}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{service.icon}</div>
              <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{service.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.6 }}>{service.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={ctaStyles}>
        <div style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>Ready to track your performance?</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
          Join hundreds of athletes already using PeakCard
        </div>
        <button
          onClick={handleSignIn}
          style={{
            background: '#3fae52',
            color: 'black',
            fontWeight: 700,
            fontSize: '16px',
            padding: '16px 40px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.03em',
          }}
        >
          Sign In to PeakCard
        </button>
      </section>

      <footer style={footerStyles}>© 2026 Peak Fitness Athletics — Dieppe, NB</footer>
    </div>
  )
}

export default LandingPage
