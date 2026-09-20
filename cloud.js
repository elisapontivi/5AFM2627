'use strict';
const Cloud = (() => {
 let session=null,refreshing=null;
 function setSession(data){session={...data,expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};}
 const config=window.CLASSE_CONFIG||{};
 function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')&&/^sb_publishable_/.test(config.publishableKey||'');}
 async function call(path,body,token=null){
  if(!configured())throw Error('Il salvataggio online non è ancora attivo. È necessario completare il collegamento dell’archivio.');
  let response;
  try{response=await fetch(config.supabaseUrl+path,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:'no-store'});}catch(e){throw Error('Connessione non disponibile. Il lavoro resta nella pagina: riprova senza chiuderla.');}
  let data;try{data=await response.json();}catch(e){data={};}
  if(!response.ok){if(response.status===401||response.status===403)throw Error('Accesso non valido o sessione scaduta. Accedi di nuovo con il tuo codice personale.');if(response.status===429)throw Error('Troppi tentativi. Attendi prima di riprovare.');throw Error(typeof data.message==='string'?data.message:'Operazione non completata. Riprova.');}
  return data;
 }
 async function rpc(name,args={}){
  if(!session)throw Error('Accedi con il tuo codice personale.');
  if(Date.now()>=session.expires_at*1000-60000){
   if(!refreshing)refreshing=call('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(data=>{setSession(data);}).finally(()=>{refreshing=null;});
   await refreshing;
  }
  return call('/rest/v1/rpc/'+name,args,session.access_token);
 }
 async function login(target,password,email){
  const address=target==='teacher'?email:'studente'+String(target).padStart(2,'0')+'@'+config.studentDomain;
  setSession(await call('/auth/v1/token?grant_type=password',{email:address,password:target==='teacher'?password:'Classe!'+password}));
  try{const profile=await rpc('ci_me');if(profile.role!==(target==='teacher'?'teacher':'student'))throw Error('Questo accesso non corrisponde al profilo scelto.');const records=await rpc('ci_records');return {profile,records};}catch(e){session=null;throw e;}
 }
 async function logout(){const token=session?.access_token;session=null;if(token)try{await call('/auth/v1/logout',{},token);}catch(e){/* Session remains removed locally; access token expires on the server. */}}
 return {configured,login,logout,resetScores:()=>rpc('ci_reset_scores'),records:()=>rpc('ci_records'),start:(activity,request)=>rpc('ci_start',{p_activity:activity,p_request:request}),answer:(id,index,choice)=>rpc('ci_answer',{p_attempt:id,p_index:index,p_choice:choice}),accounting:(id,answers)=>rpc('ci_submit_accounting',{p_attempt:id,p_answers:answers})};
})();
