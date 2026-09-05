import { useEffect, useState } from 'react';
import useReducedMotion from '../hooks/useReducedMotion';

// The header portrait alternates between the illustrated avatar and a photo.
// Both are rendered stacked rather than swapped into one <img>, so the second
// face is already decoded when its turn comes and the cross-fade never flashes.
const FACES = ['/avatar.png', '/self.jpg'];
const SWAP_MS = 5000;

const RotatingAvatar = ({ size = 112 }) => {
  const reducedMotion = useReducedMotion();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // Reduced motion keeps the first face rather than cycling; index.css
    // already neutralises the fade itself.
    if (reducedMotion) return undefined;
    const id = setInterval(() => setIdx((i) => (i + 1) % FACES.length), SWAP_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {FACES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          width={size}
          height={size}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1px solid var(--border-strong)',
            opacity: i === idx ? 1 : 0,
            transition: 'opacity 600ms ease'
          }}
        />
      ))}
    </div>
  );
};

export default RotatingAvatar;
