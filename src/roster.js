// The pool of named characters players can pick from on the start screen.
// hairStyle is one of: 'buzz' | 'short' | 'bald' | 'quiff' | 'mid' | 'long'.
export const ROSTER = [
  { id: 'henoch', name: 'Henoch', hairStyle: 'buzz', hairColor: 0x9a9a9a, outfit: 0xff006c },
  { id: 'marc', name: 'Marc', hairStyle: 'short', hairColor: 0xd8b978, outfit: 0x141480 },
  { id: 'mark', name: 'Mark', hairStyle: 'short', hairColor: 0xd8b978, outfit: 0x141480, glasses: true },
  { id: 'danny', name: 'Danny', hairStyle: 'short', hairColor: 0xd8b978, outfit: 0x141480 },
  { id: 'tim', name: 'Tim', hairStyle: 'bald', hairColor: 0x000000, outfit: 0x141480 },
  { id: 'simon', name: 'Simon', hairStyle: 'short', hairColor: 0x2b1c14, outfit: 0xf15a24 },
  { id: 'remco', name: 'Remco', hairStyle: 'quiff', hairColor: 0x2b1c14, outfit: 0xf15a24 },
  { id: 'pally', name: 'Pally', hairStyle: 'short', hairColor: 0x6b4a2a, outfit: 0x141480, glasses: true },
  { id: 'suze', name: 'Suze', hairStyle: 'long', hairColor: 0xd8b978, outfit: 0xf15a24, female: true },
  { id: 'maud', name: 'Maud', hairStyle: 'long', hairColor: 0x6b4a2a, outfit: 0xff006c, female: true },
  { id: 'tom', name: 'Tom', hairStyle: 'short', hairColor: 0x8a6b3f, outfit: 0xf15a24 },
  { id: 'ebel', name: 'Ebel', hairStyle: 'mid', hairColor: 0x6b5636, outfit: 0xf15a24, glasses: true, beard: true },
  { id: 'gita', name: 'Gita', hairStyle: 'mid', hairColor: 0xd8b978, outfit: 0xf15a24, female: true },
];

// Used for a player who types their own name instead of picking a roster
// character (and as the idle placeholder look before a match is configured).
export const DEFAULT_APPEARANCE = { hairStyle: 'short', hairColor: 0x3d2b1f, outfit: 0x2255cc };

export function rosterById(id) {
  return ROSTER.find((r) => r.id === id) || null;
}
