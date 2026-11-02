// A live update may replace public room fields, but never its season history.
export function mergeLiveRoom(current,patch){
 const view=patch?.view;
 if(!current||!view||patch.code!==current.code||view.code!==current.code||patch.seasonId!==current.season.id||patch.turn!==current.season.turn||patch.liveId!==current.broadcast?.id||view.broadcast?.id!==patch.liveId||view.me!==current.me||Object.hasOwn(view,'season')||!Number.isInteger(view.revision))return null;
 if(view.revision<current.revision)return current;
 return {...current,...view,season:current.season};
}
