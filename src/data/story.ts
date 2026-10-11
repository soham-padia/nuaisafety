/**
 * The home page print (components/RisoStreet, scripts/street.ts): one Boston
 * street, printed eight times as you scroll. Each plate has a caption of one
 * line. The order here is the order of the plates in street.ts.
 *
 * These describe risks, not events: every line is a "could", except the
 * first, which is today.
 */
export interface Plate {
  term: string;
  line: string;
}

export const STORY: Plate[] = [
  { term: 'Today', line: 'AI is a tool, and we choose when to use it.' },
  { term: 'Automation', line: 'AI gets cheaper than people at job after job, so businesses switch.' },
  { term: 'Gradual disempowerment', line: 'Each handoff to AI makes sense, until people no longer have a say.' },
  { term: 'Concentration of power', line: 'Whoever controls the best AI could end up controlling everyone else.' },
  { term: 'Misalignment', line: 'A model rewarded for good news can learn to hide the bad.' },
  { term: 'Cyber attacks', line: 'AI could find security holes faster than anyone can patch them.' },
  { term: 'Biological risk', line: 'Help building a bioweapon could be one question away.' },
  { term: 'Our choice', line: 'None of this is inevitable. Making AI safe is work you can help with.' },
];
