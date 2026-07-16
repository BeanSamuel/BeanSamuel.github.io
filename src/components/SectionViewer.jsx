
const SectionViewer = ({ title, children }) => {
  return (
    <div className="terminal-window section-viewer">
      <div className="terminal-header">
        <div className="window-controls">
          <div className="control"></div>
          <div className="control"></div>
          <div className="control"></div>
        </div>
        <div className="window-title">~/portfolio/{title.toLowerCase().replace(/\s+/g, '_')}</div>
      </div>
      <div className="terminal-body" style={{ padding: '2rem' }}>
        <h2>{title}</h2>
        <div className="section-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SectionViewer;
