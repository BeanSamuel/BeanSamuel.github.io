import React from 'react';
import { NavLink } from 'react-router-dom';

const Navbar = () => {
  const tabs = [
    { path: '/', label: '~/home' },
    { path: '/experience', label: '~/experience' },
    { path: '/projects', label: '~/projects' },
    { path: '/publications', label: '~/publications' },
  ];

  return (
    <nav style={{
      display: 'flex',
      gap: '0.5rem',
      padding: '1rem',
      background: 'rgba(0,0,0,0.4)',
      borderBottom: '1px solid var(--border-color)',
      marginBottom: '2rem',
      flexWrap: 'wrap'
    }}>
      {tabs.map((tab, idx) => (
        <NavLink 
          key={idx} 
          to={tab.path}
          style={({ isActive }) => ({
            padding: '0.5rem 1rem',
            fontFamily: 'var(--font-mono)',
            textDecoration: 'none',
            color: isActive ? '#000' : 'var(--text-main)',
            background: isActive ? 'var(--accent-primary)' : 'transparent',
            border: `1px solid ${isActive ? 'transparent' : 'var(--border-color)'}`,
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          })}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
};

export default Navbar;
