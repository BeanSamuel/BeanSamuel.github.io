import React from 'react';
import { TypeAnimation } from 'react-type-animation';
import { personalInfo, abilities } from '../data/resumeData';
import SectionViewer from '../components/SectionViewer';
import HeroTerminal from '../components/HeroTerminal';
import { FaGithub, FaGlobe } from 'react-icons/fa';

const Home = () => {
  return (
    <div>
      <HeroTerminal />
      
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '2.5rem',
        marginBottom: '3rem',
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
            alt="Samuel's Avatar" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            onError={(e) => { e.target.src = 'https://via.placeholder.com/180?text=Avatar' }}
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
                'Full-Stack Developer', 2000,
                'Robotics Vision Specialist', 2000,
                'Algorithm Explorer', 2000,
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
            />
          </div>
          
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <a href={personalInfo.website} target="_blank" rel="noopener noreferrer" className="cyber-btn">
               <FaGlobe /> Website
             </a>
             <a href={`https://github.com/${personalInfo.github}`} target="_blank" rel="noopener noreferrer" className="cyber-btn">
               <FaGithub /> GitHub
             </a>
          </div>

          <div className="watermark-container">
            <a href={`https://github.com/${personalInfo.github}`} target="_blank" rel="noopener noreferrer">
              <img 
                src={`https://github-readme-stats.vercel.app/api?username=${personalInfo.github}&show_icons=true&theme=radical&bg_color=0D1117&text_color=c5c6c7&icon_color=45f3ff&title_color=ff2a6d&hide_border=true`} 
                alt="GitHub Stats" 
                height="130"
              />
            </a>
            <a href={`https://github.com/${personalInfo.github}`} target="_blank" rel="noopener noreferrer">
              <img 
                src={`https://github-readme-stats.vercel.app/api/top-langs/?username=${personalInfo.github}&layout=compact&theme=radical&bg_color=0D1117&text_color=c5c6c7&title_color=ff2a6d&hide_border=true`} 
                alt="Top Languages" 
                height="130"
              />
            </a>
          </div>

        </div>
      </div>

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
