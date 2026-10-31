import {DatabaseSync,backup} from 'node:sqlite';
import {statSync,existsSync,mkdirSync,mkdtempSync,chmodSync,linkSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';

const tables=['users','accounts','rooms','messages','auth_sessions','invitations','notices'];
function sourceFile(filename){
 const file=path.resolve(filename);if(!existsSync(file)||!statSync(file).isFile())throw new Error('원본 DB 파일이 없습니다. 저장 경로를 확인하세요.');
 return realpathSync(file);
}
function inspectConnection(db){
 const checks=db.prepare('PRAGMA quick_check').all();if(checks.length!==1||Object.values(checks[0])[0]!=='ok')throw new Error('DB 무결성 검사를 통과하지 못했습니다.');
 const names=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 if(!['users','rooms','messages'].every(name=>names.has(name)))throw new Error('FIRST TEAM 저장 DB가 아닙니다.');
 return {integrity:'ok',counts:Object.fromEntries(tables.map(name=>[name,names.has(name)?db.prepare(`SELECT count(*) AS n FROM ${name}`).get().n:0]))};
}
export function inspectDatabase(filename){
 const file=sourceFile(filename),db=new DatabaseSync(file,{readOnly:true});
 try{return {...inspectConnection(db),bytes:statSync(file).size};}finally{db.close();}
}
export async function backupDatabase(source,destination){
 const input=sourceFile(source),output=path.resolve(destination);
 if(input===output||[output,output+'-wal',output+'-shm'].some(existsSync))throw new Error('대상 DB나 WAL 파일이 이미 있습니다. 기존 저장은 덮어쓰지 않습니다.');
 mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
 const temporary=mkdtempSync(path.join(path.dirname(output),'.first-team-backup-')),snapshot=path.join(temporary,'snapshot.sqlite');
 const db=new DatabaseSync(input,{readOnly:true});
 try{
  db.exec('PRAGMA busy_timeout=5000');inspectConnection(db);
  // SQLite's online backup includes committed WAL pages in a consistent file.
  // Copying only game.sqlite could otherwise omit the latest gameplay/accounts.
  await backup(db,snapshot);
  const standalone=new DatabaseSync(snapshot);try{standalone.exec('PRAGMA journal_mode=DELETE');}finally{standalone.close();}
  chmodSync(snapshot,0o600);
  const summary=inspectDatabase(snapshot);
  // A same-filesystem hard link publishes the completed snapshot atomically.
  // Unlike rename, it refuses to overwrite a target created by another process.
  linkSync(snapshot,output);
  return {file:output,...summary};
 }finally{db.close();rmSync(temporary,{recursive:true,force:true});}
}
export async function restoreDatabase(source,destination){
 // Restoration only creates a missing target. Stop the application first and
 // keep any previous database/sidecars separately rather than overwriting them.
 return backupDatabase(source,destination);
}
