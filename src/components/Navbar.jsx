import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaBriefcase, FaCode, FaScroll, FaTerminal, FaGamepad } from 'react-icons/fa';

const tabs = [
  { path: '/',            label: 'Home',        icon: <FaHome /> },
  { path: '/experience',  label: 'Experience',  icon: <FaBriefcase /> },
  { path: '/projects',    label: 'Projects',    icon: <FaCode /> },
  { path: '/research',    label: 'Research',    icon: <FaScroll /> },
  { path: '/competitive', label: 'Competitive', icon: <FaTerminal /> },
  // Tinted differently so the games read as a detour from the portfolio
  // proper — the old divider and "GAMES" label did the same job noisily.
  { path: '/playground',  label: 'Playground',  icon: <FaGamepad />, accent: 'var(--accent-secondary)' },
];

const tabStyle = (isActive, accent = 'var(--accent-primary)') => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.45rem 1rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.88rem',
  textDecoration: 'none',
  color: isActive ? '#000' : accent === 'var(--accent-primary)' ? 'var(--text-main)' : accent,
  background: isActive ? accent : 'transparent',
  border: `1px solid ${isActive ? 'transparent' : accent === 'var(--accent-primary)' ? 'var(--border-color)' : 'rgba(255,42,109,0.3)'}`,
  borderRadius: '4px',
  transition: 'all 0.25s ease',
  whiteSpace: 'nowrap',
});

const Navbar = () => (
  <nav style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.85rem 1rem',
    background: 'rgba(0,0,0,0.45)',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    backdropFilter: 'blur(6px)',
  }}>
    {tabs.map((tab) => (
      <NavLink
        key={tab.path}
        to={tab.path}
        end={tab.path === '/'}
        style={({ isActive }) => tabStyle(isActive, tab.accent)}
      >
        {tab.icon} {tab.label}
      </NavLink>
    ))}
  </nav>
);

export default Navbar;
