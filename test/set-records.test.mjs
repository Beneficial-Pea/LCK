import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateSeries} from '../lib/match.mjs';
import {setSides,renderSetScoreboard,renderSetDraft} from '../public/set-records.js';
const input={teamA:{name:'A'},teamB:{name:'B'},bestOf:5,seed:'per-set-sides'};
test('each new set records actual first pick and side rights; following sets use the previous loser',()=>{
 for(const selectionRight of [false,true]){
  const result=simulateSeries({...input,selectionRight});
  for(const [index,set] of result.sets.entries()){
   const a=set.draft.assignment,chooser=index?(result.sets[index-1].winner==='A'?'B':'A'):'A',other=chooser==='A'?'B':'A';
   assert.equal(a.firstPickTeam,chooser);assert.equal(a.blueTeam,selectionRight?other:chooser);assert.equal(a.redTeam,selectionRight?chooser:other);assert.equal(a.sideChoiceTeam,a.blueTeam);assert.equal(a.firstPickChoiceTeam,selectionRight?chooser:null);
   assert.equal(a.mode,selectionRight?'rofs':'side');assert.notEqual(a.blueTeam,a.redTeam);
   const html=renderSetScoreboard(set,{teamA:'A',teamB:'B'});assert.equal((html.match(/<tbody>/g)||[]).length,2);assert.equal((html.match(/<tr>/g)||[]).length,12);assert(html.includes('블루팀'));assert(html.includes('레드팀'));assert(html.includes('퍼스트픽 선택권'));
  }
 }
});
test('old drafts retain recorded order and report missing rights without inventing a prior choice',()=>{
 const result=simulateSeries({...input,draftVersion:0});for(const set of result.sets){assert(!set.draft.assignment);const sides=setSides(set,{teamA:'A',teamB:'B'});assert.equal(sides.blueTeam,'A');assert.equal(sides.sideChoiceTeam,null);assert(renderSetScoreboard(set,{teamA:'A',teamB:'B'}).includes('기록 없음'));}
});
test('split scoreboard and draft escape labels, keep team rows separate and preserve zero KDA',()=>{
 const set={number:2,draft:{assignment:{version:1,blueTeam:'B',redTeam:'A',sideChoiceTeam:'B',firstPickChoiceTeam:'A',firstPickTeam:'A'},picksA:[{nickname:'<script>',champion:'<img>',position:'MID'}]},scoreboard:[{team:'A',nickname:'<script>',position:'MID',champion:'<img>',k:0,d:1,a:0},{team:'B',nickname:'B-mid',position:'MID',champion:'아리',k:1,d:0,a:0}]};
 for(const html of [renderSetScoreboard(set,{teamA:'A',teamB:'B'}),renderSetDraft(set,{teamA:'A',teamB:'B'})]){assert(!html.includes('<script>'));assert(!html.includes('<img>'));assert(html.includes('&lt;script&gt;'));}
 const html=renderSetScoreboard(set,{teamA:'A',teamB:'B'});assert(html.indexOf('B-mid')<html.indexOf('&lt;script&gt;'));assert(html.includes('0 / 1 / 0'));
});

test('top series score follows selected set sides and carries each team score with it',async()=>{
 const {renderSeriesScore}=await import('../public/set-records.js');const match={teamA:'Gen.G',teamB:'DNF'},set={draft:{assignment:{version:1,blueTeam:'DNF',redTeam:'Gen.G'}}};
 const html=renderSeriesScore(set,match,{scoreA:2,scoreB:0});assert(html.indexOf('DNF')<html.indexOf('Gen.G'));assert(html.includes('data-series-blue-score>0'));assert(html.includes('data-series-red-score>2'));
 const legacy=renderSeriesScore({},match,{scoreA:2,scoreB:0});assert(legacy.includes('data-series-blue-score>2'));assert(legacy.includes('data-series-red-score>0'));
});
