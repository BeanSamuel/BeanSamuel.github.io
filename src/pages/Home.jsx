import { TypeAnimation } from 'react-type-animation';
import { personalInfo, abilities } from '../data/resumeData';
import SectionViewer from '../components/SectionViewer';
import HeroTerminal from '../components/HeroTerminal';
import { FaGithub, FaEnvelope } from 'react-icons/fa';

const Home = () => {
  return (
    <div>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '2.5rem',
        margin: '1rem 0 3rem 0',
        flexWrap: 'wrap'
      }}>
        <div style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid var(--accent-primary)',
          boxShadow: '0 0 20px var(--accent-primary)',
          flexShrink: 0
        }}>
          <img
            src="/avatar.png"
            alt={`${personalInfo.name} avatar`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h1 className="glow-text" style={{ fontSize: '3rem', margin: '0' }}>{personalInfo.name}</h1>
          <h3 style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>{personalInfo.chineseName}</h3>
          
          <div style={{
            fontSize: '1.2rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-secondary)',
            height: '60px' // Reserve space to avoid layout shift
          }}>
            <TypeAnimation
              sequence={[
                'NLP & AI Researcher', 2000,
                'ICPC Competitor (Silver & Bronze)', 2000,
                'Backend Developer', 2000,
                'Cross-Modal Representation Learner', 2000,
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
            />
          </div>
          
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <a href={`https://github.com/${personalInfo.github}`} target="_blank" rel="noopener noreferrer" className="cyber-btn">
               <FaGithub /> GitHub
             </a>
             <a href={`mailto:${personalInfo.email}`} className="cyber-btn">
               <FaEnvelope /> Email
             </a>
          </div>

          <div className="watermark-container">
            <a href={`https://github.com/${personalInfo.github}`} target="_blank" rel="noopener noreferrer">
              <img 
                src={`https://img.shields.io/github/followers/${personalInfo.github}?style=for-the-badge&logo=github&color=0D1117&labelColor=ff2a6d&logoColor=45f3ff`} 
                alt="GitHub Followers" 
              />
            </a>
            <a href={`https://github.com/${personalInfo.github}/BeanSamuel.github.io`} target="_blank" rel="noopener noreferrer">
              <img 
                src={`https://img.shields.io/github/stars/${personalInfo.github}/BeanSamuel.github.io?style=for-the-badge&logo=github&color=0D1117&labelColor=ff2a6d&logoColor=45f3ff`} 
                alt="GitHub Stars" 
              />
            </a>
            <a href={`https://github.com/${personalInfo.github}/BeanSamuel.github.io`} target="_blank" rel="noopener noreferrer">
              <img 
                src={`https://img.shields.io/github/languages/top/${personalInfo.github}/BeanSamuel.github.io?style=for-the-badge&logo=github&color=0D1117&labelColor=ff2a6d&logoColor=45f3ff`} 
                alt="Top Language" 
              />
            </a>
          </div>

        </div>
      </div>

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
            alt="github contribution grid snake animation"
            src="https://raw.githubusercontent.com/BeanSamuel/BeanSamuel.github.io/output/github-contribution-grid-snake.svg"
            style={{ width: '100%' }}
          />
        </picture>
      </SectionViewer>

      <SectionViewer title="Core Abilities">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          {abilities.map((ability, idx) => (
            <div key={idx} style={{ 
              background: 'rgba(0,0,0,0.5)', 
              border: `1px solid ${ability.color}`,
              borderRadius: '8px',
              padding: '1.5rem',
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <h3 style={{ color: ability.color, marginBottom: '1rem', borderBottom: `1px dashed ${ability.color}`, paddingBottom: '0.5rem' }}>
                {ability.category}
              </h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {ability.items.map((item, idy) => (
                  <li key={idy} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: ability.color }}>✓</span> {item}
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
