import React, { useState, useEffect } from 'react';
import { personalInfo } from '../data/resumeData';

const HeroTerminal = () => {
  const [textIndex, setTextIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  const lines = [
    `> System initializing...`,
    `> Loading user profile: ${personalInfo.name} (${personalInfo.chineseName})`,
    `> Access granted.`,
    `> Role: ${personalInfo.role}`,
    `> Mission: Bridging AI, Algorithms, and Full-Stack Architecture.`,
    `> Run explore.sh ...`
  ];

  useEffect(() => {
    if (textIndex < lines.length) {
      const timer = setTimeout(() => {
        setTextIndex(prev => prev + 1);
      }, 700); // 700ms delay per line
      return () => clearTimeout(timer);
    }
  }, [textIndex, lines.length]);

  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <div className="window-controls">
          <div className="control close"></div>
          <div className="control minimize"></div>
          <div className="control maximize"></div>
        </div>
        <div className="window-title">bash - root@localhost</div>
      </div>
      <div className="terminal-body" style={{ minHeight: '200px' }}>
        {lines.slice(0, textIndex + 1).map((line, idx) => (
          <div key={idx} style={{ marginBottom: '0.8rem', color: idx === lines.length - 1 ? 'var(--accent-primary)' : 'var(--text-main)' }}>
            {line}
          </div>
        ))}
        {textIndex >= lines.length && (
          <div>
            <span style={{ color: 'var(--accent-primary)' }}>guest@portfolio:~$</span> 
            <span className="cursor-blink"></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeroTerminal;
