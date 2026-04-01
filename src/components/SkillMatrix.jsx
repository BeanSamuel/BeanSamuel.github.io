import React from 'react';
import { skills } from '../data/resumeData';

const SkillMatrix = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
      {skills.map((skill, idx) => (
        <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#fff' }}>{skill.name}</span>
            <span style={{ color: 'var(--accent-primary)' }}>{skill.score}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${skill.score}%`, height: '100%', background: 'var(--accent-secondary)' }}></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkillMatrix;
