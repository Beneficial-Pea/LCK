import {backupDatabase,inspectDatabase,restoreDatabase} from '../lib/storage-backup.mjs';
const [operation,source,destination,...extra]=process.argv.slice(2);
try{
 if(extra.length||!['backup','inspect','restore'].includes(operation)||!source||(operation!=='inspect'&&!destination)||(operation==='inspect'&&destination))throw new Error('사용법: node scripts/storage.mjs inspect DB | backup 원본DB 새백업파일 | restore 백업파일 새대상DB');
 const result=operation==='inspect'?inspectDatabase(source):await(operation==='backup'?backupDatabase:restoreDatabase)(source,destination);
 // Counts and file metadata only: credentials, messages and player content are
 // never printed. The full backup file itself must be kept private.
 console.log(JSON.stringify({operation,...result},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
