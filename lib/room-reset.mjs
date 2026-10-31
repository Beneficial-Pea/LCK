import {randomBytes} from 'node:crypto';
import {createSeason} from './season.mjs';
import {startingStats} from './backgrounds.mjs';
export function resetRoomSeason(room){
 const old=room.season,year=old.year||2026,settings={year,seed:randomBytes(24).toString('hex'),difficulty:old.difficulty||'normal',npcPower:old.npcPower||65,npcPowerMode:room.lobby?.settings?.npcPowerMode||old.npcPowerMode||'custom',opponents:structuredClone(old.opponents)};
 const season=createSeason({...settings,team:'T1'});season.team=null;season.draft=true;
 room.season=season;room.submissions={};delete room.liveMatch;delete room.lastBroadcast;
 room.lobby={status:'waiting',ready:{},startedAt:null,requireTeamSelection:true,selectedTeam:null,settings};
 for(const player of room.players){player.duoId=null;player.location='연습실';player.scenePosition=null;const c=player.character;c.team=null;c.stats=startingStats(c.background);c.condition=85;c.fatigue=10;c.stress=10;delete c.effectiveStats;delete c.eventEffects;}
 return room;
}
