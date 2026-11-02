import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
const compress=promisify(gzip),threshold=16*1024;
function acceptsGzip(value=''){
 return String(value).split(',').some(part=>{const [name,...params]=part.trim().toLowerCase().split(';');return name==='gzip'&&!params.some(p=>/^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(p));});
}
export async function sendJson(req,res,value){
 const json=JSON.stringify(value);if(json===undefined)return res.end();
 let body=Buffer.from(json);
 if(body.length>=threshold){
  const vary=res.getHeader('Vary');res.setHeader('Vary',vary?`${vary}, Accept-Encoding`:'Accept-Encoding');
  if(acceptsGzip(req.headers['accept-encoding'])){body=await compress(body,{level:1});res.setHeader('Content-Encoding','gzip');}
 }
 res.setHeader('Content-Length',body.length);return res.end(body);
}
