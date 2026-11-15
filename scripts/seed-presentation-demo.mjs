/* Authorized persistent presentation fixtures. No fake assistant responses or backdated records.
 * Node 24+: AWS_PROFILE=vibe-team node scripts/seed-presentation-demo.mjs setup|classes|class-clarification|trip|hackathon|summary
 * Private credentials/checkpoints live in ignored .demo/ (0600). No email is sent.
 */
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,unlinkSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fixtures=JSON.parse(readFileSync(resolve(root,'demo/presentation-scenarios.json'),'utf8'));
const phase=process.argv[2]||'summary', profile=process.env.AWS_PROFILE||'vibe-team',region='us-east-2';
const site=process.env.VIBE_DEMO_URL||'https://vibe-chat.us';
const privateDir=resolve(root,'.demo');mkdirSync(privateDir,{recursive:true,mode:0o700});chmodSync(privateDir,0o700);
const statePath=resolve(privateDir,process.env.VIBE_DEMO_STATE||'presentation-state.json');
const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{seed:randomBytes(4).toString('hex'),users:{},parties:{},steps:{},observations:[]};
function save(){const tmp=statePath+'.tmp';writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600});renameSync(tmp,statePath);chmodSync(statePath,0o600);}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function aws(service,operation,input={}){
 const path=resolve(privateDir,`aws-request-${process.pid}.json`);writeFileSync(path,JSON.stringify(input),{mode:0o600});
 try {const value=execFileSync('aws',[service,operation,'--profile',profile,'--region',region,'--cli-input-json',`file://${path}`,'--output','json'],{encoding:'utf8',stdio:'pipe',timeout:45000});return value.trim()?JSON.parse(value):{};}
 catch {throw Error(`AWS ${service}/${operation} failed. Details hidden to protect credentials.`);}
 finally{if(existsSync(path))unlinkSync(path);}
}
let config;const tokens={};
async function api(who,path,method='GET',body){
 const url=new URL(config.apiUrl.replace(/\/$/,'')+path,site);
 const response=await fetch(url,{method,headers:{authorization:`Bearer ${tokens[who]}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 const value=await response.json().catch(()=>({}));if(!response.ok)throw Error(`${method} ${path} failed (${response.status}: ${value.code||'unknown'})`);return value;
}
function decode(v){if(!v||typeof v!=='object')return v;if('S'in v)return v.S;if('N'in v)return Number(v.N);if('BOOL'in v)return v.BOOL;if('NULL'in v)return null;if('L'in v)return v.L.map(decode);if('M'in v)return Object.fromEntries(Object.entries(v.M).map(([k,x])=>[k,decode(x)]));return v;}
function item(pk,sk){const row=aws('dynamodb','get-item',{TableName:'vibe-dev',Key:{PK:{S:pk},SK:{S:sk}}}).Item;return row?Object.fromEntries(Object.entries(row).map(([k,v])=>[k,decode(v)])):undefined;}
async function login(){
 for(const [key,cast] of Object.entries(fixtures.cast)){
  let user=state.users[key];
  if(!user){user={name:cast.name,email:`vibe-demo-${state.seed}-${key}@example.com`,password:`Vibe!${randomBytes(20).toString('base64url')}aA9`};state.users[key]=user;save();}
  if(!user.created){const created=aws('cognito-idp','admin-create-user',{UserPoolId:config.userPoolId,Username:user.email,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:user.email},{Name:'email_verified',Value:'true'},{Name:'name',Value:cast.name}]});user.username=created.User.Username;user.created=true;save();}
  if(!user.passwordSet){aws('cognito-idp','admin-set-user-password',{UserPoolId:config.userPoolId,Username:user.username,Password:user.password,Permanent:true});user.passwordSet=true;save();}
  const auth=aws('cognito-idp','initiate-auth',{ClientId:config.userPoolClientId,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:user.email,PASSWORD:user.password}});
  tokens[key]=auth.AuthenticationResult.IdToken;const subject=JSON.parse(Buffer.from(tokens[key].split('.')[1],'base64url').toString()).sub;if(user.id&&subject!==user.id)throw Error('Demo authentication subject mismatch');user.id=(await api(key,'/me')).id;save();
 }
}
async function setup(){
 for(const [who,cast] of Object.entries(fixtures.cast)){
  await api(who,'/me','PUT',{name:cast.name,learningEnabled:false});
  const existing=(await api(who,'/me/memories')).memories;
  for(const [category,text] of cast.memories)if(!existing.some(m=>m.text===text))await api(who,'/me/memories','POST',{category,text,approved:true});
 }
 for(const [key,definition] of Object.entries(fixtures.parties)){
  let party=state.parties[key];
  if(!party){party=(await api('maya','/parties')).parties.find(p=>p.name===definition.name)||await api('maya','/parties','POST',{name:definition.name,goal:definition.goal,mode:definition.mode});state.parties[key]=party;save();}
  let members=(await api('maya',`/parties/${party.id}/members`)).members;
  for(const who of Object.keys(fixtures.cast).filter(k=>k!=='maya'))if(!members.some(m=>m.userId===state.users[who].id)){
   const invite=await api('maya',`/parties/${party.id}/invites`,'POST',{});await api(who,`/invites/${invite.token}/join`,'POST',{});
  }
  for(const who of Object.keys(fixtures.cast))await api(who,`/parties/${party.id}/membership`,'PATCH',{useSharedMemory:true});
  members=(await api('maya',`/parties/${party.id}/members`)).members;
  for(const who of definition.admins)if(members.find(m=>m.userId===state.users[who].id)?.role!=='admin')await api('maya',`/parties/${party.id}/members/${state.users[who].id}`,'PATCH',{role:'admin'});
 }
 save();console.log('Created four fictional accounts, approved owner memories and three real parties. Credentials are private in .demo/.');
}
async function say(partyKey,step,who,text,replyToId){
 const party=state.parties[partyKey];if(!party)throw Error('Run setup first');
 const id=`${partyKey}:${step}`;let saved=state.steps[id];
 if(saved?.completed)return saved;
 if(!saved){saved={who,text,clientId:randomUUID(),...(replyToId?{replyToId}:{} )};state.steps[id]=saved;save();}
 if(!saved.sent){saved.sent=await api(who,`/parties/${party.id}/messages`,'POST',{text:saved.text,clientId:saved.clientId,...(saved.replyToId?{replyToId:saved.replyToId}:{})});save();}
 if(saved.sent.run){
  let run=saved.sent.run;const until=Date.now()+220000;
  while(Date.now()<until){run=await api(who,`/parties/${party.id}/runs/${run.id}`);if(['completed','failed','cancelled'].includes(run.status))break;await delay(2500);}
  saved.run=run;
  if(run.status!=='completed'){save();throw Error(`Vibe run ${run.id} is ${run.status}: ${run.error||'wait and resume this phase'}`);}
  const page=await api(who,`/parties/${party.id}/messages`);saved.reply=page.messages.find(m=>m.id===run.replyMessageId);if(!saved.reply)throw Error('Completed reply not on latest message page');
  const action=item(`PARTY#${party.id}`,`ACTION#${run.id}#MODEL#1`)||item(`PARTY#${party.id}`,`ACTION#${run.id}#MODEL#0`);
  if(action?.modelId!=='us.anthropic.claude-haiku-4-5-20251001-v1:0')throw Error('Unexpected reply model');
  saved.modelId=action.modelId;saved.completed=true;save();
  console.log(`\n${fixtures.cast[who].name}: ${saved.text}\nVibe: ${saved.reply.text}\nSources: ${saved.reply.citations?.length||0}; warnings: ${JSON.stringify(saved.reply.researchWarnings||[])}`);
 }else{saved.completed=true;save();console.log(`${fixtures.cast[who].name}: ${text}`);await delay(650);}
 return saved;
}
async function opening(key){for(const [i,[who,text]] of fixtures.parties[key].opening.entries())await say(key,`opening-${i}`,who,text);}
function researchCourses(key,runId){
 const courses=[];function walk(value){if(!value||typeof value!=='object')return;if(typeof value.course==='string'&&/^CSE 4\d\d[A-Z]?$/.test(value.course)){const section=value.sections?.find(s=>s.instructors?.length)||value;courses.push({course:value.course,title:value.title,professor:section.instructors?.[0]?.name});}if(value.subject==='CSE'&&/^4\d\d[A-Z]?$/.test(value.catalog_nbr||''))courses.push({course:`CSE ${value.catalog_nbr}`,title:value.title,professor:value.instructors?.[0]?.name});for(const child of Object.values(value))if(typeof child==='object')walk(child);}
 for(const attempt of [0,1]){const row=item(`PARTY#${state.parties[key].id}`,`RESEARCH#${runId}#${attempt}`);for(const m of row?.state?.messages||[])for(const block of m.content||[])for(const part of block.toolResult?.content||[])if(part.text){try{walk(JSON.parse(part.text));}catch{}}}
 return courses;
}
async function classes(){
 await opening('classes');const first=state.steps['classes:opening-8'];
 if(!state.selectedCourse){const candidates=researchCourses('classes',first.run.id);state.selectedCourse=candidates.find(c=>c.professor&&/learning|vision|artificial|data/i.test(c.title||''))||candidates.find(c=>c.professor)||candidates[0];if(!state.selectedCourse)throw Error('No returned course can be used for an honest follow-up; inspect the live reply.');save();}
 const {course,professor}=state.selectedCourse;
 await say('classes','syllabus','jordan',`${course} looks interesting. @Vibe what's the class actually like${professor?` with ${professor}`:''}? i'm mostly wondering about projects vs exams and how much work it is.`);
 if(professor)await say('classes','professor','priya',`@Vibe how is ${professor} for ${course}? like, what do students usually say about the teaching and grading?`);
 const proposal=await say('classes','proposal','leo',`i'd keep ${course} on the shortlist. building something sounds good, as long as we're not missing a lab or prerequisite`);
 await say('classes','join','priya',"yeah that sounds fun, i'm in if the timings still work",proposal.sent.message.id);
 await say('classes','volunteer','jordan',"i can check the prerequisites and whether there's a separate lab");
 await say('classes','wrap','maya',"@Vibe can you sum up where we landed and what we still need to check? add Jordan's prerequisite check as a task so we don't forget");
 await acceptTasks('classes');
}
async function trip(){
 await opening('trip');
 await say('trip','relaxed','priya',"the relaxed version sounds way more like us. @Vibe would Balboa Park or La Jolla be better for our main Saturday thing? Leo's gonna want good photos either way");
 await say('trip','dinner','maya',"Balboa Park and a waterfront evening sounds lovely. @Vibe any good dinner spots around Little Italy for us? two options would be perfect");
 await say('trip','budget','jordan',"small update: i could stretch to $400 this time if it gets us somewhere quieter and less driving. not making this my new normal though lol");
 await say('trip','agree','priya',"honestly i'd rather pay a little more than spend the whole weekend in the car");
 await say('trip','photo','leo',"same. i can compare a couple places to stay, ideally with parking that doesn't cost another whole trip");
 await say('trip','wrap','maya',"@Vibe can you update the relaxed plan with that budget? what changes, and what do we still need real quotes for? put Leo down to compare the places");
 await acceptTasks('trip');
}
async function hackathon(){
 const key='hackathon',party=state.parties[key];
 if(!state.steps['hackathon:context']){await api('jordan',`/parties/${party.id}/facts`,'POST',{kind:'constraint',text:'Fictional presentation planning scenario: four-hour prototype window. Check the event rules at https://sunhacks-2026.devpost.com/rules. Credit reused tools and AI assistance. No submission or publication is authorized by this party.'});state.steps['hackathon:context']={completed:true};save();}
 await opening(key);
 await say(key,'research','priya',"the club onboarding idea is growing on me. @Vibe what's already out there for this? is there a small angle we could do well instead of just making a worse version of an existing app?");
 await say(key,'choice','leo',"i vote for the club onboarding one. feels like we can actually show the whole flow. let's call it FirstWeek for now");
 const proposal=await say(key,'proposal','leo',"i'll take the interface — landing, onboarding and the next-step screen");
 await say(key,'join','priya',"sounds good, i'm in. i'll sketch the flow and write the questions + empty states",proposal.sent.message.id);
 await say(key,'backend','jordan',"i'll do the API and persistence. keeping the data model tiny for once");
 await say(key,'agent','maya',"i can do the agent instructions and a few examples to sanity check it");
 await say(key,'wrap','jordan',"@Vibe alright, what's our smallest version and the biggest thing we're still assuming? can you add the four tasks we just volunteered for, with one person on each?");
 await acceptTasks(key);
}
async function acceptTasks(key){
 const party=state.parties[key];const tasks=(await api('maya',`/parties/${party.id}/tasks`)).tasks;
 for(const task of tasks.filter(t=>t.status==='proposed'&&t.assigneeId)){
  const who=Object.keys(state.users).find(k=>state.users[k].id===task.assigneeId);if(!who)continue;
  await api(who,`/parties/${party.id}/tasks/${task.id}`,'PATCH',{actionId:randomUUID(),version:task.version,action:'accept'});
 }
 console.log(`${key}: ${(await api('maya',`/parties/${party.id}/tasks`)).tasks.filter(t=>t.status==='accepted').length} accepted tasks`);
}
async function summary(){
 const report={site,seed:state.seed,cast:Object.fromEntries(Object.entries(state.users).map(([k,u])=>[k,{name:u.name,email:u.email}])),parties:{}};
 for(const [key,p] of Object.entries(state.parties)){const page=await api('maya',`/parties/${p.id}/messages`);for(const message of page.messages.filter(m=>m.role==='user')){const user=Object.values(state.users).find(u=>u.id===message.authorId);if(!user||message.authorName!==user.name)throw Error('Demo message author mismatch');}report.parties[key]={name:p.name,url:`${site}/parties/${p.id}`,messages:page.messages.length,runs:page.runs.map(r=>({id:r.id,status:r.status,error:r.error})),tasks:(await api('maya',`/parties/${p.id}/tasks`)).tasks.map(t=>({title:t.title,status:t.status})),theme:(await api('maya',`/parties/${p.id}`)).theme};}
 writeFileSync(resolve(privateDir,'presentation-summary.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}
try{
 if(phase==='plan'){console.log(JSON.stringify(fixtures,null,2));process.exit(0);}
 if(process.env.VIBE_DEMO_ALLOW_LIVE!=='yes')throw Error('Live demo operations are disabled. Use plan for offline preparation; explicit authorization is required before setting VIBE_DEMO_ALLOW_LIVE=yes.');
 if(aws('sts','get-caller-identity').Account!=='851725603471')throw Error('Wrong AWS account');
 config=await (await fetch(new URL('/config.json',site),{signal:AbortSignal.timeout(15000)})).json();
 if(config.userPoolId!=='us-east-2_zrHcAFg7r')throw Error('Wrong application identity pool');
 await login();
 if(phase==='class-clarification'){if(!state.selectedCourse)throw Error('Run classes first');const {course,professor}=state.selectedCourse;await say('classes','official-evidence','jordan',`wait, is the exam breakdown from a syllabus or from reviews? @Vibe can we find an actual syllabus for ${course}${professor?` with ${professor}`:''}? an older one is useful too, just tell us which term it's from`);}else if(phase==='setup')await setup();else if(phase==='classes')await classes();else if(phase==='trip')await trip();else if(phase==='hackathon')await hackathon();else if(phase==='summary')await summary();else throw Error('Unknown phase');
 save();
}catch(error){save();console.error(error.message);process.exitCode=1;}
