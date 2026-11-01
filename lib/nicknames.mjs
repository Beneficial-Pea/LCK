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
// Stable, separate aliases for overseas slots; no team or role appended.
const INTERNATIONAL_TEAMS='AL BLG TES JDG IG WBG LNG NIP EDG OMG TT FPX UP WE G2 KC MKOI FNC VIT GX SK BDS TH NAVI C9 TLAW LYON SEN FLY TL 100T DSG SR DIG CFO TSW DCG GAM PSG TS DFM SHG MVK MVKE VKE FUR LOS PNG RED LOUD PAIN VKS KBM FX R7 SHG DFM CFO GAM'.split(' ').filter((t,i,a)=>a.indexOf(t)===i);
const ALIAS_STARTS='Ae Be Ce De Eo Fe Ga He Io Je Ka Le Me No Oe Pe Qi Re Se Te Ue Va We Xe Ye Ze'.split(' ');
const ALIAS_ENDS='ris lan vor lin ros vin ral mon dor vel lun ren mir tor rin nex'.split(' ');
const internationalAliases=ALIAS_STARTS.flatMap(start=>ALIAS_ENDS.map(end=>start+end));
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
  const slot=INTERNATIONAL_TEAMS.indexOf(team);
  return internationalAliases[(slot>=0?slot*5+index:hash(`${team}:${position}`))%internationalAliases.length];
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
  for (const name of [...Object.keys(ALIASES),...INTERNATIONAL_TEAMS]) for (const position of POSITIONS) add(name, position);
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

export const INTERNATIONAL_NPC_TEAMS=Object.freeze([...INTERNATIONAL_TEAMS]);
