import { rawZendesk, ZendeskError, isStaff, requireRole } from './zendesk.mjs';

export const CUSTOM_OBJECTS = Object.freeze({
  products: {key:'mts_product', title:'Product', plural:'Products', fields:[['sku','SKU','text'],['description','Description','textarea'],['price','Price','decimal'],['stock','Stock','integer'],['active','Active','checkbox']]},
  services: {key:'mts_service', title:'Service', plural:'Services', fields:[['description','Description','textarea'],['monthly_price','Monthly Price','decimal'],['active','Active','checkbox']]},
});
const TAGS = Object.freeze({orders:'mts_order',quotes:'mts_quote',payments:'mts_payment'});
const SUBJECTS = Object.freeze({orders:'MTS Order',quotes:'MTS Quote',payments:'MTS Payment'});
const PAGE_SIZE = 50;
const PATHS = Object.freeze({
  tickets:'/api/v2/tickets.json?page[size]=50',
  organizations:'/api/v2/organizations.json?page[size]=50',
  users:'/api/v2/users.json?page[size]=50',
  roles:'/api/v2/users.json?role[]=agent&role[]=admin&page[size]=50',
  forms:'/api/v2/ticket_forms.json',
  knowledge:'/api/v2/help_center/articles.json?per_page=50',
  settings:'/api/v2/account/settings.json',
  requests:'/api/v2/requests.json?per_page=50',
});
export function safeId(id) {
  const value = String(id || '');
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new ZendeskError(400,'Invalid resource ID');
  return value;
}
function querySearch(filter, term='', page=1) {
  const query = [`type:ticket`, filter, term && `"${term.replace(/["\\]/g,'').slice(0,80)}"`].filter(Boolean).join(' ');
  return `/api/v2/search.json?${new URLSearchParams({query,per_page:String(PAGE_SIZE),page:String(page),sort_by:'updated_at',sort_order:'desc'})}`;
}
export function mapRows(resource, payload) {
  if (resource === 'summary') return payload;
  const keys = { tickets:'tickets', orders:'results', quotes:'results',payments:'results',organizations:'organizations',users:'users',roles:'users',forms:'ticket_forms',knowledge:'articles',requests:'requests',products:'custom_object_records',services:'custom_object_records',settings:'settings' };
  const key = keys[resource];
  if (!key) throw new ZendeskError(404,'Unknown resource');
  return {items:key==='settings'?[payload.settings || {}]:Array.isArray(payload[key])?payload[key]:[], count:payload.count ?? null,
    next:payload.next_page ? true : Boolean(payload.meta?.has_more),
    after:payload.meta?.after_cursor || null};
}
export async function listResource(session, resource, term = '', requester = rawZendesk, page = 1, after = '') {
  page=Number(page);
  if (!Number.isInteger(page)||page<1||page>100) throw new ZendeskError(400,'Invalid page number');
  if (!/^[A-Za-z0-9_+\/=-]{0,2048}$/.test(after)) throw new ZendeskError(400,'Invalid pagination cursor');
  if (!session?.user) throw new ZendeskError(401,'Sign in required');
  const staff = isStaff(session);
  if (resource === 'summary') return staff ? staffSummary(session,requester) : customerSummary(session,requester);
  if (resource === 'requests') {
    if(isStaff(session))throw new ZendeskError(403,'Use staff tickets for staff requests');
    const path=`/api/v2/users/${safeId(session.user.id)}/tickets/requested.json?per_page=50&page=${page}`;
    const {data,session:next}=await requester(session,path);
    return {items:Array.isArray(data.tickets)?data.tickets:[],count:data.count??null,next:Boolean(data.next_page),session:next};
  }
  if (resource === 'knowledge') {
    const {data,session:next} = await requester(session, `${PATHS.knowledge}&page=${page}`);
    return {...mapRows(resource,data),session:next};
  }
  if (resource === 'products' || resource === 'services') {
    // Service token is never exposed to the browser; only catalog fields shown.
    const key=CUSTOM_OBJECTS[resource].key;
    const {data,session:next} = await requester(session,`/api/v2/custom_objects/${key}/records?page[size]=50${after?'&page[after]='+encodeURIComponent(after):''}`);
    return {...mapRows(resource,data),session:next};
  }
  requireRole(session);
  if (TAGS[resource]) {
    const termQuery = `${SUBJECTS[resource]}${term?' '+term:''}`;
    const {data,session:next} = await requester(session, querySearch(`subject:"${termQuery.replace(/["\\]/g,'').slice(0,100)}"`,'',page));
    const result=mapRows(resource,data);
    result.items=result.items.filter(item=>String(item.subject||'').startsWith(`${SUBJECTS[resource]} —`) || (item.tags||[]).includes(TAGS[resource]));
    result.count=null; // Search may match comments; do not claim this is an exact total.
    return {...result,session:next};
  }
  if (!PATHS[resource] || resource==='requests') throw new ZendeskError(404,'Unknown Zendesk resource');
  let url = PATHS[resource];
  if(after) url+=`&page[after]=${encodeURIComponent(after)}`;
  else if(['forms','settings'].includes(resource)) {} // Forms and settings are unpaginated.
  if (term && ['tickets','users','organizations'].includes(resource)) {
    const q = [`type:${resource==='tickets'?'ticket':resource==='users'?'user':'organization'}`,`"${term.replace(/["\\]/g,'').slice(0,80)}"`].join(' ');
    const {data,session:next} = await requester(session,`/api/v2/search.json?${new URLSearchParams({query:q,per_page:'50',page:String(page)})}`);
    return {items:data.results||[],count:data.count??null,next:Boolean(data.next_page),session:next};
  }
  const {data,session:next} = await requester(session,url);
  return {...mapRows(resource,data),session:next};
}
async function staffSummary(session,requester) {
  requireRole(session);
  // Counts come from Zendesk count endpoints and search responses, not from a local cache.
  const endpoints = [
    ['/api/v2/organizations/count.json',d=>d.count?.value],
    ['/api/v2/users/count.json',d=>d.count?.value],
    ['/api/v2/search.json?query='+encodeURIComponent('type:ticket status<solved'),d=>d.count],
    ['/api/v2/search.json?query='+encodeURIComponent('type:ticket subject:"MTS Order" status:pending'),d=>d.count],
    ['/api/v2/search.json?query='+encodeURIComponent('type:ticket status:new'),d=>d.count],
    ['/api/v2/search.json?query='+encodeURIComponent('type:ticket status:pending'),d=>d.count],
    ['/api/v2/search.json?query='+encodeURIComponent('type:ticket status:solved'),d=>d.count],
    ['/api/v2/tickets.json?per_page=8',d=>d.tickets||[]],
  ];
  let current=session;
  const out=[];
  for (const [path,extract] of endpoints) {
    const result=await requester(current,path);current=result.session;out.push(extract(result.data));
  }
  if (out.slice(0,7).some(value=>typeof value!=='number')) throw new ZendeskError(502,'Zendesk did not return reliable dashboard counts');
  return {stats:{companies:out[0],people:out[1],openTickets:out[2],pendingOrders:out[3],new:out[4],pending:out[5],solved:out[6]}, recent:out[7],session:current};
}
async function customerSummary(session,requester) {
  const {data,session:next}=await requester(session,`/api/v2/users/${safeId(session.user.id)}/tickets/requested.json?per_page=50`);
  const requests=Array.isArray(data.tickets)?data.tickets:[];
  return {stats:{visibleRequests:requests.length,openRequests:requests.filter(r=>!['solved','closed'].includes(r.status)).length}, recent:requests.slice(0,8),partial:Boolean(data.next_page),session:next};
}
export async function detailResource(session,resource,id,requester=rawZendesk) {
  if (!session?.user) throw new ZendeskError(401,'Sign in required');
  id=safeId(id);
  if (resource==='requests') {
    if(isStaff(session))throw new ZendeskError(403,'Use the staff ticket view');
    const result=await requester(session,`/api/v2/tickets/${id}.json`);
    if(String(result.data.ticket?.requester_id)!==String(session.user.id))throw new ZendeskError(404,'Ticket not found');
    const comments=await requester(result.session,`/api/v2/tickets/${id}/comments.json`);
    return {item:result.data.ticket,comments:(comments.data.comments||[]).filter(c=>c.public===true),session:comments.session};
  }
  if (resource==='products'||resource==='services') {
    const key=CUSTOM_OBJECTS[resource].key;
    const result=await requester(session,`/api/v2/custom_objects/${key}/records/${id}`);
    return {item:result.data.custom_object_record,session:result.session};
  }
  requireRole(session);
  if (['tickets','orders','payments','quotes'].includes(resource)) {
    let result=await requester(session,`/api/v2/tickets/${id}.json`);
    if (TAGS[resource] && !(result.data.ticket?.tags||[]).includes(TAGS[resource]) && !String(result.data.ticket?.subject||'').startsWith(`${SUBJECTS[resource]} —`)) throw new ZendeskError(404,'Record is not in this Zendesk queue');
    const comments=await requester(result.session,`/api/v2/tickets/${id}/comments.json`);
    return {item:result.data.ticket,comments:comments.data.comments||[],session:comments.session};
  }
  if (resource==='organizations'||resource==='users') {
    const singular=resource==='organizations'?'organization':'user';
    const result=await requester(session,`/api/v2/${resource}/${id}.json`);
    return {item:result.data[singular],session:result.session};
  }
  throw new ZendeskError(404,'Resource has no detail view');
}
function text(value,max=3000) { return typeof value==='string'?value.trim().slice(0,max):''; }
function validateInput(body) { if (!body || typeof body!=='object'||Array.isArray(body)) throw new ZendeskError(400,'JSON object required'); return body; }
export async function createResource(session,resource,input,requester=rawZendesk) {
  if (!session?.user) throw new ZendeskError(401,'Sign in required');
  input=validateInput(input);
  if (resource==='requests' || (['orders','quotes'].includes(resource)&&!isStaff(session))) {
    const subject=resource==='requests'?text(input.subject,200):`${SUBJECTS[resource]} — ${text(input.subject,140)}`;
    const body=text(input.description||input.body,3000);
    if (!subject||!body) throw new ZendeskError(400,'Subject and description are required');
    if(isStaff(session))throw new ZendeskError(403,'Use staff tickets');
    const tags=TAGS[resource]?[TAGS[resource]]:[];
    const ticket={subject,requester_id:Number(session.user.id),comment:{body,public:true},tags};
    const result=await requester(session,'/api/v2/tickets.json',{method:'POST',body:{ticket}});
    return {item:result.data.ticket,session:result.session};
  }
  requireRole(session);
  if (['tickets','orders','quotes','payments'].includes(resource)) {
    const subject=text(input.subject,200);
    const body=text(input.description||input.body,3000);
    if (!subject||!body) throw new ZendeskError(400,'Subject and description are required');
    const prefix=TAGS[resource]?`${SUBJECTS[resource]} — `:'';
    const ticket={subject:prefix+subject,comment:{body,public:true},tags:TAGS[resource]?[TAGS[resource]]:[],priority:'normal'};
    if (input.requester_id && /^\d+$/.test(String(input.requester_id))) ticket.requester_id=Number(input.requester_id);
    const result=await requester(session,'/api/v2/tickets.json',{method:'POST',body:{ticket}});
    return {item:result.data.ticket,session:result.session};
  }
  if (resource==='organizations') {
    const name=text(input.name,200);
    if (!name) throw new ZendeskError(400,'Company name required');
    const result=await requester(session,'/api/v2/organizations.json',{method:'POST',body:{organization:{name,notes:text(input.notes,2000)}}});
    return {item:result.data.organization,session:result.session};
  }
  if (resource==='users') {
    const name=text(input.name,200),email=text(input.email,250);
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new ZendeskError(400,'Valid name and email required');
    const result=await requester(session,'/api/v2/users.json',{method:'POST',body:{user:{name,email,role:'end-user'}}});
    return {item:result.data.user,session:result.session};
  }
  if (CUSTOM_OBJECTS[resource]) {
    const name=text(input.name,200);
    if (!name) throw new ZendeskError(400,'Record name required');
    const fields=Object.fromEntries(CUSTOM_OBJECTS[resource].fields.filter(([key])=>input[key]!==undefined).map(([key])=>[key,input[key]]));
    const key=CUSTOM_OBJECTS[resource].key;
    const result=await requester(session,`/api/v2/custom_objects/${key}/records`,{method:'POST',body:{custom_object_record:{name,custom_object_fields:fields}}});
    return {item:result.data.custom_object_record,session:result.session};
  }
  throw new ZendeskError(405,'This resource is read-only');
}
export async function updateResource(session,resource,id,input,requester=rawZendesk) {
  if (!session?.user) throw new ZendeskError(401,'Sign in required');
  id=safeId(id);input=validateInput(input);
  if (resource==='requests') {
    const body=text(input.comment,3000);
    if (!body) throw new ZendeskError(400,'A reply is required');
    if(isStaff(session))throw new ZendeskError(403,'Use staff tickets');
    const check=await requester(session,`/api/v2/tickets/${id}.json`);
    if(String(check.data.ticket?.requester_id)!==String(session.user.id))throw new ZendeskError(404,'Ticket not found');
    const result=await requester(check.session,`/api/v2/tickets/${id}.json`,{method:'PUT',body:{ticket:{comment:{body,public:true}}}});
    return {item:result.data.ticket,session:result.session};
  }
  requireRole(session);
  if (['tickets','orders','quotes','payments'].includes(resource)) {
    // Validation is explicit: no arbitrary Zendesk fields or hidden elevation.
    const ticket={};
    if (input.status!==undefined) {
      if (!['new','open','pending','hold','solved'].includes(input.status)) throw new ZendeskError(400,'Invalid ticket status');
      ticket.status=input.status;
    }
    if (input.priority!==undefined) {
      if (!['low','normal','high','urgent'].includes(input.priority)) throw new ZendeskError(400,'Invalid priority');
      ticket.priority=input.priority;
    }
    if (input.comment!==undefined) {
      const body=text(input.comment,3000);
      if (!body) throw new ZendeskError(400,'Comment cannot be empty');
      ticket.comment={body,public:input.public===true};
    }
    if (!Object.keys(ticket).length) throw new ZendeskError(400,'Nothing to update');
    if (TAGS[resource]) {
      const check=await requester(session,`/api/v2/tickets/${id}.json`);
      if (!(check.data.ticket?.tags||[]).includes(TAGS[resource]) && !String(check.data.ticket?.subject||'').startsWith(`${SUBJECTS[resource]} —`)) throw new ZendeskError(404,'Ticket not in selected queue');
      session=check.session;
    }
    const result=await requester(session,`/api/v2/tickets/${id}.json`,{method:'PUT',body:{ticket}});
    return {item:result.data.ticket,session:result.session};
  }
  if (CUSTOM_OBJECTS[resource]) {
    const fields=Object.fromEntries(CUSTOM_OBJECTS[resource].fields.filter(([key])=>input[key]!==undefined).map(([key])=>[key,input[key]]));
    const record={};if(input.name)record.name=text(input.name,200);
    if(Object.keys(fields).length)record.custom_object_fields=fields;
    if(!Object.keys(record).length)throw new ZendeskError(400,'Nothing to update');
    const result=await requester(session,`/api/v2/custom_objects/${CUSTOM_OBJECTS[resource].key}/records/${id}`,{method:'PATCH',body:{custom_object_record:record}});
    return {item:result.data.custom_object_record,session:result.session};
  }
  if (resource==='organizations') {
    const organization={};if(input.name)organization.name=text(input.name,200);if(input.notes!==undefined)organization.notes=text(input.notes,2000);
    if(!Object.keys(organization).length) throw new ZendeskError(400,'Nothing to update');
    const result=await requester(session,`/api/v2/organizations/${id}.json`,{method:'PUT',body:{organization}});
    return {item:result.data.organization,session:result.session};
  }
  throw new ZendeskError(405,'Updates are not available for this resource');
}
