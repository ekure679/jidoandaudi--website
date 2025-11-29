// calendar.js - powers a simple interactive calendar for index.html
(function(){
  // Local store of events; we will fetch data/events.json and merge
  const DEFAULT_EVENTS = {
    '2025-12-25': [{title:'Christmas Holiday',type:'holiday'}],
    '2025-11-30': [{title:'Annual Program: Skills Exhibition',type:'program'}],
    '2025-11-28': [{title:'Workshop: Tailoring Techniques',type:'event'}]
  };

  const PATH_EVENTS = 'data/events.json';
  let EVENTS = Object.assign({}, DEFAULT_EVENTS);

  // UI refs
  const $days = document.getElementById('cal-days');
  const $monthYear = document.getElementById('cal-month-year');
  const $today = document.getElementById('cal-today');
  const $eventsList = document.getElementById('events-list');
  const $toggleYearly = document.getElementById('toggle-yearly');
  const $selectMonth = document.getElementById('cal-month');
  const $selectYear = document.getElementById('cal-year');

  let state = { year:null, month:null, selected:null, showYearly:false };

  // helpers
  function pad(n){return n<10? '0'+n:''+n}
  function iso(y,m,d){return y+'-'+pad(m)+'-'+pad(d)}

  function populateMonthYearSelectors(){
    const now = new Date();
    const startYear = now.getFullYear()-2;
    const endYear = now.getFullYear()+2;
    $selectMonth.innerHTML='';
    for(let m=0;m<12;m++){ const opt=document.createElement('option'); opt.value=m; opt.textContent=new Intl.DateTimeFormat('en',{month:'long'}).format(new Date(2000,m,1)); $selectMonth.appendChild(opt); }
    $selectYear.innerHTML='';
    for(let y=startYear; y<=endYear; y++){ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; $selectYear.appendChild(opt); }
    if(state.year===null){ state.year = now.getFullYear(); state.month = now.getMonth(); }
    $selectMonth.value = state.month;
    $selectYear.value = state.year;

    $selectMonth.addEventListener('change', ()=>{ state.month = parseInt($selectMonth.value,10); render(); });
    $selectYear.addEventListener('change', ()=>{ state.year = parseInt($selectYear.value,10); render(); });
  }

  function render(){
    const now = new Date();
    $monthYear.textContent = new Intl.DateTimeFormat('en', {month:'long', year:'numeric'}).format(new Date(state.year, state.month));
    $today.textContent = 'Today: '+now.toLocaleDateString();

    $selectMonth.value = state.month;
    $selectYear.value = state.year;

    // build days
    $days.innerHTML='';
    const first = new Date(state.year, state.month,1);
    const start = first.getDay();
    const total = new Date(state.year, state.month+1,0).getDate();
    const prevTotal = new Date(state.year, state.month,0).getDate();
    for(let i=0;i<start;i++){
      const d = prevTotal - (start-1) + i;
      const el = document.createElement('div'); el.className='day other'; el.textContent=d; $days.appendChild(el);
    }
    for(let d=1; d<=total; d++){
      const el = document.createElement('div'); el.className='day'; el.textContent=d;
      const isoKey = iso(state.year, state.month+1, d);
      const evCount = (EVENTS[isoKey]||[]).length;
      if(evCount) el.classList.add('event');
      const today = new Date();
      if(state.year===today.getFullYear() && state.month===today.getMonth() && d===today.getDate()) el.classList.add('today');
      el.setAttribute('role','button'); el.setAttribute('tabindex','0');
      el.setAttribute('aria-label', `${isoKey} - ${evCount} event${evCount!==1?'s':''}`);
      el.addEventListener('click', ()=>selectDay(isoKey));
      el.addEventListener('keydown',(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); selectDay(isoKey); } });
      $days.appendChild(el);
    }
    // tail
    const cells = $days.children.length;
    for(let i=1;i<= ( (cells<=35)? (42-cells):(49-cells) ); i++){
      const el = document.createElement('div'); el.className='day other'; el.textContent=i; $days.appendChild(el);
    }
    if(!state.selected) $eventsList.innerHTML='<p class="text-muted">Select a day to see events or toggle yearly programs.</p>';
  }

  function selectDay(key){
    state.selected = key;
    const items = EVENTS[key] || [];
    if(items.length===0){ $eventsList.innerHTML = '<p class="text-muted">No events for '+key+'</p>'; return; }
    $eventsList.innerHTML = items.map(it=>`<div class="event-item"><strong>${it.title}</strong><div class="text-muted small">${it.type}</div></div>`).join('');
  }

  function prevMonth(){ state.month--; if(state.month<0){ state.month=11; state.year--; } render(); }
  function nextMonth(){ state.month++; if(state.month>11){ state.month=0; state.year++; } render(); }

  document.getElementById('cal-prev').addEventListener('click', prevMonth);
  document.getElementById('cal-next').addEventListener('click', nextMonth);

  $toggleYearly.addEventListener('click', ()=>{
    state.showYearly = !state.showYearly; $toggleYearly.textContent = state.showYearly? 'Hide yearly':'Show yearly';
    if(state.showYearly){
      const map = {};
      Object.keys(EVENTS).forEach(d=>{ const m=d.slice(0,7); map[m]=map[m]||[]; map[m].push({date:d, items:EVENTS[d]}); });
      let out=''; Object.keys(map).forEach(m=>{ out+=`<div class="mb-2"><strong>${m}</strong>` + map[m].map(it=>`<div class="event-item"><strong>${it.items[0].title}</strong><div class="text-muted small">${it.date}</div></div>`).join('') + `</div>` });
      $eventsList.innerHTML = out||'<p class="text-muted">No yearly programs found.</p>';
    } else { if(state.selected) selectDay(state.selected); else $eventsList.innerHTML='<p class="text-muted">Select a day to see events or toggle yearly programs.</p>'; }
  });

  // fetch events.json and initialize
  function init(){
    fetch(PATH_EVENTS).then(r=>{ if(!r.ok) throw new Error('no events.json'); return r.json(); }).then(js=>{ EVENTS = Object.assign({}, EVENTS, js); }).catch(()=>{ /* keep default EVENTS */ }).finally(()=>{
      populateMonthYearSelectors();
      render();
      // auto-select today
      const now=new Date(); const todayIso=iso(state.year, state.month+1, now.getDate()); state.selected=todayIso; if(EVENTS[todayIso]) selectDay(todayIso); else $eventsList.innerHTML=`<p class="text-muted">No events for ${todayIso}</p>`;
      // expose API
      window.CALENDAR_ADD_EVENT = function(date, obj){ EVENTS[date]=EVENTS[date]||[]; EVENTS[date].push(obj); render(); };
    });
  }

  init();
})();
