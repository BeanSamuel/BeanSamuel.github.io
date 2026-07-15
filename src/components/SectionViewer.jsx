import React from 'react';

const SectionViewer = ({ title, children }) => {
  return (
    <div className="terminal-window section-viewer glow-effect">
      <div className="terminal-header">
        <div className="window-controls">
          <div className="control close"></div>
          <div className="control minimize"></div>
          <div className="control maximize"></div>
        </div>
        <div className="window-title">~/portfolio/{title.toLowerCase().replace(/\s+/g, '_')}</div>
      </div>
      <div className="terminal-body" style={{ padding: '2rem' }}>
        <h2><span style={{ color: 'var(--accent-secondary)' }}>#</span> {title}</h2>
        <div className="section-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SectionViewer;
