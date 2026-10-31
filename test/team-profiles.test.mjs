import test from 'node:test';
import assert from 'node:assert/strict';
import calendar from '../data/calendar-2026.json' with { type: 'json' };
import { TEAM_PROFILES, TEAM_PROFILE_BASIS, defaultOpponentSettings } from '../lib/team-profiles.mjs';

test('2026 presets use archived completed results and disclose their conversion', () => {
  assert.equal(TEAM_PROFILE_BASIS.referenceYear, 2026);
  assert.equal(TEAM_PROFILE_BASIS.source.primaryVerified, false);
  assert.match(TEAM_PROFILE_BASIS.source.commit, /^[a-f0-9]{40}$/);
  const completed = calendar.domestic.filter(m => m.completed && m.score && m.score[0] !== m.score[1] && m.date <= '2026-10-31');
  assert.equal(TEAM_PROFILES.reduce((sum, p) => sum + p.record.played, 0), completed.length * 2);
  for (const profile of TEAM_PROFILES) {
    assert.equal(profile.record.wins + profile.record.losses, profile.record.played);
    assert.equal(profile.power, profile.record.power);
    assert(profile.power >= 55 && profile.power <= 95);
    assert.match(profile.basis, /2026 LCK/);
  }
  assert(TEAM_PROFILES.find(p => p.name === 'Gen.G').power > TEAM_PROFILES.find(p => p.name === 'DNF').power);
  assert.equal(TEAM_PROFILES.find(p => p.name === 'DNF').fullName, 'DN SOOPers');
});

test('editable opponent defaults are detached from the factual preset', () => {
  const settings = defaultOpponentSettings();
  const previous = TEAM_PROFILES[0].power;
  settings[0].power = 35;
  assert.equal(TEAM_PROFILES[0].power, previous);
  assert.equal(defaultOpponentSettings()[0].power, previous);
});
