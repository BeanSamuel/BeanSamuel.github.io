import React from 'react';

const listItemStyle = {
  marginBottom: '2rem',
  borderLeft: '2px solid var(--border-color)',
  paddingLeft: '1.5rem',
  position: 'relative'
};

const dotStyle = {
  content: '""',
  position: 'absolute',
  left: '-6px',
  top: '0px',
  width: '10px',
  height: '10px',
  background: 'var(--bg-color)',
  border: '2px solid var(--accent-primary)',
  borderRadius: '50%'
};

export const ExperienceList = ({ data }) => (
  <div>
    {data.map((item, idx) => (
      <div key={idx} style={listItemStyle}>
        <div style={dotStyle}></div>
        <h3 style={{ color: 'var(--accent-tertiary)', marginBottom: '0.3rem' }}>{item.title}</h3>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
          {item.company} // {item.period}
        </p>
        <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-main)' }}>
          {item.description.map((desc, dIdx) => (
            <li key={dIdx} style={{ marginBottom: '0.5rem' }}>{desc}</li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

export const EducationList = ({ data }) => (
  <div>
    {data.map((item, idx) => (
      <div key={idx} style={listItemStyle}>
         <div style={dotStyle}></div>
        <h3 style={{ color: 'var(--accent-tertiary)' }}>{item.institution}</h3>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-dim)', margin: '0.5rem 0' }}>
          {item.department} | {item.period}
        </p>
        <p>{item.details}</p>
      </div>
    ))}
  </div>
);

export const PublicationList = ({ data }) => (
  <div>
    {data.map((item, idx) => (
      <div key={idx} style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
        <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.5rem' }}>{item.title}</h4>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--accent-primary)' }}>Authors:</span> {item.authors}
        </p>
        <p style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>
          <span style={{ color: 'var(--accent-secondary)' }}>[{item.year}]</span> <i>{item.venue}</i>
        </p>
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.85rem' }} className="cyber-btn">
            [ Read Paper ]
          </a>
        )}
      </div>
    ))}
  </div>
);

export const GeneralList = ({ title, data }) => (
  <div>
    <ul style={{ listStyleType: 'square', paddingLeft: '1.5rem' }}>
      {data.map((item, idx) => (
        <li key={idx} style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>
          <span style={{ color: '#fff', fontWeight: '500' }}>{item.title || item.name}</span>
          {(item.year || item.tag) && (
             <span style={{ color: 'var(--accent-primary)', marginLeft: '1rem', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
               [{item.year || item.tag}]
             </span>
          )}
        </li>
      ))}
    </ul>
  </div>
);

export const ProjectList = ({ data }) => (
  <div>
    {data.map((item, idx) => (
      <div
        key={idx}
        style={{
          marginBottom: '1.5rem',
          background: 'rgba(255,255,255,0.03)',
          padding: '1.5rem',
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          transition: 'border-color 0.3s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ color: '#fff', fontSize: '1.05rem', margin: 0 }}>{item.name}</h4>
          <span style={{
            color: 'var(--accent-primary)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            background: 'rgba(69, 243, 255, 0.1)',
            padding: '0.2rem 0.6rem',
            borderRadius: '3px',
            whiteSpace: 'nowrap'
          }}>{item.tag}</span>
        </div>
        {item.description && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.8rem', marginBottom: 0 }}>
            {item.description}
          </p>
        )}
      </div>
    ))}
  </div>
);
