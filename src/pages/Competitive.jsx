import React from 'react';
import { FaGithub, FaTrophy, FaBolt, FaSyncAlt } from 'react-icons/fa';
import SectionViewer from '../components/SectionViewer';
import CpHeatmap from '../components/CpHeatmap';
import useCpStats from '../hooks/useCpStats';
import { competitiveHighlights, cppPracticeRepo } from '../data/resumeData';

const REPO_URL = `https://github.com/${cppPracticeRepo}`;
const BAR_COLORS = ['var(--accent-primary)', 'var(--accent-secondary)', 'var(--accent-tertiary)'];

const StatTile = ({ label, value, sub }) => (
  <div
    style={{
      background: 'rgba(0,0,0,0.5)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1.1rem 1rem',
      textAlign: 'left',
    }}
  >
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '1.75rem',
        fontWeight: 700,
        color: 'var(--accent-primary)',
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: 'var(--text-dim)',
        marginTop: '0.35rem',
      }}
    >
      {label}
    </div>
    {sub && (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', opacity: 0.7 }}>
        {sub}
      </div>
    )}
  </div>
);

const Bar = ({ label, count, max, color, blurb, url }) => (
  <div style={{ marginBottom: '1rem' }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '1rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9rem',
        marginBottom: '0.35rem',
      }}
    >
      <span style={{ color: 'var(--text-main)' }}>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ) : (
          label
        )}
      </span>
      <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{count}</span>
    </div>
    <div style={{ height: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.max((count / max) * 100, 2)}%`,
          height: '100%',
          background: color,
          boxShadow: `0 0 8px ${color}`,
          transition: 'width 0.6s ease',
        }}
      />
    </div>
    {blurb && (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
        {blurb}
      </div>
    )}
  </div>
);

const Competitive = () => {
  const { stats, status } = useCpStats();
  const { totals, sources, cses, activity, recent } = stats;

  const maxSource = Math.max(...sources.map((s) => s.count), 1);
  const maxCses = Math.max(...cses.categories.map((c) => c.count), 1);

  return (
    <div>
      <SectionViewer title="Competitive Programming">
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginBottom: '1.5rem', color: 'var(--text-dim)' }}>
          Every solution I write while practising gets pushed to{' '}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            {cppPracticeRepo}
          </a>
          . These numbers are counted straight out of that repo and refresh themselves on every push — nothing here is
          typed by hand.
        </p>

        <div
          style={{
            display: 'grid',
            // 240px keeps the six tiles on a 3x2 grid at full width instead of
            // stranding one on a row of its own, and still collapses on mobile.
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <StatTile label="Problems Solved" value={`${totals.headline}+`} sub={`${totals.problems} files`} />
          <StatTile label="Judges" value={totals.sourceCount} sub="& contest archives" />
          <StatTile label="Active Days" value={totals.activeDays} sub={`since ${totals.firstDate}`} />
          <StatTile label="Longest Streak" value={`${totals.longestStreak}d`} sub={`current ${totals.currentStreak}d`} />
          <StatTile label="Commits" value={totals.commits} sub="of regret" />
          <StatTile label="Templates" value={totals.templates} sub="battle-tested" />
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: 'var(--accent-secondary)',
            marginBottom: '1rem',
          }}
        >
          <FaBolt style={{ verticalAlign: '-2px' }} /> Where the problems come from
        </h3>
        {sources.map((source, i) => (
          <Bar
            key={source.key}
            label={`${source.emoji} ${source.name}`}
            count={source.count}
            max={maxSource}
            color={BAR_COLORS[i % BAR_COLORS.length]}
            blurb={source.blurb}
            url={source.url}
          />
        ))}
      </SectionViewer>

      <SectionViewer title="Contest Results">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {competitiveHighlights.map((item) => (
            <div
              key={item.title}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: `1px solid ${item.color}`,
                borderRadius: '8px',
                padding: '1.2rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <FaTrophy style={{ color: item.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  {item.year}
                </span>
              </div>
              <div style={{ color: '#fff', fontSize: '0.95rem', lineHeight: 1.4 }}>{item.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: item.color, marginTop: '0.4rem' }}>
                {item.result}
              </div>
            </div>
          ))}
        </div>
      </SectionViewer>

      <SectionViewer title="Practice Activity">
        <CpHeatmap activity={activity} />
      </SectionViewer>

      <SectionViewer title="CSES Progress">
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
          <span style={{ color: 'var(--accent-primary)' }}>{cses.total}</span> problems across{' '}
          {cses.categories.length} categories of the{' '}
          <a href="https://cses.fi/problemset/" target="_blank" rel="noopener noreferrer">
            CSES problem set
          </a>
          .
        </p>
        {cses.categories.map((cat, i) => (
          <Bar
            key={cat.name}
            label={cat.name}
            count={cat.count}
            max={maxCses}
            color={BAR_COLORS[i % BAR_COLORS.length]}
          />
        ))}
      </SectionViewer>

      <SectionViewer title="Recent Solves">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recent.map((item) => (
            <a
              key={`${item.sha}-${item.path}`}
              href={`${REPO_URL}/blob/main/${item.path}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.25rem',
                borderBottom: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-main)',
              }}
            >
              <span style={{ flexShrink: 0 }}>{item.emoji}</span>
              <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>{item.problem}</span>
              <span style={{ color: 'var(--text-dim)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.category === item.sourceName ? item.sourceName : `${item.sourceName} · ${item.category}`}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', flexShrink: 0 }}>{item.date}</span>
            </a>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            marginTop: '1.5rem',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            <FaSyncAlt style={{ verticalAlign: '-1px', marginRight: '0.35rem' }} />
            {status === 'live'
              ? `Live from ${cppPracticeRepo} · generated ${stats.generatedAt}`
              : status === 'loading'
              ? 'Syncing with GitHub…'
              : `Cached snapshot · generated ${stats.generatedAt}`}
          </span>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="cyber-btn">
            <FaGithub /> Browse the repo
          </a>
        </div>
      </SectionViewer>
    </div>
  );
};

export default Competitive;
