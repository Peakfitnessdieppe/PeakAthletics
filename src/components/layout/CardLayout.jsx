import React from 'react'

const CardLayout = ({ children, lightMode }) => {
  return <div className={`min-h-screen p-6 ${lightMode ? 'bg-white text-[#1a1a1a]' : 'bg-[#0a0f0a] text-white'}`}>{children}</div>
}

export default CardLayout
