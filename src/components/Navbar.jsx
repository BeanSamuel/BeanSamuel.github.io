import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaBriefcase, FaCode, FaScroll, FaDragon, FaCrosshairs, FaTerminal } from 'react-icons/fa';

const mainTabs = [
  { path: '/',             label: 'Home',         icon: <FaHome /> },
  { path: '/experience',   label: 'Experience',   icon: <FaBriefcase /> },
  { path: '/projects',     label: 'Projects',     icon: <FaCode /> },
  { path: '/publications', label: 'Publications', icon: <FaScroll /> },
  { path: '/competitive',  label: 'CP',           icon: <FaTerminal /> },
];

const gameTabs = [
  { path: '/snake', label: 'Snake.exe',  icon: <FaDragon /> },
  { path: '/fps',   label: 'Cyber FPS',  icon: <FaCrosshairs /> },
];

const tabStyle = (isActive) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.45rem 1rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.88rem',
  textDecoration: 'none',
  color: isActive ? '#000' : 'var(--text-main)',
  background: isActive ? 'var(--accent-primary)' : 'transparent',
  border: `1px solid ${isActive ? 'transparent' : 'var(--border-color)'}`,
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
    {/* Main navigation */}
    {mainTabs.map((tab) => (
      <NavLink key={tab.path} to={tab.path} end={tab.path === '/'}
        style={({ isActive }) => tabStyle(isActive)}>
        {tab.icon} {tab.label}
      </NavLink>
    ))}

    {/* Divider */}
    <span style={{
      width: '1px',
      height: '28px',
      background: 'var(--border-color)',
      margin: '0 0.3rem',
      flexShrink: 0,
    }} />
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.7rem',
      color: 'var(--text-dim)',
      letterSpacing: '1px',
      textTransform: 'uppercase',
    }}>Games</span>

    {/* Game tabs */}
    {gameTabs.map((tab) => (
      <NavLink key={tab.path} to={tab.path}
        style={({ isActive }) => ({
          ...tabStyle(isActive),
          color: isActive ? '#000' : 'var(--accent-secondary)',
          border: `1px solid ${isActive ? 'transparent' : 'rgba(255,42,109,0.3)'}`,
          background: isActive ? 'var(--accent-secondary)' : 'transparent',
        })}>
        {tab.icon} {tab.label}
      </NavLink>
    ))}
  </nav>
);

export default Navbar;
