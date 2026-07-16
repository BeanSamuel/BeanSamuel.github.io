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
  padding: '0.4rem 0.75rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  textDecoration: 'none',
  color: isActive ? accent : 'var(--text-dim)',
  background: isActive ? 'var(--accent-soft)' : 'transparent',
  borderRadius: '4px',
  transition: 'color var(--ease), background-color var(--ease)',
  whiteSpace: 'nowrap',
});

const Navbar = () => (
  <nav style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.15rem',
    padding: '0.6rem 0',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
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
