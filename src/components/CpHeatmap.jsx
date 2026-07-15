import React, { useMemo } from 'react';

const WEEKS = 53;
const CELL = 11;
const GAP = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Buckets tuned to this repo's rhythm: a normal session lands 1-2 problems,
// a grind day lands 8+.
const LEVELS = [
  { min: 0, bg: 'rgba(69, 243, 255, 0.04)', border: 'rgba(69, 243, 255, 0.12)' },
  { min: 1, bg: 'rgba(69, 243, 255, 0.25)', border: 'rgba(69, 243, 255, 0.3)' },
  { min: 3, bg: 'rgba(69, 243, 255, 0.45)', border: 'rgba(69, 243, 255, 0.5)' },
  { min: 5, bg: 'rgba(69, 243, 255, 0.7)', border: 'rgba(69, 243, 255, 0.75)' },
  { min: 8, bg: 'var(--accent-primary)', border: 'var(--accent-primary)' },
];

const levelFor = (count) => {
  let level = LEVELS[0];
  for (const l of LEVELS) if (count >= l.min) level = l;
  return level;
};

// Local-time YYYY-MM-DD, matching the UTC-dated keys in stats.json closely
// enough for a day-resolution grid.
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function buildGrid(activity) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // End on the Saturday of the current week so the final column is complete.
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - today.getDay()));
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (WEEKS * 7 - 1));

  const weeks = [];
  const months = [];
  let lastMonth = -1;
  let windowTotal = 0;

  for (let w = 0; w < WEEKS; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const key = iso(cursor);
      const count = activity[key] ?? 0;
      const future = cursor > today;
      if (!future) windowTotal += count;
      days.push({ key, count, future });

      // Label a column when its first day opens a new month.
      if (d === 0 && cursor.getMonth() !== lastMonth) {
        lastMonth = cursor.getMonth();
        months.push({ week: w, label: MONTHS[lastMonth] });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return { weeks, months, windowTotal };
}

const CpHeatmap = ({ activity }) => {
  const { weeks, months, windowTotal } = useMemo(() => buildGrid(activity ?? {}), [activity]);
  const colWidth = CELL + GAP;

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
        <span style={{ color: 'var(--accent-primary)' }}>{windowTotal}</span> problems solved in the past 12 months
        <span style={{ margin: '0 0.5rem' }}>·</span>
        each square is one day
      </p>

      <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'inline-block', minWidth: 'min-content' }}>
          {/* Month ruler */}
          <div style={{ position: 'relative', height: '16px', marginLeft: `${CELL * 2 + GAP}px` }}>
            {months.map(({ week, label }) => (
              <span
                key={`${label}-${week}`}
                style={{
                  position: 'absolute',
                  left: `${week * colWidth}px`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--text-dim)',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: `${GAP}px` }}>
            {/* Weekday ruler */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, marginRight: '2px' }}>
              {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
                <span
                  key={i}
                  style={{
                    height: `${CELL}px`,
                    width: `${CELL * 2}px`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    lineHeight: `${CELL}px`,
                    color: 'var(--text-dim)',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {weeks.map((days, w) => (
              <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                {days.map((day) => {
                  if (day.future) {
                    return <div key={day.key} style={{ width: `${CELL}px`, height: `${CELL}px` }} />;
                  }
                  const level = levelFor(day.count);
                  return (
                    <div
                      key={day.key}
                      title={`${day.count === 0 ? 'No problems' : `${day.count} problem${day.count > 1 ? 's' : ''}`} on ${day.key}`}
                      style={{
                        width: `${CELL}px`,
                        height: `${CELL}px`,
                        borderRadius: '2px',
                        background: level.bg,
                        border: `1px solid ${level.border}`,
                        boxShadow: day.count >= 8 ? '0 0 6px var(--accent-primary)' : 'none',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: `${GAP}px`,
              marginTop: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ marginRight: '0.25rem' }}>Less</span>
            {LEVELS.map((level) => (
              <div
                key={level.min}
                style={{
                  width: `${CELL}px`,
                  height: `${CELL}px`,
                  borderRadius: '2px',
                  background: level.bg,
                  border: `1px solid ${level.border}`,
                }}
              />
            ))}
            <span style={{ marginLeft: '0.25rem' }}>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CpHeatmap;
