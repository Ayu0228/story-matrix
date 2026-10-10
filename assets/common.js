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
const NAV=[['index.html','首页'],['matrix.html','灵感方向'],['studio.html','灵感组合'],['workbench.html','工作台'],['method.html','怎么用']];
function buildNav(active){
  const nav=document.createElement('header');nav.className='nav';
  nav.innerHTML=`<a class="brand" href="index.html"><span class="brand-mark">叙</span>
    <span>灵感工作台<small>STORY WORKBENCH</small></span></a>
    <nav class="nav-links">${NAV.map(([h,t])=>`<a href="${h}" class="${h===active?'on':''} ${h==='method.html'?'hide-m':''}">${t}</a>`).join('')}
    <a class="nav-cta rip" href="studio.html#random">🎲 随机来一条</a></nav>`;
  document.body.prepend(nav);
}

/* ---------- 页脚 ---------- */
function buildFooter(){
  const f=document.createElement('footer');f.className='footer';
  f.innerHTML=`<div class="fbrand">灵感工作台<span>EMPATHY STORY LAB</span></div>
    <nav>${NAV.map(([h,t])=>`<a href="${h}">${t}</a>`).join('')}</nav>
    <div class="cp">灵感方向 · ${STATS.tags} 个情境 · ${STATS.rel} 组人物关系 · ${STATS.scene} 个故事场景 · ${STATS.mod} 个转折词</div>`;
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
let dockModeFn=null; /* 配方篮模式取数器：灵感组合页=全局 getMode；灵感方向页=页面模式 getDMode */
function buildDock(lockFn){ /* lockFn：返回锁定的模式名（如 getMode），托盘去创作同样只允许该模式 */
  dockModeFn=lockFn;
  const d=document.createElement('div');d.className='dock';d.id='dock';
  d.innerHTML=`<div class="dock-head"><b>当前配方</b><span class="cnt" id="dockCnt"></span></div>
    <div class="dock-items" id="dockItems"></div>
    <div class="dock-formula" id="dockFormula"></div>
    <div class="dock-act">
      <button class="btn btn-ghost btn-sm rip" id="dockCopy">复制配方</button>
      <button class="btn btn-pri btn-sm rip" id="dockToWB">去工作台创作 ▶</button>
      <button class="btn btn-ghost btn-sm rip" id="dockClear">清空</button>
      <a class="btn btn-ghost btn-sm rip" href="studio.html">去灵感组合完善 →</a>
    </div>`;
  document.body.append(d);
  d.addEventListener('click',e=>{
    if(e.target.closest('#dockCopy')){const s=dockSrc();copyText(pfOutText(s.items,s.mode),MODE_NAME[s.mode]+'配方已复制');}
    if(e.target.closest('#dockToWB')){
      const pf=loadPF();
      if(!pf.length)return toast('配方篮是空的：先点元素上的 ＋ 添加');
      wbSendModal(pf,null,lockFn?lockFn():null); // 无锁时按配方内容推断，可选其他类型
    }
    if(e.target.closest('#dockClear')){
      if(inWB()){curProj().src=[];commit();}
      else pfClear();
      renderDock();
      /* 清空后必须把页面上已选标签的选中态释放，否则无法再次点选（issue：清空不等于解锁） */
      if(typeof paintAll==='function')paintAll();
      if(typeof renderDockStates==='function')renderDockStates();
      toast('已清空');
    }
    const rm=e.target.closest('[data-rm]');
    if(rm){const [c,t]=rm.dataset.rm.split('||');
      if(inWB()){const p=curProj();p.src=(p.src||[]).filter(x=>!(x.cat===c&&x.tag===t));commit();}
      else pfRemove(c,t);
      renderDock();
      /* 移除后同步释放页面对应标签的选中态 */
      if(typeof paintAll==='function')paintAll();
      if(typeof renderDockStates==='function')renderDockStates();
    }
  });
}
/* 工作台页：dock 跟随当前项目（来源配方+项目模式）；其他页：全局配方篮+灵感组合模式 */
const WB_TO_MODE={novel:'story',music:'music',video:'video'};
const inWB=()=>{try{return !!cur&&typeof curProj==='function'&&!!curProj();}catch(_){return false;}}; /* TDZ：页面脚本未执行完时安全回退 */
function dockSrc(){
  if(inWB()){const p=curProj();return{items:p.src||[],mode:WB_TO_MODE[cur.kind]||getMode()};}
  return{items:loadPF(),mode:(dockModeFn||getMode)()};
}
function renderDock(){
  const d=$('#dock');if(!d)return;
  const{items:a,mode}=dockSrc();
  const wb=inWB();
  const toWB=$('#dockToWB');if(toWB)toWB.style.display=wb?'none':'';
  d.classList.toggle('show',a.length>0);
  $('#dockCnt').textContent=a.length?a.length+' 个元素 · 点击 × 移除':'';
  /* 配方篮标签随模式改名：同一批底层数据，三模式叫法不同（与灵感方向列一致） */
  const POOL_TITLES={
    story:{mod:'情节反转',view:'叙事视角',hook:'开篇钩子',endhook:'结尾钩子',line:''},
    music:{mod:'情绪落点',view:'歌词人称',hook:'歌名钩子',line:'副歌Hook句',endhook:''},
    video:{mod:'结尾反转',view:'叙事视角',hook:'前三秒钩子',line:'反转台词',endhook:''},
  };
  $('#dockItems').innerHTML=a.map(x=>
    `<span class="dk"><span class="c">${(POOL_TITLES[mode]||{})[x.cat]||CAT_NAME[x.cat]}</span>${x.cat==='sit'?x.dom+'·'+x.tag:x.tag}<button data-rm="${x.cat}||${x.tag}">×</button></span>`
  ).join('');
  const f=$('#dockFormula');
  if(a.length>1){f.textContent=MODE_NAME[mode]+'公式：'+pfOutText(a,mode);f.classList.add('show');}
  else f.classList.remove('show');
}
function quickAdd(item){
  if(pfAdd(item)){renderDock();toast('已加入配方：'+(item.cat==='sit'?item.dom+'·'+item.tag:item.tag));}
  else toast('已在配方中');
}

/* ---------- 配方 → 工作台 ---------- */
/* WB_KINDS 定义在 data.js */
function wbSendModal(pf,defKind,lock){
  const infer=lock||pfInferMode(pf);
  if(!WB_KINDS[defKind])defKind=PF_TO_WB[infer];
  const WARN={ // 跨类型创建时的提示文案
    'music>novel':'这是音乐配方（含视角/金句）。小说项目会把全部元素写进大纲，但故事文案按故事公式输出。',
    'music>video':'这是音乐配方（含视角/金句）。短视频文案不会体现视角/金句，但它们会完整保留在来源配方里。',
    'video>novel':'这是短视频配方（含钩子）。小说项目会把全部元素写进大纲，钩子会作为情节节奏参考保留。',
    'video>music':'这是短视频配方（含钩子）。音乐文案不会体现钩子，但它会完整保留在来源配方里。',
    'story>music':'这是故事配方（无视角/金句）。创建音乐项目后，视角与金句方向需要你自己补。',
    'story>video':'这是故事配方（无钩子）。创建短视频项目后，钩子类型需要你自己补。'
  };
  const kinds=lock?[defKind]:Object.keys(WB_KINDS); /* lock：锁定发起时所属模式，只能创建对应类型 */
  SMCloud.openModal({
    title:'送到工作台创作',
    okText:'创建项目并去创作',
    body:`<p class="sm-tip">${lock?`已按当前 <b>${MODE_NAME[infer]}模式</b>锁定，只能创建${WB_KINDS[defKind]}项目`:`配方识别为 <b>${MODE_NAME[infer]}配方</b>，默认创建对应项目（小说→大纲，音乐→主题，短视频→主题与故事），创建后直接进编辑器。`}</p>
    <div style="display:flex;gap:10px;margin:12px 0 10px">
      ${kinds.map(k=>`<label data-wbk="${k}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-radius:12px;border:1px solid var(--line);cursor:${lock?'default':'pointer'};font-size:14px;color:var(--dim);${k===defKind?'background:rgba(167,139,250,.15);border-color:var(--vio);color:var(--txt);font-weight:700':''}">
        <input type="radio" name="wbk" value="${k}" ${k===defKind?'checked':''} style="accent-color:#a78bfa"> ${WB_KINDS[k]}</label>`).join('')}
    </div>
    <div id="wbWarn" style="display:none;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.35);border-radius:10px;padding:9px 12px;font-size:12.5px;color:#fcd34d;margin-bottom:10px"></div>
    <label class="sm-field"><span>项目名（可稍后改）</span><input id="wbPName" value="${esc(autoName(pf,defKind))}" maxlength="24" autocomplete="off"></label>`,
    onReady:m=>{
      const warn=m.querySelector('#wbWarn');
      const sync=()=>{
        const k=m.querySelector('input[name=wbk]:checked').value;
        const w=WARN[infer+'>'+k];
        if(w){warn.textContent='⚠ '+w;warn.style.display='block';}
        else{warn.style.display='none';}
        m.querySelector('#wbPName').value=autoName(pf,k);
        m.querySelectorAll('[data-wbk]').forEach(l=>{
          const on=l.dataset.wbk===k;
          l.style.background=on?'rgba(167,139,250,.15)':'';
          l.style.borderColor=on?'var(--vio)':'';
          l.style.color=on?'var(--txt)':'';
          l.style.fontWeight=on?'700':'';
        });
      };
      m.addEventListener('change',e=>{if(e.target.name==='wbk')sync();});
      sync();
    },
    onOk:async m=>{
      const k=m.querySelector('input[name=wbk]:checked').value;
      const name=m.querySelector('#wbPName').value;
      const r=sendPFToWB(pf,k,name);
      if(cloudOn()){ /* 云模式：等写入完成再跳转，否则新页面会拉到旧数据 */
        try{await SMCloud.flush();}
        catch(e){toast('同步失败：'+e.message);return false;}
      }
      location.href='workbench.html?kind='+r.kind+'&proj='+r.proj;
    }});
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
function initPage(active,withDock=true,modeFn){ /* modeFn：配方篮模式取数器，默认全局 getMode；灵感方向页传 getDMode */
  buildBg();buildNav(active);buildFooter();
  if(withDock){buildDock(modeFn||getMode);renderDock();} /* dock 去创作一律按当前模式锁定（模式存于 localStorage，跨页一致） */
  magnetic();stagger();
  if(location.hash==='#random'&&active==='studio.html'){setTimeout(()=>{doRandom?doRandom():0;history.replaceState(null,'','studio.html');},300);}
}
