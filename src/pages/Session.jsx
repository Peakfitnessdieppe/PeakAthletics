import React from 'react'
import useAuth from '../hooks/useAuth'
import DashboardLayout from '../components/layout/DashboardLayout'

const Session = () => {
  const { user, profile, signOut } = useAuth()

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-pfa-green">Session</h1>
        <div className="text-white/80">User: {user?.email}</div>
        <div className="text-white/80">Role: {profile?.role ?? 'N/A'}</div>
        <button
          onClick={signOut}
          className="bg-pfa-green text-black font-semibold px-4 py-2 rounded hover:brightness-110 transition"
        >
          Sign Out
        </button>
      </div>
    </DashboardLayout>
  )
}

export default Session
