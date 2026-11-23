'use client';
import {useEffect,useState,useCallback} from 'react';
import {LayoutDashboard,Ticket,Building2,Users,Package,ShoppingBag,ListChecks,CreditCard,BookOpen,ShieldCheck,SlidersHorizontal,Cable,Search,LogOut,ChevronRight,RefreshCw,Plus,Menu,X,CheckCircle2,AlertTriangle,Wrench,FileText,UserRound,Send,Eye,ClipboardList} from 'lucide-react';

const STAFF_NAV=[
 {label:'Dashboard',route:'dashboard',icon:LayoutDashboard,group:'WORK'},
 {label:'Tickets',route:'tickets',icon:Ticket,group:'WORK'},
 {label:'Orders',route:'orders',icon:ShoppingBag,group:'WORK'},
 {label:'Quotes',route:'quotes',icon:FileText,group:'WORK'},
 {label:'Payments',route:'payments',icon:CreditCard,group:'WORK'},
 {label:'Companies',route:'organizations',icon:Building2,group:'DIRECTORY'},
 {label:'People',route:'users',icon:Users,group:'DIRECTORY'},
 {label:'Catalog',route:'products',icon:Package,group:'OPERATIONS'},
 {label:'Services',route:'services',icon:Wrench,group:'OPERATIONS'},
 {label:'Ticket forms',route:'forms',icon:ListChecks,group:'SETUP'},
 {label:'Agent roles',route:'roles',icon:ShieldCheck,group:'SETUP'},
 {label:'Knowledge base',route:'knowledge',icon:BookOpen,group:'SETUP'},
 {label:'Zendesk',route:'zendesk',icon:Cable,group:'SETUP'},
 {label:'Settings',route:'settings',icon:SlidersHorizontal,group:'SETUP'},
];
const CUSTOMER_NAV=[
 {label:'Overview',route:'dashboard',icon:LayoutDashboard,group:'YOUR WORKSPACE'},
 {label:'My tickets',route:'requests',icon:Ticket,group:'YOUR WORKSPACE'},
 {label:'Orders',route:'orders',icon:ShoppingBag,group:'YOUR WORKSPACE'},
 {label:'Quotes',route:'quotes',icon:FileText,group:'YOUR WORKSPACE'},
 {label:'Catalog',route:'products',icon:Package,group:'SERVICES'},
 {label:'Knowledge base',route:'knowledge',icon:BookOpen,group:'SERVICES'},
 {label:'My account',route:'account',icon:UserRound,group:'ACCOUNT'},
];
const T= {dashboard:['Desk overview','Companies, Zendesk tickets, and equipment requests in one place.'],tickets:['Tickets','Your live support queue from Zendesk.'],requests:['My support tickets','Submit and follow your requests with MTS.'],organizations:['Companies','Organizations stored directly in Zendesk.'],users:['People','Customers and users managed in Zendesk.'],orders:['Orders','Order requests and fulfillment tickets stored in Zendesk.'],quotes:['Quotes','Track quote requests and approvals inside Zendesk.'],payments:['Payments','Payment-related service tickets. No card data or charges are processed here.'],products:['Equipment catalog','Live product records in Zendesk Custom Objects.'],services:['Services','Your service catalog backed by Zendesk.'],forms:['Ticket forms','Ticket forms configured in Zendesk.'],roles:['Agent roles','Agent permissions are governed by Zendesk.'],knowledge:['Knowledge base','Published Zendesk Help Center articles.'],zendesk:['Zendesk connection','One system of record. No local ticket synchronization.'],settings:['Settings','Configuration and organization preferences from Zendesk.'],account:['My account','Your account identity is managed by Zendesk.']};
const NEW_FIELDS={
 tickets:[['subject','Ticket subject'],['description','Describe the problem','textarea']],
 requests:[['subject','Ticket subject'],['description','Describe the problem','textarea']],
 organizations:[['name','Company name'],['notes','Notes','textarea']],
 users:[['name','Full name'],['email','Email','email']],
 orders:[['subject','Order summary'],['description','Items, quantities, delivery details','textarea']],
 quotes:[['subject','Quote request'],['description','Requirements and budget','textarea']],
 payments:[['subject','Payment reference'],['description','Payment tracking details (no card numbers)','textarea']],
 products:[['name','Product name'],['sku','SKU'],['description','Description','textarea'],['price','Unit price','number'],['stock','Stock','number']],
 services:[['name','Service name'],['description','Description','textarea'],['monthly_price','Monthly price','number']],
};
const TABLE_FIELDS={
 tickets:['id','subject','status','priority','updated_at'],requests:['id','subject','status','updated_at'],orders:['id','subject','status','updated_at'],quotes:['id','subject','status','updated_at'],payments:['id','subject','status','updated_at'],
 organizations:['id','name','notes','updated_at'],users:['id','name','email','role'],roles:['id','name','email','role'],
 products:['id','name','sku','price','stock'],services:['id','name','monthly_price','active'],forms:['id','name','active','updated_at'],
 knowledge:['id','title','updated_at'],settings:['locale','timezone','subdomain']
};
function pretty(k){return k.replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase())}
function cell(item,k){let value=item?.custom_object_fields?.[k]??item?.[k];if(value===undefined||value===null||value==='')return '—';if(typeof value==='boolean')return value?'Yes':'No';if(k.endsWith('_at')&&typeof value==='string')return new Date(value).toLocaleDateString();if(Array.isArray(value))return value.join(', ');if(typeof value==='object')return '—';return String(value)}
async function api(path,init={}){const response=await fetch(path,{...init,headers:{...(init.body?{'content-type':'application/json','x-mts-action':'1'}:{}),...init.headers},cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);return data}
function Status({children}){const s=String(children||'').toLowerCase();return <span className={'pill '+(['open','new','active'].includes(s)?'pill-ok':['pending','hold'].includes(s)?'pill-warn':'pill-neutral')}>{children||'—'}</span>}
function Empty({title='No records found',body='Zendesk has not returned any records for this view.'}){return <div className="empty"><div className="empty-icon"><FileText size={24}/></div><h3>{title}</h3><p>{body}</p></div>}
function ErrorPanel({message,onRetry}){return <div className="message-error"><AlertTriangle size={18}/><div><strong>Unable to load Zendesk data</strong><p>{message}</p></div>{onRetry?<button className="button outline small" onClick={onRetry}>Retry</button>:null}</div>}
export default function PortalApp({mode,view}){
 const [cart,setCart]=useState([]),[page,setPage]=useState(1),[after,setAfter]=useState(''),[session,setSession]=useState(null),[data,setData]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[searchField,setSearchField]=useState(''),[menu,setMenu]=useState(false),[create,setCreate]=useState(false),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[note,setNote]=useState(''),[publicComment,setPublicComment]=useState(false),[status,setStatus]=useState(''),[actionBusy,setActionBusy]=useState(false),[notice,setNotice]=useState('');
 const admin=mode==='admin',prefix=admin?'/admin':'/user',nav=admin?STAFF_NAV:CUSTOMER_NAV,actual=(!admin&&['orders','quotes'].includes(view))?'requests':view;
 const known=[...STAFF_NAV,...CUSTOMER_NAV].some(n=>n.route===view);
 const load=useCallback(async()=>{
  setBusy(true);setError('');setData(null);
  try{const s=await api('/api/session');setSession(s);
   if(!s.authenticated){window.location.replace('/login?next='+encodeURIComponent(admin?'/admin':'/user'));return;}
   if(admin && !['admin','agent'].includes(s.user.role)){setError('Your Zendesk account lacks agent permissions.');return;}
   if(['account','zendesk'].includes(view)){return;}
   const qs=new URLSearchParams({page:String(page)});if(searchField)qs.set('q',searchField);if(after)qs.set('after',after);
   const result=await api('/api/data/'+encodeURIComponent(actual)+'?'+qs.toString());
   setData(result);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 },[actual,admin,view,searchField,page,after]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{setSelected(null);setDetail(null);setCreate(false);setNotice('');setSearch('');setSearchField('');setPage(1);setAfter('')},[view]);
 async function submit(form){setActionBusy(true);setError('');setNotice('');try{
   const fields=Object.fromEntries(new FormData(form).entries());
   for(const key of ['price','stock','monthly_price'])if(fields[key]!==undefined&&fields[key]!=='')fields[key]=Number(fields[key]);
   const resource=(!admin&&['orders','quotes'].includes(view))?view:actual;
   await api('/api/data/'+resource,{method:'POST',body:JSON.stringify(fields)});
   setCreate(false);setNotice('Saved successfully in Zendesk.');await load();
  }catch(e){setError(e.message)}finally{setActionBusy(false)}}
 async function openRecord(item){setSelected(item);setDetail(null);setNote('');setStatus(item.status||'');if(['tickets','requests','orders','quotes','payments','organizations','users','products','services'].includes(actual)){try{const result=await api(`/api/data/${actual}/${item.id}`);setDetail(result)}catch(e){setError(e.message)}}}
 async function updateTicket(){if(!selected)return;setActionBusy(true);try{await api(`/api/data/${actual}/${selected.id}`,{method:'PATCH',body:JSON.stringify({...((admin&&selected.status!==status&&status)?{status}:{}),...(note?{comment:note,public:publicComment}:{})})});setNotice('Ticket updated in Zendesk.');const result=await api(`/api/data/${actual}/${selected.id}`);setDetail(result);setSelected(result.item);setNote('');await load()}catch(e){setError(e.message)}finally{setActionBusy(false)}}
 async function provision(){if(!window.confirm('Create missing MTS Product and Service custom objects and their fields in Zendesk? This changes the Zendesk schema.'))return;setActionBusy(true);try{const result=await api('/api/setup',{method:'POST',body:JSON.stringify({confirm:'PROVISION_MTS_OBJECTS'})});setNotice(`Custom objects ready: ${result.results.map(x=>x.key).join(', ')}`)}catch(e){setError(e.message)}finally{setActionBusy(false)}}
 async function requestOrder(){
  if(!cart.length)return;
  setActionBusy(true);setError('');
  try{
   const body=cart.map(({item,qty})=>`${qty} x ${item.name} (SKU ${item.custom_object_fields?.sku||'n/a'})`).join('\n');
   await api('/api/data/orders',{method:'POST',body:JSON.stringify({subject:`${cart.reduce((a,x)=>a+x.qty,0)} catalog items`,description:`Request from authenticated Zendesk customer #${session?.user?.id}.\n\n${body}\n\nPlease confirm current pricing, stock and delivery through Zendesk. No payment has been collected.`})});
   setCart([]);setNotice('Order request submitted to Zendesk. No payment was taken.');
  }catch(e){setError(e.message)}finally{setActionBusy(false)}
 }
 async function logout(){await api('/api/auth/logout',{method:'POST',body:'{}'});window.location.href='/login'}
 let rows=data?.items||[];
 if(!admin&&['orders','quotes'].includes(view))rows=rows.filter(x=>String(x.subject||'').startsWith(view==='orders'?'MTS Order —':'MTS Quote —'));
 const title=T[view]?.[0]||'MTS',subtitle=T[view]?.[1]||'Live from Zendesk';
 const stats=data?.stats;
 return <><div className="app-frame">
   <aside className={'sidebar '+(menu?'sidebar-show':'')}>
     <a className="side-brand" href={prefix}><span className="mark">M</span><span><strong>ManageTech</strong><small>{admin?'Admin desk':'Customer portal'}</small></span></a>
     <nav className="side-nav">{nav.map((n,i)=><div key={n.route}>{i===0||n.group!==nav[i-1].group?<span className="nav-group">{n.group}</span>:null}<a className={'nav-link '+(view===n.route?'active':'')} href={prefix+'/'+(n.route==='dashboard'?'':n.route)}><n.icon size={17}/><span>{n.label}</span></a></div>)}</nav>
     <div className="sidebar-bottom"><div className="health-pill"><span className="live-dot"/>Zendesk source of truth</div><p>{session?.user?.email||'Sign in to ManageTech'}</p><button onClick={logout} className="logout"><LogOut size={15}/> Sign out</button></div>
   </aside>
   {menu&&<div className="sidebar-mask" onClick={()=>setMenu(false)}/>}
   <div className="app-main"><header className="topbar"><button className="mobile-menu icon-button" onClick={()=>setMenu(!menu)}><Menu size={20}/></button><form className="global-search" onSubmit={e=>{e.preventDefault();setPage(1);setAfter('');setSearchField(search)}}><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search live Zendesk records" aria-label="Search Zendesk"/><button type="submit">Search</button></form><div className="top-user"><div><strong>{session?.user?.name||'Zendesk user'}</strong><small>{session?.user?.role||'Signing in'} · {session?.subdomain||'Zendesk'}</small></div><span className="avatar">{session?.user?.name?.charAt(0)||'M'}</span></div></header>
   <main className="content"><div className="page-head"><div><div className="eyebrow">{admin?'MANAGE TECH SERVICES':'YOUR MTS ACCOUNT'} · LIVE ZENDESK</div><h1>{title}</h1><p>{subtitle}</p></div><div className="head-actions"><button className="button outline" onClick={load}><RefreshCw size={15}/> Refresh</button>{NEW_FIELDS[view]&&!(view==='products'&&!admin)&&!(view==='services'&&!admin)&&view!=='payments'&&!(!admin&&view==='quotes')?<button className="button primary" onClick={()=>setCreate(true)}><Plus size={16}/> {view==='requests'?'New ticket':view==='orders'?'New order':`New ${view==='tickets'?'ticket':view==='quotes'?'quote':'record'}`}</button>:null}{view==='quotes'&&!admin?<button className="button primary" onClick={()=>setCreate(true)}><Plus size={16}/> Request quote</button>:null}</div></div>
   {notice?<div className="success"><CheckCircle2 size={18}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>:null}
   {error?<ErrorPanel message={error} onRetry={load}/>:null}
   {busy?<div className="loading">Connecting to Zendesk and loading your records…</div>:null}
   {!busy&&view==='dashboard'&&stats?<><div className="stats-grid">{(admin?[['Companies',stats.companies,'organizations'],['People',stats.people,'users'],['Open tickets',stats.openTickets,'tickets'],['Pending orders',stats.pendingOrders,'orders']]:[['Visible tickets',stats.visibleRequests,'requests'],['Active requests',stats.openRequests,'requests']]).map(([label,value,target])=><a className="stat-card" href={prefix+'/'+target} key={label}><small>{label}</small><strong>{value}</strong><span>View <ChevronRight size={13}/></span></a>)}</div>{admin?<div className="metrics-grid">{[['New',stats.new],['Pending',stats.pending],['Solved',stats.solved]].map(([k,v])=><div className="metric-card" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>:null}<section className="paper"><div className="section-top"><h2>Recent {admin?'tickets':'requests'}</h2><a href={prefix+'/'+(admin?'tickets':'requests')}>All tickets <ChevronRight size={14}/></a></div>{(data.recent||[]).length?<div className="record-list">{data.recent.map(item=><div className="ticket-row" key={item.id}><div><strong>{item.subject||`#${item.id}`}</strong><p>#{item.id} · {cell(item,'updated_at')}</p></div><Status>{item.status}</Status></div>)}</div>:<Empty title="Your Zendesk queue is empty" body="New records will appear here automatically after they exist in Zendesk."/>}</section>{data.partial?<p className="helper">Metrics are based on the first request page. Open My tickets for the complete Zendesk queue.</p>:null}</>:null}
   {!busy&&view==='zendesk'?<div className="two-column"><section className="paper"><h2>Connection details</h2><p className="paper-desc">This portal authenticates every action against the new Zendesk account. Credentials and access tokens are never exposed in the client UI.</p><div className="data-row"><span>Zendesk tenant</span><strong>{session?.subdomain}.zendesk.com</strong></div><div className="data-row"><span>Signed in as</span><strong>{session?.user?.email||'—'}</strong></div><div className="data-row"><span>Zendesk role</span><Status>{session?.user?.role}</Status></div><div className="data-row"><span>Source of truth</span><strong>Zendesk Support + Custom Objects</strong></div><div className="data-row"><span>Conversations key</span><Status>{session?.conversationsConfigured?'Configured':'Not configured'}</Status></div><p className="helper">All management operations run securely through the MTS backend. Staff never need the native Zendesk console.</p></section><section className="paper"><h2>Custom object setup</h2><p className="paper-desc">The Catalog and Services modules require <code>mts_product</code> and <code>mts_service</code> custom objects. Provisioning changes Zendesk itself, never a local database.</p><button className="button primary" disabled={session?.user?.role!=='admin'||actionBusy} onClick={provision}>Provision MTS custom objects</button><p className="helper">Requires Zendesk admin permissions and Custom Objects entitlement. Existing records and fields are preserved.</p></section></div>:null}
   {!busy&&view==='account'?<section className="paper"><h2>Your Zendesk identity</h2>{[['Full name',session?.user?.name],['Email',session?.user?.email],['Zendesk ID',session?.user?.id],['Role',session?.user?.role],['Organization ID',session?.user?.organization_id]].map(([k,v])=><div className="data-row" key={k}><span>{k}</span><strong>{v||'—'}</strong></div>)}<p className="helper">Account data is maintained in the MTS portal and stored in Zendesk.</p></section>:null}
   {!busy&&!['dashboard','zendesk','account'].includes(view)&&known&&data?<section className="paper"><div className="section-top"><h2>{title}</h2><span className="muted">{rows.length} records shown{data.next?' · more in Zendesk':''}</span></div>{!admin&&view==='products'&&cart.length?<div className="cart-panel"><div><strong>Order request · {cart.reduce((a,x)=>a+x.qty,0)} items</strong><p>{cart.map(x=>`${x.qty}× ${x.item.name}`).join(', ')}</p></div><button className="button primary" disabled={actionBusy} onClick={requestOrder}>{actionBusy?'Submitting…':'Submit request to Zendesk'}</button></div>:null}{rows.length?<div className="table-scroll"><table><thead><tr>{(TABLE_FIELDS[view]||['id','name']).map(field=><th key={field}>{pretty(field)}</th>)}<th></th></tr></thead><tbody>{rows.map(item=><tr key={item.id}>{(TABLE_FIELDS[view]||['id','name']).map(field=><td key={field}>{['status','role','active'].includes(field)?<Status>{cell(item,field)}</Status>:<span>{cell(item,field)}</span>}</td>)}<td><div className="table-actions"><button className="row-action" onClick={()=>openRecord(item)}><Eye size={16}/> View</button>{!admin&&view==='products'?<button className="row-action" onClick={()=>setCart(prev=>{const match=prev.find(x=>x.item.id===item.id);return match?prev.map(x=>x.item.id===item.id?{...x,qty:x.qty+1}:x):[...prev,{item,qty:1}]})}><Plus size={15}/> Add</button>:null}</div></td></tr>)}</tbody></table></div>:<Empty title={view==='products'||view==='services'?'No records or object has not been populated':'No Zendesk records yet'} body="Only records stored in Zendesk are displayed. Use New to create a live record."/>}{data.next||page>1?<div className="pagination"><span>Page {page}</span><button className="button outline" disabled={page===1} onClick={()=>{setPage(1);setAfter('')}}>First page</button>{data.next?<button className="button outline" onClick={()=>{setAfter(data.after||'');setPage(p=>p+1)}}>Next page <ChevronRight size={14}/></button>:null}</div>:null}</section>:null}
   {!busy&&!known?<Empty title="Page not found" body="This module is not part of the Zendesk-backed portal."/>:null}
   <footer className="main-footer"><span>Manage Tech Services</span><span>Live Zendesk data · No shadow database</span></footer>
   </main></div></div>
   {create?<div className="modal-mask" onMouseDown={e=>{if(e.target===e.currentTarget)setCreate(false)}}><div className="modal"><div className="modal-head"><div><h2>New {view==='requests'?'ticket':view.slice(0,-1)}</h2><p>This creates a real Zendesk record.</p></div><button className="icon-button" onClick={()=>setCreate(false)}><X size={19}/></button></div><form onSubmit={e=>{e.preventDefault();submit(e.currentTarget)}} className="form-grid">{(NEW_FIELDS[view]||[]).map(([key,label,type])=><label key={key}>{label}{type==='textarea'?<textarea name={key} rows="4" required={key==='description'}/>:<input name={key} required={['name','subject','email'].includes(key)} type={type||'text'} step={type==='number'?'any':undefined}/>}</label>)}<div className="modal-actions"><button type="button" className="button outline" onClick={()=>setCreate(false)}>Cancel</button><button type="submit" disabled={actionBusy} className="button primary">{actionBusy?'Saving…':'Save to Zendesk'}</button></div></form></div></div>:null}
   {selected?<div className="modal-mask" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div className="detail-modal"><div className="modal-head"><div><span className="eyebrow">ZENDESK RECORD #{selected.id}</span><h2>{selected.subject||selected.title||selected.name}</h2></div><button className="icon-button" onClick={()=>setSelected(null)}><X size={20}/></button></div><div className="detail-body"><div className="data-row"><span>ID</span><strong>{selected.id}</strong></div>{Object.entries(detail?.item||selected).filter(([k,v])=>['status','priority','email','name','description','created_at','updated_at','requester_id','organization_id'].includes(k)).map(([k,v])=><div className="data-row" key={k}><span>{pretty(k)}</span><strong>{cell({[k]:v},k)}</strong></div>)}{detail?.comments?.length?<div className="comments"><h3>Conversation</h3>{detail.comments.map((c,i)=><div key={c.id||i} className="comment"><div><span>{c.public===false?'Internal note':'Public reply'}</span><small>{cell(c,'created_at')}</small></div><p>{c.plain_body||c.body||'—'}</p></div>)}</div>:null}{(admin&&['tickets','orders','quotes','payments'].includes(view))||(!admin&&['requests','orders','quotes'].includes(view))?<div className="comment-form"><h3>{admin?'Update ticket':'Reply to support'}</h3>{admin?<label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="hold">On hold</option><option value="solved">Solved</option></select></label>:null}<label>Reply / note<textarea value={note} onChange={e=>setNote(e.target.value)} rows="4" placeholder="Optional message"/></label>{admin?<label className="inline-check"><input type="checkbox" checked={publicComment} onChange={e=>setPublicComment(e.target.checked)}/> Public reply (unchecked = internal note)</label>:null}<button className="button primary" disabled={actionBusy||(!note&&(!admin||status===selected.status))} onClick={updateTicket}><Send size={16}/> Save update</button></div>:null}</div></div></div>:null}
  </>
}
