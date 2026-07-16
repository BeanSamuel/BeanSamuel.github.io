import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The CSS rule in index.css only neutralises transitions and CSS animations.
 * Anything driven by a JS timer — the terminal's line reveal, the typing
 * headline — has to opt out itself, which is what this is for.
 *
 * @returns {boolean} true when the visitor asked for reduced motion.
 */
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
