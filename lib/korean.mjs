export function subjectName(name){
 const text=String(name??''),last=[...text].at(-1)||'',code=last.charCodeAt(0);
 const consonant=code>=0xAC00&&code<=0xD7A3?(code-0xAC00)%28!==0:!/[aeiou]$/i.test(last);
 return text+(consonant?'이':'가');
}
export function repairStaffSubjects(text){return String(text??'').replace(/(매니저|코치)이/g,'$1가');}
