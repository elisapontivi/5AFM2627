'use strict';
const Cloud = (() => {
 let session=null,refreshing=null,remember=false;const KEY='ci_session';
 function store(){if(!remember)return;try{session?sessionStorage.setItem(KEY,JSON.stringify(session)):sessionStorage.removeItem(KEY);}catch(e){/* Storage not available: the session stays in memory only. */}}
 function keep(){remember=true;try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(saved&&saved.access_token&&saved.refresh_token)session=saved;}catch(e){session=null;}return !!session;}
 function setSession(data){session={...data,expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};store();}
 const config=window.CLASSE_CONFIG||{};
 /* Data di nascita in qualsiasi forma (14/03/2008, 14-3-08, 14032008, 140308) -> 140308; altrimenti null. */
 function dateCode(text){const t=String(text||'').trim();let d,m,y;if(/\D/.test(t)){const p=t.split(/\D+/).filter(Boolean);if(p.length!==3)return null;[d,m,y]=p;}else if(t.length===8||t.length===6){d=t.slice(0,2);m=t.slice(2,4);y=t.slice(4);}else return null;if(!/^\d{1,2}$/.test(d)||!/^\d{1,2}$/.test(m)||!/^(\d{2}|\d{4})$/.test(y)||+d<1||+d>31||+m<1||+m>12)return null;return d.padStart(2,'0')+m.padStart(2,'0')+y.slice(-2);}
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
  setSession(await call('/auth/v1/token?grant_type=password',{email:address,password:target==='teacher'?password:'Classe!'+(dateCode(password)||String(password).trim())}));
  try{const profile=await rpc('ci_me');if(profile.role!==(target==='teacher'?'teacher':'student'))throw Error('Questo accesso non corrisponde al profilo scelto.');const records=await rpc('ci_records');return {profile,records};}catch(e){session=null;store();throw e;}
 }
 async function logout(){const token=session?.access_token;session=null;store();if(token)try{await call('/auth/v1/logout',{},token);}catch(e){/* Session remains removed locally; access token expires on the server. */}}
 return {configured,dateCode,login,logout,keep,forget:()=>{session=null;store();},me:()=>rpc('ci_me'),video:(args,keepalive=false)=>rpc('ci_video_event',args,keepalive),videoReport:()=>rpc('ci_video_report'),videoDetail:(student,video)=>rpc('ci_video_detail',{p_student:student,p_video:video}),videoReset:()=>rpc('ci_video_reset'),resetScores:()=>rpc('ci_reset_scores'),records:()=>rpc('ci_records'),start:(activity,request)=>rpc('ci_start',{p_activity:activity,p_request:request}),answer:(id,index,choice)=>rpc('ci_answer',{p_attempt:id,p_index:index,p_choice:choice}),accounting:(id,answers)=>rpc('ci_submit_accounting',{p_attempt:id,p_answers:answers})};
})();
