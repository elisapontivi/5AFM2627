'use strict';
const Cloud = (() => {
 let session=null,refreshing=null,remember=false;const KEY='ci_session';
 function store(){if(!remember)return;try{session?sessionStorage.setItem(KEY,JSON.stringify(session)):sessionStorage.removeItem(KEY);}catch(e){/* Storage not available: the session stays in memory only. */}}
 function keep(){remember=true;try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(saved&&saved.access_token&&saved.refresh_token)session=saved;}catch(e){session=null;}return !!session;}
 function setSession(data){session={...data,expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};store();}
 const config=window.CLASSE_CONFIG||{};
 /* Compleanno in qualsiasi forma (16/09, 16-9, 16 09, 1609, 169, 16/09/2008) -> codici ggmm possibili. */
 function dateCodes(text){const t=String(text||'').trim(),ok=(d,m)=>/^\d{1,2}$/.test(d)&&/^\d{1,2}$/.test(m)&&+d>=1&&+d<=31&&+m>=1&&+m<=12,c=(d,m)=>d.padStart(2,'0')+m.padStart(2,'0'),out=[];if(/\D/.test(t)){const p=t.split(/\D+/).filter(Boolean);if(p.length>=2&&p.length<=3&&ok(p[0],p[1]))out.push(c(p[0],p[1]));}else if([4,6,8].includes(t.length)){if(ok(t.slice(0,2),t.slice(2,4)))out.push(t.slice(0,4));}else if(t.length===3){if(ok(t.slice(0,2),t.slice(2)))out.push(c(t.slice(0,2),t.slice(2)));if(ok(t.slice(0,1),t.slice(1)))out.push(c(t.slice(0,1),t.slice(1)));}else if(t.length===2&&ok(t[0],t[1]))out.push(c(t[0],t[1]));return [...new Set(out)];}
 function dateCode(text){return dateCodes(text)[0]||null;}
 function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')&&/^sb_publishable_/.test(config.publishableKey||'');}
 async function call(path,body,token=null,keepalive=false){
  if(!configured())throw Error('Il salvataggio online non è ancora attivo. È necessario completare il collegamento dell’archivio.');
  let response;
  try{response=await fetch(config.supabaseUrl+path,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),keepalive,signal:AbortSignal.timeout(20000),cache:'no-store'});}catch(e){throw Error('Connessione non disponibile. Il lavoro resta nella pagina: riprova senza chiuderla.');}
  let data;try{data=await response.json();}catch(e){data={};}
  if(!response.ok){if(response.status===401||response.status===403)throw Error('Accesso non valido o sessione scaduta. Accedi di nuovo con il tuo codice personale.');if(response.status===429)throw Error('Troppi tentativi. Attendi prima di riprovare.');throw Error(typeof data.message==='string'?data.message:'Operazione non completata. Riprova.');}
  return data;
 }
 async function rpc(name,args={},keepalive=false){
  if(!session)throw Error('Accedi con il tuo codice personale.');
  if(Date.now()>=session.expires_at*1000-60000){
   if(!refreshing)refreshing=call('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(data=>{setSession(data);}).finally(()=>{refreshing=null;});
   await refreshing;
  }
  return call('/rest/v1/rpc/'+name,args,session.access_token,keepalive);
 }
 async function login(target,password,email){
  const address=target==='teacher'?email:'studente'+String(target).padStart(2,'0')+'@'+config.studentDomain;
  const tries=target==='teacher'?[password]:(dateCodes(password).length?dateCodes(password):[String(password).trim()]).map(x=>'Classe!'+x);let err=null;for(const pw of tries){try{setSession(await call('/auth/v1/token?grant_type=password',{email:address,password:pw}));err=null;break;}catch(e){err=e;if(/Connessione|Troppi|non è ancora attivo/.test(e.message))break;}}if(err)throw err;
  try{const profile=await rpc('ci_me');if(profile.role!==(target==='teacher'?'teacher':'student'))throw Error('Questo accesso non corrisponde al profilo scelto.');const records=await rpc('ci_records');return {profile,records};}catch(e){session=null;store();throw e;}
 }
 async function logout(){const token=session?.access_token;session=null;store();if(token)try{await call('/auth/v1/logout',{},token);}catch(e){/* Session remains removed locally; access token expires on the server. */}}
 return {configured,dateCode,dateCodes,login,logout,keep,forget:()=>{session=null;store();},me:()=>rpc('ci_me'),video:(args,keepalive=false)=>rpc('ci_video_event',args,keepalive),videoReport:()=>rpc('ci_video_report'),videoDetail:(student,video)=>rpc('ci_video_detail',{p_student:student,p_video:video}),videoReset:()=>rpc('ci_video_reset'),resetScores:()=>rpc('ci_reset_scores'),records:()=>rpc('ci_records'),start:(activity,request)=>rpc('ci_start',{p_activity:activity,p_request:request}),answer:(id,index,choice)=>rpc('ci_answer',{p_attempt:id,p_index:index,p_choice:choice}),accounting:(id,answers)=>rpc('ci_submit_accounting',{p_attempt:id,p_answers:answers})};
})();
