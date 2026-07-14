const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUS = { OPEN:'open', SOON:'soon', CLOSED:'closed', TBA:'tba' };
const DESCRIPTOR_FIELDS = [
  ['practice_areas','Practice areas'],
  ['firm_size','Firm size'],
  ['training_initiatives','Training initiatives'],
  ['secondments','Secondments'],
  ['career_progression','Career progression'],
  ['culture','Firm culture'],
  ['tech_innovation','Tech and innovation'],
  ['main_clients','Main clients'],
  ['dei_csr','DEI and CSR']
];

let state = {
  session: null,
  isAdmin: false,
  tab: 'home',
  firms: [],
  events: [],
  favorites: [],       // array of firm ids
  notes: {},           // firmId -> {reasons, questions}
  exams: [],
  detailFirmId: null,
  showFirmModal: false,
  showEventModal: false,
  editingFirm: null,
  editingEvent: null,
  authMode: 'login',
  authError: ''
};

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1900);
}
function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function fmtDate(d){ if(!d) return '—'; const dt=new Date(d+'T00:00:00'); return dt.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
function daysUntil(d){ const now=new Date(); now.setHours(0,0,0,0); const dt=new Date(d+'T00:00:00'); return Math.ceil((dt-now)/86400000); }
function getStatus(open, close){
  const now = new Date();
  const o = open ? new Date(open) : null;
  const c = close ? new Date(close) : null;
  if(!o && !c) return STATUS.TBA;
  if(c && now > c) return STATUS.CLOSED;
  if(o && now < o) return (Math.ceil((o-now)/86400000) <= 21) ? STATUS.SOON : STATUS.TBA;
  if((!o || now>=o) && (!c || now<=c)) return STATUS.OPEN;
  return STATUS.TBA;
}
function statusLabel(s, open, close){
  if(s===STATUS.OPEN) return close ? 'open · closes '+fmtDate(close) : 'open now';
  if(s===STATUS.SOON) return 'opens '+fmtDate(open);
  if(s===STATUS.CLOSED) return 'closed';
  return 'dates tba';
}
function el(tag, opts={}, children=[]){
  const e = document.createElement(tag);
  Object.entries(opts).forEach(([k,v])=>{
    if(k==='class') e.className=v;
    else if(k==='html') e.innerHTML=v;
    else if(k.startsWith('on')) e[k]=v;
    else e.setAttribute(k,v);
  });
  children.forEach(c=> c && e.appendChild(c));
  return e;
}

// ---------------- Auth ----------------
async function init(){
  const { data:{ session } } = await supabase.auth.getSession();
  state.session = session;
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    if(session) loadAllData(); else render();
  });
  if(session) await loadAllData(); else render();
}

function renderAuthScreen(){
  const root = document.getElementById('root');
  root.innerHTML = '';
  const wrap = el('div',{class:'auth-screen'});
  wrap.appendChild(el('h1',{html:'Vac Attack'}));
  wrap.appendChild(el('p',{class:'tag',html:'Track vacation schemes with your group. Your notes stay private to you.'}));

  const emailIn = el('input',{type:'email',placeholder:'you@example.com'});
  const passIn = el('input',{type:'password',placeholder:'Password (6+ characters)',style:'margin-top:.6rem;'});
  wrap.appendChild(el('label',{html:'Email'}));
  wrap.appendChild(emailIn);
  wrap.appendChild(el('label',{html:'Password'}));
  wrap.appendChild(passIn);

  if(state.authError) wrap.appendChild(el('p',{class:'error-text',html:escapeHtml(state.authError)}));

  const submitBtn = el('button',{class:'btn full',style:'margin-top:1rem;'});
  submitBtn.textContent = state.authMode==='login' ? 'Log in' : 'Sign up';
  submitBtn.onclick = async ()=>{
    state.authError='';
    if(!emailIn.value || passIn.value.length < 6){ state.authError='Enter an email and a password of at least 6 characters.'; render(); return; }
    let result;
    if(state.authMode==='login'){
      result = await supabase.auth.signInWithPassword({ email: emailIn.value, password: passIn.value });
    } else {
      result = await supabase.auth.signUp({ email: emailIn.value, password: passIn.value });
    }
    if(result.error){ state.authError = result.error.message; render(); return; }
    if(state.authMode==='signup' && !result.data.session){
      state.authError = 'Check your email to confirm your account, then come back and log in.';
      state.authMode='login';
      render();
      return;
    }
    state.session = result.data.session;
    await loadAllData();
  };
  wrap.appendChild(submitBtn);

  const toggleRow = el('div',{class:'auth-toggle'});
  const toggleBtn = el('button',{class:'btn secondary full'});
  toggleBtn.textContent = state.authMode==='login' ? "New here? Sign up" : "Already got an account? Log in";
  toggleBtn.onclick = ()=>{ state.authMode = state.authMode==='login' ? 'signup' : 'login'; state.authError=''; render(); };
  toggleRow.appendChild(toggleBtn);
  wrap.appendChild(toggleRow);

  root.appendChild(wrap);
}

async function logout(){
  await supabase.auth.signOut();
  state = { ...state, session:null, isAdmin:false, tab:'home', firms:[], events:[], favorites:[], notes:{}, exams:[] };
  render();
}

// ---------------- Data loading ----------------
async function loadAllData(){
  const uid = state.session.user.id;
  const [profileRes, firmsRes, eventsRes, favRes, notesRes, examsRes] = await Promise.all([
    supabase.from('profiles').select('is_admin').eq('id', uid).single(),
    supabase.from('firms').select('*').order('name'),
    supabase.from('events').select('*').order('date'),
    supabase.from('user_favorites').select('firm_id').eq('user_id', uid),
    supabase.from('user_notes').select('*').eq('user_id', uid),
    supabase.from('user_exams').select('*').eq('user_id', uid).order('date')
  ]);
  state.isAdmin = !!(profileRes.data && profileRes.data.is_admin);
  state.firms = firmsRes.data || [];
  state.events = eventsRes.data || [];
  state.favorites = (favRes.data||[]).map(r=>r.firm_id);
  state.notes = {};
  (notesRes.data||[]).forEach(n=>{ state.notes[n.firm_id] = { reasons:n.reasons||'', questions:n.questions||'' }; });
  state.exams = examsRes.data || [];
  render();
}

async function toggleFavorite(firmId){
  const uid = state.session.user.id;
  if(state.favorites.includes(firmId)){
    await supabase.from('user_favorites').delete().eq('user_id', uid).eq('firm_id', firmId);
    state.favorites = state.favorites.filter(id=>id!==firmId);
  } else {
    await supabase.from('user_favorites').insert({ user_id: uid, firm_id: firmId });
    state.favorites.push(firmId);
  }
  render();
}

async function saveNote(firmId, field, value){
  const uid = state.session.user.id;
  state.notes[firmId] = state.notes[firmId] || { reasons:'', questions:'' };
  state.notes[firmId][field] = value;
  await supabase.from('user_notes').upsert({
    user_id: uid, firm_id: firmId,
    reasons: state.notes[firmId].reasons, questions: state.notes[firmId].questions
  });
}

async function addExam(subject, date){
  const uid = state.session.user.id;
  const { data, error } = await supabase.from('user_exams').insert({ user_id: uid, subject, date }).select().single();
  if(error){ toast('Could not save that.'); return; }
  state.exams.push(data);
  render();
}
async function removeExam(id){
  await supabase.from('user_exams').delete().eq('id', id);
  state.exams = state.exams.filter(e=>e.id!==id);
  render();
}

async function saveFirm(draft, isNew){
  const payload = { ...draft };
  delete payload.created_at;
  let error;
  if(isNew){ delete payload.id; ({ error } = await supabase.from('firms').insert(payload)); }
  else { ({ error } = await supabase.from('firms').update(payload).eq('id', draft.id)); }
  if(error){ toast('Save failed: '+error.message); return false; }
  await loadAllData();
  return true;
}
async function deleteFirm(id){
  const { error } = await supabase.from('firms').delete().eq('id', id);
  if(error){ toast('Delete failed: '+error.message); return; }
  await loadAllData();
}
async function saveEvent(draft, isNew){
  const payload = { ...draft };
  let error;
  if(isNew){ delete payload.id; ({ error } = await supabase.from('events').insert(payload)); }
  else { ({ error } = await supabase.from('events').update(payload).eq('id', draft.id)); }
  if(error){ toast('Save failed: '+error.message); return false; }
  await loadAllData();
  return true;
}
async function deleteEvent(id){
  const { error } = await supabase.from('events').delete().eq('id', id);
  if(error){ toast('Delete failed: '+error.message); return; }
  await loadAllData();
}

// ---------------- Render ----------------
function render(){
  if(!state.session){ renderAuthScreen(); return; }
  const root = document.getElementById('root');
  root.innerHTML = '';
  const app = el('div',{class:'app'});
  const header = el('div',{class:'header'});
  header.appendChild(el('div',{},[
    el('h1',{html:'Vac Attack'}),
    el('p',{html: state.firms.length+' firms tracked'})
  ]));
  const headerBtns = el('div',{style:'display:flex;flex-direction:column;gap:.35rem;align-items:flex-end;'});
  const lockBtn = el('button',{class:'lock-btn'+(state.isAdmin?' unlocked':'')});
  lockBtn.textContent = state.isAdmin ? 'Curator ✓' : 'Read only';
  lockBtn.title = state.isAdmin ? 'You can edit shared firm and event data' : 'Ask your group admin to grant curator access';
  headerBtns.appendChild(lockBtn);
  const logoutBtn = el('button',{class:'lock-btn',style:'font-size:.65rem;'}); logoutBtn.textContent='Log out';
  logoutBtn.onclick = logout;
  headerBtns.appendChild(logoutBtn);
  header.appendChild(headerBtns);
  app.appendChild(header);

  const main = el('main',{});
  if(state.tab==='home') main.appendChild(renderHome());
  if(state.tab==='firms') main.appendChild(renderFirmList());
  if(state.tab==='detail') main.appendChild(renderFirmDetail());
  if(state.tab==='events') main.appendChild(renderEvents());
  if(state.tab==='exams') main.appendChild(renderExams());
  app.appendChild(main);

  app.appendChild(renderNav());
  root.appendChild(app);
  if(state.showFirmModal) root.appendChild(renderFirmModal());
  if(state.showEventModal) root.appendChild(renderEventModal());
}

function renderNav(){
  const items = [['home','Home','⌂'],['firms','Firms','☰'],['events','Events','◷'],['exams','Exams','✎']];
  const nav = el('div',{class:'bottom-nav'});
  items.forEach(([id,label,ic])=>{
    const b = el('button',{class:'nav-btn'+((state.tab===id||(id==='firms'&&state.tab==='detail'))?' active':'')});
    b.innerHTML = '<span class="ic">'+ic+'</span><span>'+label+'</span>';
    b.onclick = ()=>{ state.tab=id; state.detailFirmId=null; render(); };
    nav.appendChild(b);
  });
  return nav;
}

function renderHome(){
  const wrap = document.createDocumentFragment();
  const favCard = el('div',{class:'card'});
  favCard.appendChild(el('div',{class:'section-title',html:'Your favourites'}));
  const favFirms = state.firms.filter(f=>state.favorites.includes(f.id));
  if(favFirms.length===0){
    favCard.appendChild(el('div',{class:'empty',html:'<p>No firms starred yet.</p><p>Star firms from the Firms tab to pin them here.</p>'}));
  } else {
    favFirms.forEach(f=> favCard.appendChild(firmRow(f)));
  }
  wrap.appendChild(favCard);

  const dl = el('div',{class:'card'});
  dl.appendChild(el('div',{class:'section-title',html:'Upcoming deadlines'}));
  const events = [];
  state.firms.forEach(f=>{
    if(f.summer_close) events.push({firm:f.name,firmId:f.id,label:'Summer scheme closes',date:f.summer_close});
    if(f.summer_open) events.push({firm:f.name,firmId:f.id,label:'Summer scheme opens',date:f.summer_open});
    if(f.winter_close) events.push({firm:f.name,firmId:f.id,label:'Winter scheme closes',date:f.winter_close});
    if(f.winter_open) events.push({firm:f.name,firmId:f.id,label:'Winter scheme opens',date:f.winter_open});
  });
  const upcoming = events.filter(e=>daysUntil(e.date)>=0).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,6);
  if(upcoming.length===0){
    dl.appendChild(el('div',{class:'empty',html:'<p>No upcoming dates logged yet.</p>'}));
  } else {
    upcoming.forEach(e=>{
      const row = el('div',{class:'dashboard-item',style:'cursor:pointer;'});
      row.onclick = ()=>{ state.tab='detail'; state.detailFirmId=e.firmId; render(); };
      row.appendChild(el('div',{},[
        el('div',{class:'dash-label',html:escapeHtml(e.firm)}),
        el('div',{class:'dash-sub',html:e.label+' · '+fmtDate(e.date)})
      ]));
      row.appendChild(el('div',{class:'dash-sub',html:daysUntil(e.date)+'d'}));
      dl.appendChild(row);
    });
  }
  wrap.appendChild(dl);

  const evCard = el('div',{class:'card'});
  evCard.appendChild(el('div',{class:'section-title',html:'Events soon'}));
  const upcomingEvents = state.events.filter(e=>daysUntil(e.date)>=0).slice(0,4);
  if(upcomingEvents.length===0){
    evCard.appendChild(el('div',{class:'empty',html:'<p>No events logged yet.</p>'}));
  } else {
    upcomingEvents.forEach(e=>{
      const row = el('div',{class:'dashboard-item'});
      row.appendChild(el('div',{},[
        el('div',{class:'dash-label',html:escapeHtml(e.name)}),
        el('div',{class:'dash-sub',html:fmtDate(e.date)+(e.location?(' · '+escapeHtml(e.location)):'')})
      ]));
      evCard.appendChild(row);
    });
  }
  wrap.appendChild(evCard);
  wrap.appendChild(el('p',{class:'source-note',html:'Firm data and events are curated by your group\u2019s admin. Your notes and favourites are private to your account.'}));
  return wrap;
}

function firmRow(f){
  const row = el('div',{class:'firm-row'});
  const star = el('button',{class:'star-btn'+(state.favorites.includes(f.id)?' active':''),html: state.favorites.includes(f.id)?'★':'☆'});
  star.onclick = (e)=>{ e.stopPropagation(); toggleFavorite(f.id); };
  row.appendChild(star);
  const main = el('div',{class:'firm-row-main'});
  main.appendChild(el('p',{class:'firm-row-name',html:escapeHtml(f.name)}));
  main.appendChild(el('p',{class:'firm-row-sub',html:escapeHtml(f.offices||'Offices not set')}));
  row.appendChild(main);
  const sSummer = getStatus(f.summer_open,f.summer_close);
  if(f.summer_open||f.summer_close) row.appendChild(el('span',{class:'stamp '+sSummer,html:sSummer}));
  row.appendChild(el('span',{class:'chevron',html:'›'}));
  row.onclick = ()=>{ state.tab='detail'; state.detailFirmId=f.id; render(); };
  return row;
}

function renderFirmList(){
  const wrap = document.createDocumentFragment();
  const title = el('div',{class:'section-title'});
  title.appendChild(document.createTextNode('All firms ('+state.firms.length+')'));
  if(state.isAdmin){
    const addBtn = el('button',{class:'btn small'}); addBtn.textContent='+ Add';
    addBtn.onclick = ()=>{ state.editingFirm=null; state.showFirmModal=true; render(); };
    title.appendChild(addBtn);
  }
  wrap.appendChild(title);
  if(!state.isAdmin) wrap.appendChild(el('p',{class:'helper',html:'This list is curated by your group\u2019s admin.'}));
  if(state.firms.length===0){
    wrap.appendChild(el('div',{class:'empty',html:'<p>No firms added yet.</p>'}));
    return wrap;
  }
  state.firms.forEach(f=> wrap.appendChild(firmRow(f)));
  return wrap;
}

function renderFirmDetail(){
  const f = state.firms.find(x=>x.id===state.detailFirmId);
  const wrap = document.createDocumentFragment();
  const back = el('button',{class:'back-btn',html:'‹ Back to firms'});
  back.onclick = ()=>{ state.tab='firms'; render(); };
  wrap.appendChild(back);
  if(!f){ wrap.appendChild(el('div',{class:'empty',html:'<p>Firm not found.</p>'})); return wrap; }

  const card = el('div',{class:'card'});
  const titleRow = el('div',{class:'detail-title'});
  titleRow.appendChild(el('h2',{html:escapeHtml(f.name)}));
  const star = el('button',{class:'star-btn'+(state.favorites.includes(f.id)?' active':''),html: state.favorites.includes(f.id)?'★':'☆'});
  star.onclick = ()=> toggleFavorite(f.id);
  titleRow.appendChild(star);
  card.appendChild(titleRow);
  if(f.offices) card.appendChild(el('p',{class:'offices-line',html:'Offices: '+escapeHtml(f.offices)}));
  if(f.eligibility) card.appendChild(el('p',{class:'offices-line',html:'Eligibility: '+escapeHtml(f.eligibility)}));

  const stampRow = el('div',{class:'stamp-row'});
  const sSummer = getStatus(f.summer_open,f.summer_close);
  const sWinter = getStatus(f.winter_open,f.winter_close);
  if(f.summer_open||f.summer_close) stampRow.appendChild(el('span',{class:'stamp '+sSummer,html:'Summer: '+statusLabel(sSummer,f.summer_open,f.summer_close)}));
  if(f.winter_open||f.winter_close) stampRow.appendChild(el('span',{class:'stamp '+sWinter,html:'Winter: '+statusLabel(sWinter,f.winter_open,f.winter_close)}));
  if(stampRow.children.length) card.appendChild(stampRow);

  const dl = el('dl',{class:'descriptor-grid'});
  DESCRIPTOR_FIELDS.forEach(([key,label])=>{
    if(f[key]){ dl.appendChild(el('dt',{html:label})); dl.appendChild(el('dd',{html:escapeHtml(f[key])})); }
  });
  (f.custom_fields||[]).forEach(cf=>{
    if(cf.label && cf.value){ dl.appendChild(el('dt',{html:escapeHtml(cf.label)})); dl.appendChild(el('dd',{html:escapeHtml(cf.value)})); }
  });
  if(dl.children.length) card.appendChild(dl);

  if(f.application_questions && f.application_questions.length){
    card.appendChild(el('dt',{style:'color:var(--text-soft);font-weight:600;font-size:.7rem;text-transform:uppercase;letter-spacing:.4px;margin:.7rem 0 0;',html:'Application questions'}));
    const ul = el('ul',{style:'margin:.3rem 0 0;padding-left:1.1rem;font-size:.85rem;'});
    f.application_questions.forEach(q=> ul.appendChild(el('li',{html:escapeHtml(q)})));
    card.appendChild(ul);
  }
  if(f.notes) card.appendChild(el('p',{style:'margin-top:.7rem;font-style:italic;font-size:.85rem;color:var(--text-soft);',html:escapeHtml(f.notes)}));

  if(state.isAdmin){
    const actions = el('div',{style:'display:flex;gap:.5rem;margin-top:.9rem;'});
    const editBtn = el('button',{class:'btn secondary small'}); editBtn.textContent='Edit firm data';
    editBtn.onclick = ()=>{ state.editingFirm=f.id; state.showFirmModal=true; render(); };
    const delBtn = el('button',{class:'btn danger small'}); delBtn.textContent='Remove firm';
    delBtn.onclick = async ()=>{ if(confirm('Remove '+f.name+' for everyone?')){ await deleteFirm(f.id); state.tab='firms'; render(); toast('Removed.'); } };
    actions.appendChild(editBtn); actions.appendChild(delBtn);
    card.appendChild(actions);
  }
  wrap.appendChild(card);

  const newsCard = el('div',{class:'card'});
  newsCard.appendChild(el('div',{class:'section-title',html:'Firm news'}));
  const realNews = (f.news||[]).filter(n=>n.headline);
  if(realNews.length===0){
    newsCard.appendChild(el('div',{class:'empty',html:'<p>No news logged yet.</p>'}));
  } else {
    realNews.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).forEach(n=>{
      const item = el('div',{class:'news-item'});
      if(n.date) item.appendChild(el('div',{class:'news-date',html:fmtDate(n.date)}));
      item.appendChild(el('div',{class:'news-headline',html:escapeHtml(n.headline)}));
      if(n.url) item.appendChild(el('a',{href:n.url,target:'_blank',rel:'noopener',style:'font-size:.78rem;color:var(--ink-soft);',html:'Read more ↗'}));
      newsCard.appendChild(item);
    });
  }
  if(state.isAdmin){
    newsCard.appendChild(el('p',{class:'helper',style:'margin-top:.6rem;',html:'Add updates as you find them, or ask Claude to search for firm news and paste it in here.'}));
    const addNewsBtn = el('button',{class:'btn secondary small'}); addNewsBtn.textContent='Edit news';
    addNewsBtn.onclick = ()=>{ state.editingFirm=f.id; state.showFirmModal=true; render(); };
    newsCard.appendChild(addNewsBtn);
  }
  wrap.appendChild(newsCard);

  const notesBox = el('div',{class:'notes-box'});
  notesBox.appendChild(el('h3',{html:'Your private notes'}));
  notesBox.appendChild(el('p',{class:'helper',style:'margin-bottom:.5rem;',html:'Only visible to you — stored under your account, never shared.'}));
  const pn = state.notes[f.id] || {reasons:'', questions:''};
  notesBox.appendChild(el('label',{style:'margin-top:0;',html:'Why you like this firm'}));
  const reasonsTa = el('textarea',{}); reasonsTa.value = pn.reasons||'';
  reasonsTa.onblur = ()=> saveNote(f.id, 'reasons', reasonsTa.value);
  notesBox.appendChild(reasonsTa);
  notesBox.appendChild(el('label',{html:'Questions you want to ask'}));
  const qTa = el('textarea',{}); qTa.value = pn.questions||'';
  qTa.onblur = ()=> saveNote(f.id, 'questions', qTa.value);
  notesBox.appendChild(qTa);
  wrap.appendChild(notesBox);
  return wrap;
}

function renderFirmModal(){
  const editing = state.editingFirm ? state.firms.find(f=>f.id===state.editingFirm) : null;
  const draft = editing ? JSON.parse(JSON.stringify(editing)) : {
    id:null, name:'', offices:'', eligibility:'', notes:'',
    summer_open:null, summer_close:null, winter_open:null, winter_close:null,
    application_questions:[], custom_fields:[], news:[]
  };
  DESCRIPTOR_FIELDS.forEach(([k])=>{ if(!(k in draft)) draft[k]=''; });
  draft.application_questions = draft.application_questions || [];
  draft.custom_fields = draft.custom_fields || [];
  draft.news = draft.news || [];

  const overlay = el('div',{class:'modal-overlay'});
  overlay.onclick = (e)=>{ if(e.target===overlay){ state.showFirmModal=false; render(); } };
  const modal = el('div',{class:'modal'});
  const closeBtn = el('button',{class:'modal-close',html:'&times;'});
  closeBtn.onclick = ()=>{ state.showFirmModal=false; render(); };
  modal.appendChild(closeBtn);
  modal.appendChild(el('h2',{html: editing ? 'Edit firm' : 'Add a firm'}));
  modal.appendChild(el('p',{class:'helper',html:'Saved for everyone in the group.'}));

  function field(labelText, key, isTextarea=false){
    modal.appendChild(el('label',{html:labelText}));
    const input = el(isTextarea?'textarea':'input',{type:'text'});
    input.value = draft[key]||'';
    input.oninput = ()=> draft[key]=input.value;
    modal.appendChild(input);
  }
  field('Firm name','name');
  field('Offices (comma separated)','offices');
  DESCRIPTOR_FIELDS.forEach(([key,label])=> field(label,key, key!=='firm_size'));
  field('Eligibility criteria','eligibility',true);

  modal.appendChild(el('label',{html:'Vacation scheme dates'}));
  const grid = el('div',{class:'grid2'});
  function dateField(labelText,key){
    const w = el('div',{});
    w.appendChild(el('label',{style:'margin-top:.4rem;',html:labelText}));
    const inp = el('input',{type:'date'}); inp.value = draft[key]||'';
    inp.oninput = ()=> draft[key]= inp.value || null;
    w.appendChild(inp);
    return w;
  }
  grid.appendChild(dateField('Summer opens','summer_open'));
  grid.appendChild(dateField('Summer closes','summer_close'));
  grid.appendChild(dateField('Winter opens','winter_open'));
  grid.appendChild(dateField('Winter closes','winter_close'));
  modal.appendChild(grid);

  modal.appendChild(el('label',{html:'Application questions'}));
  const qaList = el('div',{});
  function renderQA(){
    qaList.innerHTML='';
    draft.application_questions.forEach((q,i)=>{
      const row = el('div',{class:'qa-item'});
      const inp = el('input',{type:'text'}); inp.value=q;
      inp.oninput = ()=> draft.application_questions[i]=inp.value;
      const rm = el('button',{class:'btn secondary small'}); rm.textContent='Remove';
      rm.onclick = ()=>{ draft.application_questions.splice(i,1); renderQA(); };
      row.appendChild(inp); row.appendChild(rm);
      qaList.appendChild(row);
    });
  }
  renderQA(); modal.appendChild(qaList);
  const addQ = el('button',{class:'btn secondary small',style:'margin-top:.3rem;'}); addQ.textContent='+ Add question';
  addQ.onclick = ()=>{ draft.application_questions.push(''); renderQA(); };
  modal.appendChild(addQ);

  modal.appendChild(el('label',{html:'Other descriptors'}));
  const cfList = el('div',{});
  function renderCF(){
    cfList.innerHTML='';
    draft.custom_fields.forEach((cf,i)=>{
      const row = el('div',{class:'custom-field-row'});
      const l = el('input',{type:'text',placeholder:'Field name'}); l.value=cf.label||'';
      l.oninput = ()=> draft.custom_fields[i].label = l.value;
      const v = el('input',{type:'text',placeholder:'Value'}); v.value=cf.value||'';
      v.oninput = ()=> draft.custom_fields[i].value = v.value;
      const rm = el('button',{class:'btn secondary small'}); rm.textContent='Remove';
      rm.onclick = ()=>{ draft.custom_fields.splice(i,1); renderCF(); };
      row.appendChild(l); row.appendChild(v); row.appendChild(rm);
      cfList.appendChild(row);
    });
  }
  renderCF(); modal.appendChild(cfList);
  const addCF = el('button',{class:'btn secondary small',style:'margin-top:.3rem;'}); addCF.textContent='+ Add field';
  addCF.onclick = ()=>{ draft.custom_fields.push({label:'',value:''}); renderCF(); };
  modal.appendChild(addCF);

  modal.appendChild(el('label',{html:'News items'}));
  const newsList = el('div',{});
  function renderNewsList(){
    newsList.innerHTML='';
    draft.news.forEach((n,i)=>{
      const row = el('div',{style:'border:1px solid var(--line);border-radius:6px;padding:.5rem;margin-bottom:.4rem;'});
      const headIn = el('input',{type:'text',placeholder:'Headline'}); headIn.value=n.headline||'';
      headIn.oninput = ()=> draft.news[i].headline = headIn.value;
      const dateIn = el('input',{type:'date',style:'margin-top:.3rem;'}); dateIn.value=n.date||'';
      dateIn.oninput = ()=> draft.news[i].date = dateIn.value;
      const urlIn = el('input',{type:'url',placeholder:'Link (optional)',style:'margin-top:.3rem;'}); urlIn.value=n.url||'';
      urlIn.oninput = ()=> draft.news[i].url = urlIn.value;
      const rm = el('button',{class:'btn secondary small',style:'margin-top:.3rem;'}); rm.textContent='Remove item';
      rm.onclick = ()=>{ draft.news.splice(i,1); renderNewsList(); };
      row.appendChild(headIn); row.appendChild(dateIn); row.appendChild(urlIn); row.appendChild(rm);
      newsList.appendChild(row);
    });
  }
  renderNewsList(); modal.appendChild(newsList);
  const addNews = el('button',{class:'btn secondary small',style:'margin-top:.3rem;'}); addNews.textContent='+ Add news item';
  addNews.onclick = ()=>{ draft.news.push({headline:'',date:'',url:''}); renderNewsList(); };
  modal.appendChild(addNews);

  field('Notes','notes',true);

  const actions = el('div',{style:'display:flex;gap:.5rem;margin-top:1.1rem;'});
  const saveBtn = el('button',{class:'btn'}); saveBtn.textContent = editing ? 'Save changes' : 'Add firm';
  saveBtn.onclick = async ()=>{
    if(!draft.name.trim()){ toast('Firm name is required.'); return; }
    const ok = await saveFirm(draft, !editing);
    if(ok){ state.showFirmModal=false; state.editingFirm=null; render(); toast(editing?'Firm updated.':'Firm added.'); }
  };
  const cancelBtn = el('button',{class:'btn secondary'}); cancelBtn.textContent='Cancel';
  cancelBtn.onclick = ()=>{ state.showFirmModal=false; render(); };
  actions.appendChild(saveBtn); actions.appendChild(cancelBtn);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  return overlay;
}

function renderEvents(){
  const wrap = document.createDocumentFragment();
  const title = el('div',{class:'section-title'});
  title.appendChild(document.createTextNode('Events & law fairs'));
  if(state.isAdmin){
    const addBtn = el('button',{class:'btn small'}); addBtn.textContent='+ Add';
    addBtn.onclick = ()=>{ state.editingEvent=null; state.showEventModal=true; render(); };
    title.appendChild(addBtn);
  }
  wrap.appendChild(title);
  wrap.appendChild(el('p',{class:'helper',html:'Curated manually by your admin. For the full live listing of UK law fairs, check Legal Cheek\u2019s events page.'}));

  if(state.events.length===0){
    wrap.appendChild(el('div',{class:'empty',html:'<p>No events added yet.</p>'}));
  } else {
    state.events.forEach(e=>{
      const card = el('div',{class:'card event-card'});
      card.appendChild(el('div',{class:'event-type',html:escapeHtml(e.type||'Event')}));
      card.appendChild(el('div',{class:'event-date',html: e.date ? fmtDate(e.date) : 'Date TBA'}));
      card.appendChild(el('p',{style:'margin:.25rem 0 0;font-weight:600;',html:escapeHtml(e.name)}));
      if(e.location) card.appendChild(el('p',{class:'dash-sub',html:escapeHtml(e.location)}));
      if(e.notes) card.appendChild(el('p',{style:'font-size:.82rem;margin-top:.3rem;',html:escapeHtml(e.notes)}));
      if(e.url) card.appendChild(el('a',{href:e.url,target:'_blank',rel:'noopener',style:'font-size:.78rem;color:var(--ink-soft);',html:'More info ↗'}));
      if(state.isAdmin){
        const actions = el('div',{style:'display:flex;gap:.5rem;margin-top:.6rem;'});
        const editBtn = el('button',{class:'btn secondary small'}); editBtn.textContent='Edit';
        editBtn.onclick = ()=>{ state.editingEvent=e.id; state.showEventModal=true; render(); };
        const delBtn = el('button',{class:'btn danger small'}); delBtn.textContent='Remove';
        delBtn.onclick = async ()=>{ await deleteEvent(e.id); toast('Removed.'); };
        actions.appendChild(editBtn); actions.appendChild(delBtn);
        card.appendChild(actions);
      }
      wrap.appendChild(card);
    });
  }
  return wrap;
}

function renderEventModal(){
  const editing = state.editingEvent ? state.events.find(e=>e.id===state.editingEvent) : null;
  const draft = editing ? {...editing} : {id:null, name:'', type:'Law fair', date:null, location:'', url:'', notes:''};
  const overlay = el('div',{class:'modal-overlay'});
  overlay.onclick = (e)=>{ if(e.target===overlay){ state.showEventModal=false; render(); } };
  const modal = el('div',{class:'modal'});
  const closeBtn = el('button',{class:'modal-close',html:'&times;'});
  closeBtn.onclick = ()=>{ state.showEventModal=false; render(); };
  modal.appendChild(closeBtn);
  modal.appendChild(el('h2',{html: editing ? 'Edit event' : 'Add event'}));

  modal.appendChild(el('label',{html:'Event name'}));
  const nameIn = el('input',{type:'text'}); nameIn.value=draft.name; nameIn.oninput=()=>draft.name=nameIn.value;
  modal.appendChild(nameIn);

  modal.appendChild(el('label',{html:'Type'}));
  const typeIn = el('select',{});
  ['Law fair','Insight day','Open day','Application deadline','Networking','Other'].forEach(t=>{
    const o = el('option',{value:t,html:t}); if(draft.type===t) o.selected=true; typeIn.appendChild(o);
  });
  typeIn.onchange = ()=> draft.type = typeIn.value;
  modal.appendChild(typeIn);

  modal.appendChild(el('label',{html:'Date'}));
  const dateIn = el('input',{type:'date'}); dateIn.value=draft.date||''; dateIn.oninput=()=>draft.date=dateIn.value||null;
  modal.appendChild(dateIn);

  modal.appendChild(el('label',{html:'Location'}));
  const locIn = el('input',{type:'text',placeholder:'e.g. Virtual, or London'}); locIn.value=draft.location||''; locIn.oninput=()=>draft.location=locIn.value;
  modal.appendChild(locIn);

  modal.appendChild(el('label',{html:'Link'}));
  const urlIn = el('input',{type:'url'}); urlIn.value=draft.url||''; urlIn.oninput=()=>draft.url=urlIn.value;
  modal.appendChild(urlIn);

  modal.appendChild(el('label',{html:'Notes'}));
  const notesIn = el('textarea',{}); notesIn.value=draft.notes||''; notesIn.oninput=()=>draft.notes=notesIn.value;
  modal.appendChild(notesIn);

  const actions = el('div',{style:'display:flex;gap:.5rem;margin-top:1rem;'});
  const saveBtn = el('button',{class:'btn'}); saveBtn.textContent = editing ? 'Save changes' : 'Add event';
  saveBtn.onclick = async ()=>{
    if(!draft.name.trim()){ toast('Event name is required.'); return; }
    const ok = await saveEvent(draft, !editing);
    if(ok){ state.showEventModal=false; state.editingEvent=null; render(); toast(editing?'Event updated.':'Event added.'); }
  };
  const cancelBtn = el('button',{class:'btn secondary'}); cancelBtn.textContent='Cancel';
  cancelBtn.onclick = ()=>{ state.showEventModal=false; render(); };
  actions.appendChild(saveBtn); actions.appendChild(cancelBtn);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  return overlay;
}

function renderExams(){
  const wrap = document.createDocumentFragment();
  wrap.appendChild(el('div',{class:'section-title',html:'Your exam dates'}));
  wrap.appendChild(el('p',{class:'helper',html:'Private to your account. Useful for spotting clashes with application deadlines.'}));
  const card = el('div',{class:'card'});
  if(state.exams.length===0){
    card.appendChild(el('div',{class:'empty',html:'<p>No exam dates logged yet.</p>'}));
  } else {
    state.exams.forEach(x=>{
      const row = el('div',{class:'exam-row'});
      row.appendChild(el('div',{class:'exam-date',html:fmtDate(x.date)}));
      row.appendChild(el('div',{style:'flex:1;padding:0 .7rem;font-size:.88rem;',html:escapeHtml(x.subject)}));
      const rm = el('button',{class:'btn secondary small'}); rm.textContent='Remove';
      rm.onclick = ()=> removeExam(x.id);
      row.appendChild(rm);
      card.appendChild(row);
    });
  }
  const addRow = el('div',{class:'add-inline'});
  const subjIn = el('input',{type:'text',placeholder:'Exam or subject'});
  const dateIn = el('input',{type:'date'});
  const addBtn = el('button',{class:'btn'}); addBtn.textContent='Add';
  addBtn.onclick = ()=>{
    if(!subjIn.value.trim()||!dateIn.value){ toast('Add a subject and a date.'); return; }
    addExam(subjIn.value.trim(), dateIn.value);
    subjIn.value=''; dateIn.value='';
  };
  addRow.appendChild(subjIn); addRow.appendChild(dateIn); addRow.appendChild(addBtn);
  card.appendChild(addRow);
  wrap.appendChild(card);
  return wrap;
}

init();
