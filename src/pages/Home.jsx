import { TypeAnimation } from 'react-type-animation';
import { personalInfo, abilities } from '../data/resumeData';
import SectionViewer from '../components/SectionViewer';
import HeroTerminal from '../components/HeroTerminal';
import useReducedMotion from '../hooks/useReducedMotion';
import { FaGithub, FaEnvelope } from 'react-icons/fa';

const ROLES = [
  'NLP & AI Researcher',
  'Backend Developer',
  'Cross-Modal Representation Learner',
];

const HOLD_MS = 2000;

const Home = () => {
  const reducedMotion = useReducedMotion();

  return (
    <div>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.75rem',
        margin: '1rem 0 3rem 0',
        flexWrap: 'wrap',
      }}>
        <img
          src="/avatar.png"
          alt=""
          width="112"
          height="112"
          style={{
            width: '112px',
            height: '112px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1px solid var(--border-strong)',
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: '260px' }}>
          <h1>{personalInfo.name}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>{personalInfo.chineseName}</p>

          {/* Height is reserved so the cycling text cannot shift the buttons
              below it as lines of different length swap in. */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.1rem',
            color: 'var(--accent-secondary)',
            marginTop: '0.5rem',
            minHeight: '3.4rem',
          }}>
            {reducedMotion ? (
              <span>{personalInfo.role}</span>
            ) : (
              <TypeAnimation
                sequence={ROLES.flatMap((role) => [role, HOLD_MS])}
                wrapper="span"
                speed={50}
                repeat={Infinity}
              />
            )}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href={`https://github.com/${personalInfo.github}`} target="_blank" rel="noopener noreferrer" className="cyber-btn">
              <FaGithub aria-hidden="true" /> GitHub
            </a>
            <a href={`mailto:${personalInfo.email}`} className="cyber-btn">
              <FaEnvelope aria-hidden="true" /> Email
            </a>
          </div>
        </div>
      </header>

      <HeroTerminal />

      <SectionViewer title="GitHub Contributions">
        <picture>
          <source
            media="(prefers-color-scheme: dark)"
            srcSet="https://raw.githubusercontent.com/BeanSamuel/BeanSamuel.github.io/output/github-contribution-grid-snake-dark.svg"
          />
          <source
            media="(prefers-color-scheme: light)"
            srcSet="https://raw.githubusercontent.com/BeanSamuel/BeanSamuel.github.io/output/github-contribution-grid-snake.svg"
          />
          <img
            alt="GitHub contribution grid, animated as a snake eating the commit squares"
            src="https://raw.githubusercontent.com/BeanSamuel/BeanSamuel.github.io/output/github-contribution-grid-snake.svg"
            loading="lazy"
            style={{ width: '100%' }}
          />
        </picture>
      </SectionViewer>

      <SectionViewer title="Core Abilities">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {abilities.map((ability) => (
            <div key={ability.category}>
              <h3 style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--accent-primary)',
                paddingBottom: '0.6rem',
                marginBottom: '0.8rem',
                borderBottom: '1px solid var(--border-color)',
              }}>
                {ability.category}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.9rem' }}>
                {ability.items.map((item) => (
                  <li key={item} style={{ marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionViewer>
    </div>
  );
};

export default Home;
