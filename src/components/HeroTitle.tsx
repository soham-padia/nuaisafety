/**
 * The home page headline, revealed word by word with React Bits' SplitText.
 *
 * The server renders a plain <h1>, so the words are in the HTML for search
 * engines and for anyone without JavaScript. Once the island mounts, SplitText
 * takes over and animates them in. With reduced motion it stays plain.
 *
 * CSS keeps the plain heading invisible for the moment between first paint
 * and the split, so it does not flash, and a timed fallback in the same rule
 * shows it anyway if the split never happens.
 */
import { useEffect, useState } from 'react';
import SplitText from './reactbits/SplitText';

export default function HeroTitle({ text }: { text: string }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (!animate) return <h1 className="hero-title">{text}</h1>;

  return (
    <SplitText
      tag="h1"
      text={text}
      className="hero-title"
      textAlign="left"
      splitType="words"
      delay={70}
      duration={1.1}
      ease="power4.out"
      from={{ opacity: 0, y: 46, rotate: 2 }}
      to={{ opacity: 1, y: 0, rotate: 0 }}
      threshold={0}
      rootMargin="0px"
    />
  );
}
