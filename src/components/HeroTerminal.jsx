import { personalInfo } from '../data/resumeData';

const promptStyle = { color: 'var(--accent-primary)', userSelect: 'none' };
const blockStyle = { marginBottom: '1.25rem' };
const outputStyle = { color: 'var(--text-main)', margin: '0.35rem 0 0 0' };

const HeroTerminal = () => (
  <div className="terminal-window">
    <div className="terminal-header">
      <div className="window-controls">
        <div className="control"></div>
        <div className="control"></div>
        <div className="control"></div>
      </div>
      <div className="window-title">~/about</div>
    </div>
    <div className="terminal-body" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
      <div style={blockStyle}>
        <div><span style={promptStyle}>$</span> whoami</div>
        <p style={outputStyle}>
          {personalInfo.name} ({personalInfo.chineseName}) — CS undergrad at National Central University.
        </p>
      </div>

      <div style={{ ...blockStyle, marginBottom: 0 }}>
        <div><span style={promptStyle}>$</span> cat about.txt</div>
        <p style={outputStyle}>
          Research intern at Academia Sinica, working on how large pre-trained models line up
          meaning across modalities. ICPC regional medalist (silver &amp; bronze). I build backends
          when the experiments need somewhere to run.
        </p>
      </div>
    </div>
  </div>
);

export default HeroTerminal;
