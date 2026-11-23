import test from 'node:test';
import assert from 'node:assert/strict';
import {config,assertConfig} from '../lib/config.mjs';
import {clientCredentials,clearServiceToken} from '../lib/oauth.mjs';
import {seal,unseal} from '../lib/session.mjs';
import {safeZendeskPath,backendZendesk,rawZendesk,ZendeskError} from '../lib/zendesk.mjs';
import {loginMode,normalizeEmail,makeChallenge,verifyOtp,lookupZendeskUser} from '../lib/login.mjs';
import {verifiedSession} from '../lib/http.mjs';
import {listResource,detailResource,createResource,updateResource} from '../lib/resources.mjs';
const secret='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const c=config({ZENDESK_SUBDOMAIN:'managetechservices-16737',ZENDESK_OAUTH_CLIENT_ID:'managetech',ZENDESK_OAUTH_CLIENT_SECRET:'genuine-test-only',ZENDESK_OAUTH_SCOPE:'read write',SESSION_SECRET:secret});
const customer={user:{id:42,email:'customer@example.com',role:'end-user',name:'Customer'}};
const staff={user:{id:13,email:'agent@example.com',role:'agent',name:'Agent'}};
const admin={user:{id:1,email:'admin@example.com',role:'admin',name:'Admin'}};
const ok=(data,status=200)=>({ok:status>=200&&status<300,status,headers:{get:()=>null},json:async()=>data});
test('production app origin is separate from Zendesk backend',()=>{
 assert.equal(c.appUrl,'https://managetech.abitech.site');
 assert.equal(config({MTS_APP_URL:'https://managetech.abitech.site/'}).appUrl,'https://managetech.abitech.site');
 assert.throws(()=>config({MTS_APP_URL:'http://managetech.abitech.site'}),/HTTPS/);
 assert.throws(()=>config({MTS_APP_URL:'https://managetech.abitech.site/misroute'}),/origin/);
});
test('new tenant config never points to old Zendesk account',()=>{
 assert.equal(c.base,'https://managetechservices-16737.zendesk.com');assert.equal(c.oauthReady,true);
 assert.equal(assertConfig(c),c);assert.equal(c.sessionReady,true);
});
test('client_credentials is server-to-server and requires no redirect URI',async()=>{
 let endpoint,options;
 const result=await clientCredentials(c,async(u,o)=>{endpoint=u;options=o;return ok({access_token:'server_only',expires_in:1800})});
 assert.equal(result.access_token,'server_only');assert.equal(endpoint,c.base+'/oauth/tokens');
 const body=JSON.parse(options.body);assert.equal(body.grant_type,'client_credentials');assert.equal(body.scope,'read write');assert.equal(body.client_id,'managetech');assert.equal(Object.hasOwn(body,'redirect_uri'),false);
});
test('auth bearer token does not appear in user session cookie',()=>{
 const v=seal(customer,secret);assert.deepEqual(unseal(v,secret).user,customer.user);assert.ok(!v.includes('Bearer'));
 assert.equal(unseal(v,'wrong'.repeat(10)),null);
});
test('only Zendesk API paths permitted',()=>{
 assert.throws(()=>safeZendeskPath('https://bad.example/api/v2/users',c),ZendeskError);
 assert.throws(()=>safeZendeskPath('/api/v2/../../oauth/tokens',c),ZendeskError);
 assert.equal(safeZendeskPath('/api/v2/users.json',c),c.base+'/api/v2/users.json');
});
test('backend remote calls use only the service token and no browser redirect',async()=>{
 let target,auth;
 const data=await backendZendesk('/api/v2/users.json',{}, {config:c,getToken:async()=> 'server-token',fetcher:async(u,o)=>{target=u;auth=o.headers.Authorization;return ok({users:[]})}});
 assert.equal(auth,'Bearer server-token');assert.equal(target,c.base+'/api/v2/users.json');assert.deepEqual(data.users,[]);
});
test('rawZendesk requires a verified portal identity',async()=>{
 await assert.rejects(()=>rawZendesk(null,'/api/v2/users.json'),e=>e.status===401);
});
test('OTP is six-digit, mode-locked, and keyed to session secret',()=>{
 const {code,challenge}=makeChallenge('customer@example.com','user',secret);
 assert.match(code,/^\d{6}$/);assert.equal(loginMode('user'),'user');assert.equal(loginMode('portal'),null);
 assert.equal(verifyOtp(challenge,code,secret),true);assert.equal(verifyOtp(challenge,code,'another-secret'),false);
 assert.equal(verifyOtp(challenge,'1234567',secret),false);
});
test('emails normalized and validated',()=>{
 assert.equal(normalizeEmail(' CUSTOMER@EXAMPLE.COM  '),'customer@example.com');
 assert.throws(()=>normalizeEmail('not-an-email'),ZendeskError);
});
test('staff login cannot be used by an end-user',async()=>{
 const requester=async()=>({users:[{id:42,email:'customer@example.com',role:'end-user'}]});
 assert.equal(await lookupZendeskUser('customer@example.com','admin',requester),null);
 assert.equal((await lookupZendeskUser('customer@example.com','user',requester)).id,42);
});
test('Zendesk email lookup requires an exact match',async()=>{
 const user=await lookupZendeskUser('a@example.com','user',async()=>({users:[{id:9,email:'not-a@example.com',role:'end-user'}]}));
 assert.equal(user,null);
});
test('sessions revalidate Zendesk user identity and live roles',async()=>{
 const session=await verifiedSession(staff,async path=>{assert.equal(path,'/api/v2/users/13.json');return {user:{id:13,email:'agent@example.com',role:'end-user',name:'Agent',suspended:false}}});
 assert.equal(session.user.role,'end-user');
 await assert.rejects(()=>verifiedSession(staff,async()=>({user:{id:13,email:'agent@example.com',role:'agent',suspended:true}})),e=>e.status===401);
});
test('customer request lists are scoped to their Zendesk requester id',async()=>{
 let path;const requester=async(s,p)=>{path=p;return {data:{tickets:[{id:111,requester_id:42}]},session:s}};
 const out=await listResource(customer,'requests','',requester);
 assert.match(path,/\/api\/v2\/users\/42\/tickets\/requested/);assert.equal(out.items[0].id,111);
});
test('customer can never retrieve another user’s ticket details',async()=>{
 const requester=async(s,p)=>{if(p.includes('/tickets/100.json'))return {data:{ticket:{id:100,requester_id:777}},session:s};throw Error('comments should never be loaded')};
 await assert.rejects(()=>detailResource(customer,'requests',100,requester),e=>e.status===404);
});
test('customer detail hides all internal ticket comments',async()=>{
 const req=async(s,p)=>({data:p.includes('comments')?{comments:[{id:1,public:false,body:'secret'},{id:2,public:true,body:'public'}]}:{ticket:{id:3,requester_id:42}},session:s});
 const out=await detailResource(customer,'requests',3,req);assert.deepEqual(out.comments.map(x=>x.body),['public']);
});
test('customer creates tickets with verified requester only',async()=>{
 let posted;const req=async(s,p,o)=>{posted=o.body.ticket;return {data:{ticket:{id:6,...posted}},session:s}};
 const result=await createResource(customer,'orders',{subject:'Order',description:'Hardware'},req);
 assert.equal(result.item.requester_id,42);assert.equal(posted.tags[0],'mts_order');
});
test('customer update cannot overwrite arbitrary ticket or set internal notes',async()=>{
 await assert.rejects(()=>updateResource(customer,'requests',20,{comment:'hi'},async(s,p)=>({data:{ticket:{requester_id:999}},session:s})),e=>e.status===404);
 let updated;const req=async(s,p,o)=>{if(o?.method==='PUT'){updated=o.body;return {data:{ticket:{id:20,requester_id:42}},session:s}};return {data:{ticket:{id:20,requester_id:42}},session:s}};
 await updateResource(customer,'requests',20,{comment:'hi'},req);
 assert.equal(updated.ticket.comment.public,true);assert.deepEqual(Object.keys(updated.ticket),['comment']);
});
test('end-user cannot list staff-only users, organizations or ticket queues',async()=>{
 for(const item of ['tickets','users','organizations','settings','roles'])await assert.rejects(()=>listResource(customer,item),e=>e.status===403);
});
test('admin-only actions blocked for agent or customer',async()=>{
 await assert.rejects(()=>createResource(customer,'users',{name:'Hi',email:'hi@example.com'}),e=>e.status===403);
});
test('unknown resources fail closed',async()=>{
 await assert.rejects(()=>listResource(staff,'made_up'),e=>e.status===404);
});
