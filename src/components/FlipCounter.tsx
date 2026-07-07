import { useEffect, useState, useRef } from 'react';

function FlipDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (prevDigit !== digit) {
      setFlipping(true);
      const timer = setTimeout(() => setFlipping(false), 400);
      return () => clearTimeout(timer);
    }
  }, [digit, prevDigit]);

  return (
    <div className="relative w-[0.55em] h-[0.9em]">
      <div
        className={`absolute inset-0 rounded-[0.06em] flex items-center justify-center text-[0.9em] font-bold leading-none ${
          flipping ? 'animate-flip-down' : ''
        }`}
        style={{
          background: 'linear-gradient(180deg, #2a2a3e 0%, #1e1e32 50%, #16162a 100%)',
          color: '#f0e6b0',
          fontFamily: "'Georgia', serif",
          boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          textShadow: '0 0 8px rgba(240,230,176,0.3)',
          border: '1px solid rgba(240,230,176,0.15)',
        }}
      >
        <span className="relative">{digit}</span>
      </div>
      <style>{`
        @keyframes flip-down {
          0% { transform: rotateX(0deg) scaleY(1); }
          50% { transform: rotateX(-90deg) scaleY(0.8); opacity: 0.5; }
          100% { transform: rotateX(0deg) scaleY(1); }
        }
        .animate-flip-down {
          animation: flip-down 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}

export function FlipCounter({ value, label, prefix }: { value: number; label?: string; prefix?: string }) {
  const prevRef = useRef(value);
  const digits = String(Math.floor(value)).split('');
  const prevDigits = String(Math.floor(prevRef.current)).split('');

  useEffect(() => {
    prevRef.current = value;
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[10px] text-white/50 font-semibold tracking-[0.15em] uppercase">{label}</span>
      )}
      <div
        className="flex items-center gap-[1px] px-3 py-1.5 rounded-lg"
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)',
          border: '1px solid rgba(240,230,176,0.2)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {prefix && (
          <span className="text-[0.75em] font-bold mr-1" style={{ color: '#f0e6b0', textShadow: '0 0 6px rgba(240,230,176,0.3)' }}>
            {prefix}
          </span>
        )}
        {digits.map((d, i) => (
          <FlipDigit key={`${i}-${d}`} digit={d} prevDigit={prevDigits[i] || '0'} />
        ))}
      </div>
    </div>
  );
}
