/* ============ 全站共享：导航/光晕/托盘/动效基建 ============ */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- 光标光晕：三层视差跟随 ---------- */
(function spotlight(){
  const halo=document.createElement('div'),core=document.createElement('div'),dot=document.createElement('div');
  halo.className='spot spot-halo';core.className='spot spot-core';dot.className='spot spot-dot';
  document.body.append(halo,core,dot);
  let tx=innerWidth/2,ty=innerHeight*.35,cx=tx,cy=ty,hx=tx,hy=ty,dx=tx,dy=ty;
  addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;document.body.classList.add('spot-on')},{passive:true});
  addEventListener('mouseleave',()=>document.body.classList.remove('spot-on'));
  (function loop(){
    cx+=(tx-cx)*.42; cy+=(ty-cy)*.42;          // 内核·快
    dx+=(tx-dx)*.60; dy+=(ty-dy)*.60;          // 光点·最快
    hx+=(tx-hx)*.10; hy+=(ty-hy)*.10;          // 光晕·慢
    core.style.transform=`translate(${cx}px,${cy}px)`;
    dot.style.transform=`translate(${dx}px,${dy}px)`;
    halo.style.transform=`translate(${hx}px,${hy}px)`;
    requestAnimationFrame(loop);
  })();
})();

/* ---------- 导航 ---------- */
const NAV=[['index.html','首页'],['matrix.html','灵感方向'],['studio.html','灵感组合'],['method.html','怎么用']];
function buildNav(active){
  const nav=document.createElement('header');nav.className='nav';
  nav.innerHTML=`<a class="brand" href="index.html"><span class="brand-mark">叙</span>
    <span>灵感矩阵<small>STORY MATRIX</small></span></a>
    <nav class="nav-links">${NAV.map(([h,t])=>`<a href="${h}" class="${h===active?'on':''} ${h==='method.html'?'hide-m':''}">${t}</a>`).join('')}
    <a class="nav-cta rip" href="studio.html#random">🎲 随机来一条</a></nav>`;
  document.body.prepend(nav);
}

/* ---------- 页脚 ---------- */
function buildFooter(){
  const f=document.createElement('footer');f.className='footer';
  f.innerHTML=`<div class="fbrand">灵感矩阵<span>EMPATHY STORY LAB</span></div>
    <nav>${NAV.map(([h,t])=>`<a href="${h}">${t}</a>`).join('')}</nav>
    <div class="cp">灵感方向 · 371 个情境 · 541 组人物关系 · 337 个故事场景 · 10 个转折词</div>`;
  document.body.append(f);
}

/* ---------- 背景层 ---------- */
function buildBg(){
  const b=document.createElement('div');b.className='aurora';
  b.innerHTML='<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>';
  const g=document.createElement('div');g.className='grid-overlay';
  document.body.prepend(g,b);
}

/* ---------- 涟漪（事件委托） ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('.rip,.btn,.nav-cta,.card,.chip,.dk button');
  if(!t)return;
  const r=t.getBoundingClientRect(),d=Math.max(r.width,r.height);
  const s=document.createElement('span');s.className='ripple';
  s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
  if(getComputedStyle(t).position==='static')t.style.position='relative';
  t.style.overflow='hidden';t.appendChild(s);
  setTimeout(()=>s.remove(),650);
});

/* ---------- 进入动画：stagger ---------- */
function stagger(){
  const groups=new Map();
  $$('.rise').forEach(el=>{
    const p=el.parentElement;
    if(!groups.has(p))groups.set(p,0);
    const i=groups.get(p);groups.set(p,i+1);
    setTimeout(()=>el.classList.add('in'),60+i*70);
  });
  $$('[data-chars]').forEach(el=>{
    if(el.dataset.split)return;
    el.dataset.split='1';
    /* 逐字 span 会创建独立渲染层，父级 background-clip:text 无法再裁进子层；
       因此把渐变裁剪下沉到每个字上，各自独立渐变 */
    const grad=el.classList.contains('grad-t');
    if(grad)el.classList.remove('grad-t');
    const text=el.textContent;el.textContent='';
    [...text].forEach((ch,i)=>{
      const s=document.createElement('span');s.className='char'+(grad?' grad-t':'');
      s.style.animationDelay=(i*45)+'ms';s.textContent=ch===' '?'\u00a0':ch;
      el.appendChild(s);requestAnimationFrame(()=>s.classList.add('in'));
    });
  });
}

/* ---------- 吐司 ---------- */
let toastTimer;
function toast(msg){
  let t=$('.toast');
  if(!t){t=document.createElement('div');t.className='toast';document.body.append(t);}
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1900);
}

/* ---------- 复制 ---------- */
async function copyText(s,msg){
  try{await navigator.clipboard.writeText(s);}
  catch(e){const ta=document.createElement('textarea');ta.value=s;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove();}
  toast(msg||'已复制到剪贴板');
}

/* ---------- 配方托盘 ---------- */
function buildDock(){
  const d=document.createElement('div');d.className='dock';d.id='dock';
  d.innerHTML=`<div class="dock-head"><b>当前配方</b><span class="cnt" id="dockCnt"></span></div>
    <div class="dock-items" id="dockItems"></div>
    <div class="dock-formula" id="dockFormula"></div>
    <div class="dock-act">
      <button class="btn btn-pri btn-sm rip" id="dockCopy">复制配方</button>
      <button class="btn btn-ghost btn-sm rip" id="dockClear">清空</button>
      <a class="btn btn-ghost btn-sm rip" href="studio.html">去灵感组合完善 →</a>
    </div>`;
  document.body.append(d);
  d.addEventListener('click',e=>{
    if(e.target.closest('#dockCopy'))copyText(pfText(),'配方已复制');
    if(e.target.closest('#dockClear')){pfClear();renderDock();toast('已清空');}
    const rm=e.target.closest('[data-rm]');
    if(rm){const [c,t]=rm.dataset.rm.split('||');pfRemove(c,t);renderDock();}
  });
}
function renderDock(){
  const d=$('#dock');if(!d)return;
  const a=loadPF();
  d.classList.toggle('show',a.length>0);
  $('#dockCnt').textContent=a.length?a.length+' 个元素 · 点击 × 移除':'';
  $('#dockItems').innerHTML=a.map(x=>
    `<span class="dk"><span class="c">${CAT_NAME[x.cat]}</span>${x.cat==='sit'?x.dom+'·'+x.tag:x.tag}<button data-rm="${x.cat}||${x.tag}">×</button></span>`
  ).join('');
  const f=$('#dockFormula');
  if(a.length>1){f.textContent='公式：'+pfText(a);f.classList.add('show');}
  else f.classList.remove('show');
}
function quickAdd(item){
  if(pfAdd(item)){renderDock();toast('已加入配方：'+(item.cat==='sit'?item.dom+'·'+item.tag:item.tag));}
  else toast('已在配方中');
}

/* ---------- 磁力按钮 ---------- */
function magnetic(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  $$('.btn,.nav-cta,.brand-mark').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.18}px,${(e.clientY-r.top-r.height/2)*.28}px)`;
    });
    el.addEventListener('mouseleave',()=>{el.style.transform='';});
  });
}

/* ---------- 页面初始化 ---------- */
function initPage(active,withDock=true){
  buildBg();buildNav(active);buildFooter();
  if(withDock){buildDock();renderDock();}
  magnetic();stagger();
  if(location.hash==='#random'&&active==='studio.html'){setTimeout(()=>{doRandom?doRandom():0;history.replaceState(null,'','studio.html');},300);}
}
