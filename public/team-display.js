// Team keys in saved seasons stay stable. This presentation adapter also covers
// older game text and components which still render the saved DRX identifier.
export function teamDisplayText(value,year=2026){
 const text=String(value??'');if(Number(year)!==2026)return text;
 return text.replace(/KIWOOM\s+DRX|키움\s+DRX|\bDRX\b/g,match=>match==='DRX'?'KRX':match);
}
export function normalizeTeamDisplay(root,year=2026,players=[]){
 if(!root||Number(year)!==2026)return;
 const document=root.ownerDocument;
 const protectedNames=new Set(players.flatMap(p=>{
  const c=p.character||p;
  return [c.nickname,c.name,p.ownerName,c.team&&c.nickname?`${teamDisplayText(c.team,year)} ${c.nickname}`:null].filter(Boolean);
 }));
 const skip='script,style,textarea,[contenteditable],.message-text,[role="log"] p,.notice-copy,[data-authored-text]';
 const walker=document.createTreeWalker(root,4);const texts=[];let node;
 while((node=walker.nextNode()))texts.push(node);
 for(const text of texts){
  if(text.parentElement?.closest(skip)||protectedNames.has(text.nodeValue))continue;
  // Editing a select label must never change its implicit submitted value.
  const option=text.parentElement?.closest('option');
  const formatted=teamDisplayText(text.nodeValue,year);
  if(formatted===text.nodeValue)continue;
  if(option&&!option.hasAttribute('value'))option.value=option.value;
  text.nodeValue=formatted;
 }
 for(const el of root.querySelectorAll('[aria-label],[title]')){
  if(el.closest(skip))continue;
  for(const key of ['aria-label','title'])if(el.hasAttribute(key))el.setAttribute(key,teamDisplayText(el.getAttribute(key),year));
 }
}
