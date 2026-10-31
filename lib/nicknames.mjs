// Fictional NPC aliases. One distinct alias for each LCK team/position slot.
const POSITIONS = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const ALIASES = {
  T1: ['Ravel', 'Vektor', 'Coda', 'Lucent', 'Stitch'],
  'Gen.G': ['Ilex', 'Rooke', 'Neven', 'Vellum', 'Sigil'],
  HLE: ['Bracken', 'Flintor', 'Sonnet', 'Dextra', 'Wicket'],
  DK: ['Kestrel', 'Talonex', 'Notch', 'Vespern', 'Aegix'],
  KT: ['Cairn', 'Tessel', 'Quaver', 'Opaline', 'Pollen'],
  BNK: ['Harrow', 'Runnel', 'Morrow', 'Gleam', 'Tinct'],
  DRX: ['Ternox', 'Brindle', 'Serein', 'Glintor', 'Kindle'],
  NS: ['Oaken', 'Ferrum', 'Sablet', 'Lumenix', 'Tallow'],
  DNF: ['Kairox', 'Mossen', 'Helion', 'Velour', 'Lattice'],
  BRO: ['Orlin', 'Crestin', 'Nacre', 'Fablet', 'Thimble'],
};
const INTERNATIONAL_WORDS = ['Aster', 'Oriel', 'Mistral', 'Petrel', 'Vireo', 'Trellis', 'Brume', 'Cobalt', 'Clover', 'Tundra'];
const POSITION_WORDS = ['Top', 'Jungle', 'Mid', 'Carry', 'Support'];

export function normalizeNickname(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF\s]/gu, '').toLocaleLowerCase('en-US');
}

export function hasNicknameCollision(players, nickname, exceptUserId = null) {
  const normalized = normalizeNickname(nickname);
  return Boolean(normalized) && (players || []).some(player =>
    (exceptUserId == null || player.userId !== exceptUserId) &&
    normalizeNickname((player.character || player).nickname) === normalized
  );
}

function hash(value) {
  let n = 2166136261;
  for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}

export function npcNickname(team, position) {
  const index = Math.max(0, POSITIONS.indexOf(position));
  if (ALIASES[team]) return ALIASES[team][index];
  if (!team || team === '대기실') return `Reserve${POSITION_WORDS[index]}`;
  const token = String(team).normalize('NFKC').replace(/[^A-Za-z0-9]/g, '') || hash(team).toString(36);
  return `${INTERNATIONAL_WORDS[hash(team) % INTERNATIONAL_WORDS.length]}${token}${POSITION_WORDS[index]}`;
}

// Allocate the complete known NPC universe in a fixed order, reserving human
// names first. A human never gets silently renamed if they choose an NPC alias.
// Projection is non-mutating: completed historical records retain old names.
export function ensureRosterNicknames(room, players = [], team = null) {
  const humans = room?.players || [];
  const humanIds = new Set(humans.map(player => player.character.id));
  const reserved = new Set(humans.map(player => normalizeNickname(player.character.nickname)).filter(Boolean));
  const npcs = new Map();
  const add = (name, position, id = `npc:${name}:${position}`) => {
    if (!humanIds.has(id)) npcs.set(id, { id, team: name, position });
  };
  for (const name of Object.keys(ALIASES)) for (const position of POSITIONS) add(name, position);
  for (const profile of room?.season?.opponents || []) {
    for (const player of profile.players || []) if (player.npc || player.generatedNpc || /^npc:/.test(String(player.id))) {
      add(player.team || profile.name, player.position, player.id);
    }
  }
  const names = new Set();
  for (const match of room?.season?.schedule || []) for (const name of [match.teamA, match.teamB]) if (name) names.add(name);
  if (team) names.add(team);
  for (const name of names) for (const position of POSITIONS) add(name, position);
  for (const player of players) if (!humanIds.has(player.id) && (player.npc || player.generatedNpc || /^npc:/.test(String(player.id)))) {
    add(player.team || team, player.position, player.id);
  }

  const assigned = new Map();
  for (const npc of [...npcs.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    const base = npcNickname(npc.team, npc.position);
    let nickname = base, sequence = 1;
    while (reserved.has(normalizeNickname(nickname))) nickname = `${base}V${sequence++}`;
    reserved.add(normalizeNickname(nickname)); assigned.set(npc.id, nickname);
  }
  return players.map(player => {
    const nickname = assigned.get(player.id);
    return nickname ? { ...player, nickname, npc: true, generatedNpc: true } : { ...player };
  });
}

export const LCK_NPC_ALIASES = Object.freeze(Object.fromEntries(Object.entries(ALIASES).map(([team, names]) => [team, Object.freeze([...names])])));
