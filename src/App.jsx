import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Experience from './pages/Experience';
import Projects from './pages/Projects';
import Research from './pages/Research';
import Competitive from './pages/Competitive';
import Playground from './pages/Playground';
import { personalInfo } from './data/resumeData';

function App() {
  return (
    <HashRouter>
      <div className="bg-grid"></div>
      <div className="container">
        
        {/* Navigation Tabs */}
        <Navbar />

        {/* Page Routing */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/experience" element={<Experience />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/research" element={<Research />} />
          <Route path="/competitive" element={<Competitive />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/playground/:game" element={<Playground />} />

          {/* Old URLs, kept so existing links and bookmarks still land. */}
          <Route path="/publications" element={<Navigate to="/research" replace />} />
          <Route path="/snake" element={<Navigate to="/playground/snake" replace />} />
          <Route path="/fps" element={<Navigate to="/playground/fps" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Footer */}
        <div style={{ textAlign: 'center', margin: '4rem 0 2rem 0', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <p>
            System <span style={{color: 'var(--accent-secondary)'}}>Offline</span>. 
            [ <a href={`https://github.com/${personalInfo.github}`} target="_blank" rel="noopener noreferrer">GitHub Profile</a> ]
          </p>
          <p style={{ marginTop: '0.5rem' }}>© {new Date().getFullYear()} {personalInfo.name}. All rights reserved.</p>
        </div>

      </div>
    </HashRouter>
  );
}

export default App;
