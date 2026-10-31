export const INTERVIEW_CHOICES=[{id:'team',label:'팀원들의 도움 덕분입니다.',reply:'서로 콜을 믿어 준 게 가장 컸어요. 다음 경기도 함께 준비하겠습니다.',reaction:'팀원들이 인터뷰를 보고 고개를 끄덕였다.',stat:'communication',stress:-1},{id:'confident',label:'중요한 순간 제가 해낼 자신이 있었습니다.',reply:'준비한 장면이라 주저하지 않았어요. 더 좋은 경기로 보여드리겠습니다.',reaction:'팬들 사이에서 당당한 답변이 화제가 됐다.',stat:'mental',stress:1},{id:'review',label:'준비한 전략이 잘 맞아떨어졌습니다.',reply:'연습 때 확인한 동선과 타이밍을 지키려 했어요. 부족한 장면은 다시 복기하겠습니다.',reaction:'분석관이 오늘 준비한 내용을 인터뷰 노트에 남겼다.',stat:'macro',stress:-1}];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function answerInterview(room,id,choice,userId,automatic=false){
 const entry=room.season.interviews?.find(e=>e.id===id);if(!entry||entry.status!=='pending')fail(409,'이미 답변했거나 종료된 인터뷰입니다.');
 if(!automatic&&entry.userId!==userId)fail(403,'수훈선수 본인만 인터뷰에 답할 수 있습니다.');
 const answer=INTERVIEW_CHOICES.find(c=>c.id===choice);if(!answer)fail(400,'인터뷰 답변을 선택하세요.');
 entry.status='answered';entry.choice=choice;entry.answer=answer.reply;entry.reaction=answer.reaction;entry.automatic=automatic;
 const player=room.players.find(p=>p.userId===entry.userId);if(player){player.character.stats[answer.stat]=Math.min(99,player.character.stats[answer.stat]+.2);player.character.stress=Math.max(0,Math.min(100,player.character.stress+answer.stress));}
 room.season.history.unshift({id:id+'-answer',date:room.season.date,turn:room.season.turn,type:'pom-interview',text:`${entry.nickname} POM 인터뷰: “${answer.reply}” ${answer.reaction}`});return entry;
}
export function expireInterviews(room){for(const entry of room.season.interviews||[])if(entry.status==='pending')answerInterview(room,entry.id,'team',null,true);}
export function queueInterview(room,match,result){
 const s=room.season,pom=result.pom;if(!pom||![match.teamA,match.teamB].includes(s.team))return;
 s.interviews??=[];const id='interview-'+match.id;if(s.interviews.some(e=>e.id===id))return;
 const player=room.players.find(p=>p.character.id===pom.playerId&&pom.team===s.team);
 s.interviews.push({id,matchId:match.id,date:match.date,team:pom.team,nickname:pom.nickname,position:pom.position,userId:player?.userId||null,status:'pending',question:`${match.stage} ${match.round} 수훈선수로 선정됐습니다. 오늘 승리의 원동력은 무엇인가요?`});
 if(!player)answerInterview(room,id,'review',null,true);
 if(s.interviews.length>60)s.interviews=s.interviews.slice(-60);
}
