export function championComfort(player,champion,{version=1}={}){
 if(champion===player.mainChampion)return {kind:'signature',bonusPercent:version===0?3.5:6};
 if(player.pool?.includes(champion))return {kind:'main',bonusPercent:version===0?0:3};
 return {kind:'off-pool',bonusPercent:-6};
}
