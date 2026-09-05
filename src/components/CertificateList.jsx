import { useCallback, useEffect, useRef, useState } from 'react';

// List where an entry carrying an `image` opens the scanned certificate in a
// lightbox. Entries without one stay plain text — the list has to survive a
// partially scanned collection, so the image is always optional. `label` names
// the document type, since this backs both awards (獎狀) and teaching
// certificates (證書).

const itemStyle = {
  marginBottom: '1rem',
  color: 'var(--text-main)'
};

const yearStyle = {
  color: 'var(--accent-primary)',
  marginLeft: '1rem',
  fontSize: '0.9rem',
  fontFamily: 'var(--font-mono)'
};

// Strips the button back to list-item text; only the underline and the trailing
// marker say it opens something.
const triggerStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: '#fff',
  fontWeight: 500,
  textAlign: 'left',
  cursor: 'pointer',
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textDecorationColor: 'var(--border-strong)',
  textUnderlineOffset: '0.25em'
};

const Lightbox = ({ award, label, onClose }) => {
  const closeRef = useRef(null);
  // Paths are wired ahead of the scans, so a 404 is an expected state.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // Page behind the overlay must not scroll while it is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={award.title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1rem',
        padding: '2rem 1rem',
        background: 'rgba(6,8,12,0.88)',
        backdropFilter: 'blur(3px)'
      }}
    >
      <button
        ref={closeRef}
        onClick={onClose}
        className="cyber-btn"
        style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
      >
        [ CLOSE ]
      </button>

      {/* Clicks on the certificate itself must not fall through to the backdrop. */}
      {failed ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '3rem 2rem',
            border: '1px dashed var(--border-strong)',
            borderRadius: '4px',
            background: 'var(--panel-bg)',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}
        >
          {label}掃描檔尚未上傳
          <div style={{ marginTop: '0.5rem', color: 'var(--border-strong)', fontSize: '0.75rem' }}>
            {award.image}
          </div>
        </div>
      ) : (
        <img
          src={award.image}
          alt={`${award.title} ${label}`}
          onError={() => setFailed(true)}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 'min(100%, 900px)',
            maxHeight: '78vh',
            objectFit: 'contain',
            border: '1px solid var(--border-strong)',
            borderRadius: '4px',
            background: 'var(--panel-bg)'
          }}
        />
      )}

      <div style={{ textAlign: 'center', maxWidth: '900px' }}>
        <div style={{ color: '#fff', fontSize: '0.95rem' }}>{award.title}</div>
        {award.year && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
            [{award.year}]
          </div>
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
        Esc 或點擊背景關閉
      </div>
    </div>
  );
};

const CertificateList = ({ data, label = '獎狀' }) => {
  const [openIdx, setOpenIdx] = useState(null);
  // Focus goes back to the award that opened the lightbox, not to the top.
  const triggerRefs = useRef({});

  const close = useCallback(() => {
    const idx = openIdx;
    setOpenIdx(null);
    triggerRefs.current[idx]?.focus();
  }, [openIdx]);

  return (
    <div>
      <ul style={{ listStyleType: 'square', paddingLeft: '1.5rem' }}>
        {data.map((item, idx) => (
          <li key={idx} style={itemStyle}>
            {item.image ? (
              <button
                ref={(el) => { triggerRefs.current[idx] = el; }}
                onClick={() => setOpenIdx(idx)}
                style={triggerStyle}
                onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'var(--border-strong)'; }}
              >
                {item.title}
                <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                  [ {label} ]
                </span>
              </button>
            ) : (
              <span style={{ color: '#fff', fontWeight: 500 }}>{item.title}</span>
            )}
            {item.year && <span style={yearStyle}>[{item.year}]</span>}
          </li>
        ))}
      </ul>

      {openIdx !== null && <Lightbox award={data[openIdx]} label={label} onClose={close} />}
    </div>
  );
};

export default CertificateList;
