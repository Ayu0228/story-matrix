/* ============ 云存储层：GitHub 私有仓库即后端 ============
   所有可变数据（自定义人物关系/故事场景、已存配方、当前配方）
   统一保存在用户自己的 GitHub 私有仓库 story-matrix-data.json 中。
   访问令牌只保存在本机浏览器 localStorage，从不外传。 */
(function(){
const LS_CFG='sm_cloud_cfg',LS_TOK='sm_cloud_tok',SS_TOK='sm_cloud_tok',FILE='story-matrix-data.json';
let cfg=null,data=null,sha=null,state='off',busyMsg='',saveTimer=null,saving=false,dirty=false;
const stateFns=[],dataFns=[];
const apiBase=()=>window.SM_API_BASE||'https://api.github.com';
function blank(){return {v:5,tax:null,rels:[],scenes:[],saved:[],pf:[],wb:null};}
function norm(){
  data=Object.assign(blank(),data||{});
  ['rels','scenes','saved','pf'].forEach(k=>{if(!Array.isArray(data[k]))data[k]=[];});
  // v3 → v4：工作台数据（小说/音乐/短视频项目）
  if(!data.wb||typeof data.wb!=='object'){data.wb={novels:[],musics:[],videos:[]};}
  ['novels','musics','videos'].forEach(k=>{if(!Array.isArray(data.wb[k]))data.wb[k]=[];});
  data.v=5;
  // v1 → v2 / 首次使用：以内置数据为底本，全量迁入私有仓库（含历史自定义条目）
  if(!Array.isArray(data.tax)||!data.tax.length){
    if(typeof BUILTIN!=='undefined'){
      data.tax=JSON.parse(JSON.stringify(BUILTIN.doms));
      const baseRels=[];Object.entries(BUILTIN.rels).forEach(([l1,a])=>a.forEach(t=>baseRels.push({tag:t,l1})));
      data.rels=baseRels.concat(data.rels.filter(x=>!(BUILTIN.rels[x.l1]||[]).includes(x.tag)));
      const baseScenes=[];Object.entries(BUILTIN.scenes).forEach(([l1,a])=>a.forEach(t=>baseScenes.push({tag:t,l1})));
      data.scenes=baseScenes.concat(data.scenes.filter(x=>!(BUILTIN.scenes[x.l1]||[]).includes(x.tag)));
    }else data.tax=[];
    data.v=2;
  }
  // v2 → v3：转折词入云（此前版本云文件没有 mods 字段）
  if(!Array.isArray(data.mods)){
    data.mods=(typeof BUILTIN!=='undefined')?JSON.parse(JSON.stringify(BUILTIN.mods)):[];
    data.v=3;
  }
  // v4 → v5：行业扩充包合入（新增方向整体补入；已有方向把缺失的分类/标签/关系/场景补回。
  //          用户自己新增、改名的内容不受影响；用户删除过的内置条目会随本次扩充重新出现。）
  if(typeof BUILTIN!=='undefined'){
    const has=(l1,tag)=>data.rels.some(x=>x.l1===l1&&x.tag===tag);
    const hasS=(l1,tag)=>data.scenes.some(x=>x.l1===l1&&x.tag===tag);
    if(Array.isArray(data.tax)){
      BUILTIN.doms.forEach(d=>{
        const t=data.tax.find(x=>x.id===d.id);
        if(!t){data.tax.push(JSON.parse(JSON.stringify(d)));return;}
        d.tree.forEach(n=>{
          const m=t.tree.find(x=>x.l1===n.l1);
          if(!m){t.tree.push(JSON.parse(JSON.stringify(n)));return;}
          const cur=new Set([...(m.tags||[]),...(m.groups||[]).flatMap(g=>g.tags)]);
          if(n.tags)n.tags.forEach(tag=>{if(!cur.has(tag)){m.tags=m.tags||[];m.tags.push(tag);}});
          if(n.groups)n.groups.forEach(g=>{
            const mg=(m.groups||[]).find(x=>x.name===g.name);
            if(!mg){m.groups=m.groups||[];m.groups.push(JSON.parse(JSON.stringify(g)));return;}
            g.tags.forEach(tag=>{if(!mg.tags.includes(tag))mg.tags.push(tag);});
          });
        });
      });
      Object.entries(BUILTIN.rels).forEach(([l1,arr])=>arr.forEach(tag=>{if(!has(l1,tag))data.rels.push({tag,l1});}));
      Object.entries(BUILTIN.scenes).forEach(([l1,arr])=>arr.forEach(tag=>{if(!hasS(l1,tag))data.scenes.push({tag,l1});}));
    }
    data.v=5;
  }
}
function loadCfg(){
  try{cfg=JSON.parse(localStorage.getItem(LS_CFG)||'null');}catch(e){cfg=null;}
  if(cfg&&cfg.owner&&cfg.repo){
    cfg.token=sessionStorage.getItem(SS_TOK)||localStorage.getItem(LS_TOK)||'';
    if(!cfg.token)cfg=null; // 令牌已随浏览器关闭清除，等待重新粘贴
  }
}
function persistCfg(remember){
  if(cfg&&cfg.owner&&cfg.repo){
    localStorage.setItem(LS_CFG,JSON.stringify({owner:cfg.owner,repo:cfg.repo}));
    if(cfg.token){
      if(remember){localStorage.setItem(LS_TOK,cfg.token);sessionStorage.removeItem(SS_TOK);}
      else{sessionStorage.setItem(SS_TOK,cfg.token);localStorage.removeItem(LS_TOK);}
    }
  }else{localStorage.removeItem(LS_CFG);localStorage.removeItem(LS_TOK);sessionStorage.removeItem(SS_TOK);}
}
function b64u(s){return btoa(unescape(encodeURIComponent(s)));}
function u64b(s){return decodeURIComponent(escape(atob(s.replace(/\n/g,''))));}
function setState(s,msg){state=s;busyMsg=msg||'';stateFns.forEach(f=>f(s,busyMsg));}
function onState(f){stateFns.push(f);f(state,busyMsg);}
function onData(f){dataFns.push(f);if(data)f(data);}
function emit(){dataFns.forEach(f=>f(data));}

async function gh(path,opt={}){
  const r=await fetch(apiBase()+path,{...opt,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+cfg.token,'X-GitHub-Api-Version':'2022-11-28',...(opt.body?{'Content-Type':'application/json'}:{}),...(opt.headers||{})}});
  if(r.status===404&&opt.allow404)return null;
  if(!r.ok){const t=await r.text();throw new Error('GitHub '+r.status+(t?('：'+t.slice(0,160)):''));}
  if(r.status===204)return null;
  return r.json();
}
async function testCfg(c){
  const r=await fetch(apiBase()+'/repos/'+c.owner+'/'+c.repo,{headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+c.token,'X-GitHub-Api-Version':'2022-11-28'}});
  if(r.status===404)throw new Error('连接失败：找不到仓库 '+c.owner+'/'+c.repo+'，请核对用户名和仓库名');
  if(r.status===401)throw new Error('连接失败：令牌无效或已过期');
  if(r.status===403)throw new Error('连接失败：令牌没有该仓库的权限');
  if(!r.ok)throw new Error('连接失败（'+r.status+'）');
  return r.json();
}
async function load(){
  if(!cfg){data=blank();norm();setState('off');return;}
  setState('busy','正在连接存储…');
  try{
    const j=await gh('/repos/'+cfg.owner+'/'+cfg.repo+'/contents/'+FILE,{allow404:true});
    if(j&&j.content){sha=j.sha;try{data=JSON.parse(u64b(j.content));}catch(e){data=blank();}}
    else{sha=null;data=blank();}
    norm();setState('ok');emit();
  }catch(e){console.warn('[cloud]',e);data=blank();norm();setState('err',e.message);}
}
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,1100);}
async function flushSave(){
  if(!cfg||!data)return;
  if(saving){dirty=true;return;}
  saving=true;setState('busy','同步中…');
  try{
    const body={message:'story-matrix 数据更新',content:b64u(JSON.stringify(data,null,2)),branch:'main'};
    if(sha)body.sha=sha;
    const j=await gh('/repos/'+cfg.owner+'/'+cfg.repo+'/contents/'+FILE,{method:'PUT',body:JSON.stringify(body)});
    if(j&&j.content)sha=j.content.sha;
    dirty=false;setState('ok');
  }catch(e){
    if(/GitHub (409|422)/.test(e.message)){await load();toast('存储有更新，已重新载入最新数据');}
    else{setState('err',e.message);toast('同步失败：'+e.message);}
  }finally{saving=false;if(dirty){dirty=false;queueSave();}}
}
function touch(){dirty=true;queueSave();}
/* 关页时若有未同步修改，立即冲刷（浏览器通常仍会让请求完成） */
addEventListener('pagehide',()=>{if(!cfg||!data||!dirty)return;clearTimeout(saveTimer);flushSave();});

/* ---------- 对外业务接口 ---------- */
const api={
  get data(){return data||blank();},
  get state(){return state;},
  get ready(){return readyP;},
  onState,onData,
  async connect(c,remember){
    c={owner:(c.owner||'').trim(),repo:(c.repo||'').trim(),token:(c.token||'').trim()};
    if(!c.owner||!c.repo||!c.token)throw new Error('请填写完整：用户名、仓库名、令牌');
    setState('busy','正在验证连接…');
    const info=await testCfg(c);
    cfg=c;persistCfg(remember);await load();
    return info;
  },
  disconnect(){cfg=null;persistCfg();localStorage.removeItem(LS_TOK);sessionStorage.removeItem(SS_TOK);sha=null;data=blank();setState('off');emit();},
  async ensureConnected(){
    if(cfg&&state==='ok')return true;
    openConnectModal();return false;
  },
  addRel(tag,l1){norm();if(!data.rels.some(x=>x.tag===tag&&x.l1===l1)){data.rels.push({tag,l1});touch();emit();return true;}return false;},
  delRel(tag,l1){norm();const n=data.rels.length;data.rels=data.rels.filter(x=>!(x.tag===tag&&x.l1===l1));if(data.rels.length!==n){touch();emit();return true;}return false;},
  renameRel(l1,oldT,newT){norm();const x=data.rels.find(x=>x.tag===oldT&&x.l1===l1);if(!x)throw new Error('要修改的关系不存在');if(data.rels.some(y=>y.tag===newT&&y.l1===l1&&y!==x))throw new Error('该分类下已有同名关系');x.tag=newT;touch();emit();return true;},
  addScene(tag,l1){norm();if(!data.scenes.some(x=>x.tag===tag&&x.l1===l1)){data.scenes.push({tag,l1});touch();emit();return true;}return false;},
  delScene(tag,l1){norm();const n=data.scenes.length;data.scenes=data.scenes.filter(x=>!(x.tag===tag&&x.l1===l1));if(data.scenes.length!==n){touch();emit();return true;}return false;},
  renameScene(l1,oldT,newT){norm();const x=data.scenes.find(x=>x.tag===oldT&&x.l1===l1);if(!x)throw new Error('要修改的场景不存在');if(data.scenes.some(y=>y.tag===newT&&y.l1===l1&&y!==x))throw new Error('该分类下已有同名场景');x.tag=newT;touch();emit();return true;},

  /* ---------- 方向 / 分类 / 情境 CRUD（数据全量在云） ---------- */
  _dom(id){const d=data.tax.find(d=>d.id===id);if(!d)throw new Error('方向不存在（可能已被删除）');return d;},
  _cat(domId,l1){const d=this._dom(domId);const n=d.tree.find(n=>n.l1===l1);if(!n)throw new Error('分类不存在（可能已被删除）');return {d,n};},
  _catTaken(l1,exceptDom){return data.tax.some(d=>d.id!==exceptDom&&d.tree.some(n=>n.l1===l1));},
  addDom(name,modes){
    norm();name=(name||'').trim();
    if(!name)throw new Error('请填写方向名称');
    if(data.tax.some(d=>d.name===name))throw new Error('已有同名方向');
    const id='u'+Date.now().toString(36);
    data.tax.push({id,name,modes:(Array.isArray(modes)&&modes.length?modes:['story','music','video']),tree:[]});touch();emit();return id;
  },
  renameDom(id,name){
    norm();name=(name||'').trim();
    if(!name)throw new Error('请填写方向名称');
    if(data.tax.some(d=>d.id!==id&&d.name===name))throw new Error('已有同名方向');
    this._dom(id).name=name;touch();emit();return true;
  },
  delDom(id){
    norm();const d=this._dom(id);
    const cats=d.tree.map(n=>n.l1);
    const nSit=d.tree.reduce((s,n)=>s+(n.tags?n.tags.length:0)+(n.groups?n.groups.reduce((a,g)=>a+g.tags.length,0):0),0);
    data.rels=data.rels.filter(x=>!cats.includes(x.l1));
    data.scenes=data.scenes.filter(x=>!cats.includes(x.l1));
    data.tax=data.tax.filter(x=>x.id!==id);
    touch();emit();return {cats:cats.length,sits:nSit};
  },
  addCat(domId,l1){
    norm();l1=(l1||'').trim();
    if(!l1)throw new Error('请填写分类名称');
    if(this._catTaken(l1,domId))throw new Error('这个分类名已被其他方向使用，换一个');
    this._dom(domId).tree.push({l1,tags:[]});touch();emit();return true;
  },
  renameCat(domId,oldL1,newL1){
    norm();newL1=(newL1||'').trim();
    if(!newL1)throw new Error('请填写分类名称');
    if(this._catTaken(newL1,domId))throw new Error('这个分类名已被其他方向使用，换一个');
    const {n}=this._cat(domId,oldL1);n.l1=newL1;
    // 关系/场景归属跟随改名（情境标签不带分类名，无需处理）
    data.rels.forEach(x=>{if(x.l1===oldL1)x.l1=newL1;});
    data.scenes.forEach(x=>{if(x.l1===oldL1)x.l1=newL1;});
    touch();emit();return true;
  },
  delCat(domId,l1){
    norm();const {d,n}=this._cat(domId,l1);
    const nSit=(n.tags?n.tags.length:0)+(n.groups?n.groups.reduce((a,g)=>a+g.tags.length,0):0);
    const nRel=data.rels.filter(x=>x.l1===l1).length;
    const nScene=data.scenes.filter(x=>x.l1===l1).length;
    d.tree=d.tree.filter(x=>x.l1!==l1);
    data.rels=data.rels.filter(x=>x.l1!==l1);
    data.scenes=data.scenes.filter(x=>x.l1!==l1);
    touch();emit();return {sits:nSit,rels:nRel,scenes:nScene};
  },
  addSit(domId,l1,tag,grp){
    norm();tag=(tag||'').trim();
    if(!tag)throw new Error('请填写情境名称');
    const {n}=this._cat(domId,l1);
    const all=n.tags?n.tags.slice():(n.groups?n.groups.reduce((a,g)=>a.concat(g.tags),[]):[]);
    if(all.includes(tag))throw new Error('该分类下已有同名情境');
    if(n.groups){const g=n.groups.find(g=>g.name===grp)||n.groups[0];g.tags.push(tag);}
    else{if(!n.tags)n.tags=[];n.tags.push(tag);}
    touch();emit();return true;
  },
  renameSit(domId,l1,oldT,newT){
    norm();newT=(newT||'').trim();
    if(!newT)throw new Error('请填写情境名称');
    const {n}=this._cat(domId,l1);
    let holder=n.tags||null;
    if(!holder&&n.groups){const g=n.groups.find(g=>g.tags.includes(oldT));holder=g?g.tags:null;}
    if(!holder||!holder.includes(oldT))throw new Error('要修改的情境不存在');
    if(holder.includes(newT)&&newT!==oldT)throw new Error('该分类下已有同名情境');
    holder[holder.indexOf(oldT)]=newT;touch();emit();return true;
  },
  delSit(domId,l1,tag){
    norm();const {n}=this._cat(domId,l1);
    let hit=false;
    if(n.tags){const i=n.tags.indexOf(tag);if(i>=0){n.tags.splice(i,1);hit=true;}}
    if(n.groups)n.groups.forEach(g=>{const i=g.tags.indexOf(tag);if(i>=0){g.tags.splice(i,1);hit=true;}});
    if(hit){touch();emit();return true;}return false;
  },
  /* ---------- 转折词 CRUD ---------- */
  addMod(tag){
    norm();tag=(tag||'').trim();
    if(!tag)throw new Error('请填写转折词');
    if(data.mods.includes(tag))throw new Error('已有同名转折词');
    data.mods.push(tag);touch();emit();return true;
  },
  renameMod(oldT,newT){
    norm();newT=(newT||'').trim();
    if(!newT)throw new Error('请填写转折词');
    const i=data.mods.indexOf(oldT);
    if(i<0)throw new Error('要修改的转折词不存在');
    if(data.mods.includes(newT)&&newT!==oldT)throw new Error('已有同名转折词');
    data.mods[i]=newT;touch();emit();return true;
  },
  delMod(tag){
    norm();const i=data.mods.indexOf(tag);
    if(i<0)return false;
    data.mods.splice(i,1);touch();emit();return true;
  },
  saveSaved(sv){norm();data.saved=sv;touch();},
  saveWB(wb){
    norm();
    if(!wb||typeof wb!=='object')throw new Error('数据格式不正确');
    ['novels','musics','videos'].forEach(k=>{if(!Array.isArray(wb[k]))throw new Error('数据格式不正确：'+k);});
    data.wb=wb;touch();emit();return true;
  },
  savePF(pf){norm();data.pf=pf;touch();},
  isOn(){return !!cfg&&state==='ok';}
};
window.SMCloud=api;

/* ---------- 通用弹窗 ---------- */
function openModal({title,body,okText='确定',onOk,onReady,cancelText='取消',hideFooter=false}){
  closeModal();
  const mask=document.createElement('div');mask.className='sm-mask';mask.id='smMask';
  mask.innerHTML=`<div class="sm-panel" role="dialog">
    <div class="sm-head"><b>${title}</b><button class="sm-x" id="smX">✕</button></div>
    <div class="sm-body">${body}</div>
    ${hideFooter?'':`<div class="sm-foot"><button class="btn btn-ghost btn-sm rip" id="smCancel">${cancelText}</button><button class="btn btn-pri btn-sm rip" id="smOk">${okText}</button></div>`}
  </div>`;
  document.body.append(mask);
  requestAnimationFrame(()=>{mask.classList.add('open');mask.querySelector('.sm-panel').classList.add('open');});
  if(onReady)onReady(mask);
  const close=()=>closeModal();
  mask.addEventListener('click',e=>{
    if(e.target===mask)close();
    if(e.target.closest('#smX')||e.target.closest('#smCancel'))close();
    if(e.target.closest('#smOk')){
      try{
        const r=onOk&&onOk(mask);
        if(r&&r.then)r.then(ok=>{if(ok!==false)close();}).catch(err=>{showModalErr(err.message||String(err));});
        else if(r!==false)close();
      }catch(err){showModalErr(err.message||String(err));}
    }
  });
  return close;
}
function showModalErr(msg){
  let p=$('#smErr');
  if(!p){p=document.createElement('div');p.className='sm-err';p.id='smErr';$('#smMask .sm-body').append(p);}
  p.textContent=msg;
}
function closeModal(){const m=$('#smMask');if(m){m.classList.remove('open');setTimeout(()=>m.remove(),220);}}
addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
api.openModal=openModal;api.closeModal=closeModal;

/* ---------- 连接设置弹窗 ---------- */
function openConnectModal(){
  const has=!!cfg;
  const c=cfg||{owner:'',repo:'',token:''};
  openModal({
    title:has?'存储设置':'连接你的存储',
    okText:has?'保存':'连接',
    body:`
      <p class="sm-tip">数据保存在<b>你自己的 GitHub 私有仓库</b>里，任何人都看不到。令牌只保存在当前浏览器，不会上传。</p>
      ${has?`<p class="sm-tip sm-ok">当前已连接：${cfg.owner}/${cfg.repo}</p>`:''}
      <label class="sm-field"><span>GitHub 用户名</span><input id="smOwner" value="${c.owner||''}" placeholder="例如 zhangsan"></label>
      <label class="sm-field"><span>私有仓库名</span><input id="smRepo" value="${c.repo||''}" placeholder="例如 my-story-data"></label>
      <label class="sm-field"><span>访问令牌（Fine-grained token）</span><input id="smToken" type="password" value="${c.token||''}" placeholder="只授权该私有仓库 Contents 读写" autocomplete="off"></label>
      <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dim);margin:2px 0 4px;cursor:pointer;user-select:none">
        <input type="checkbox" id="smRem" ${localStorage.getItem(LS_TOK)?'checked':''} style="accent-color:#a78bfa;width:15px;height:15px">
        在这台设备上记住令牌（不勾选则关闭浏览器后自动清除，下次需重新粘贴）
      </label>
      ${has?`<button class="btn btn-ghost btn-sm rip" id="smDis" style="margin-top:6px">断开连接并清除本机令牌</button>`:''}
      ${has?'':`<a class="sm-help" href="https://docs.github.com/zh/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens" target="_blank" rel="noopener">不知道怎么生成令牌？点这里看官方教程 ↗</a>`}
    `,
    onOk:async(mask)=>{
      const errEl=$('#smErr');if(errEl)errEl.remove();
      const nc={owner:mask.querySelector('#smOwner').value,repo:mask.querySelector('#smRepo').value,token:mask.querySelector('#smToken').value};
      const remember=!!mask.querySelector('#smRem')?.checked;
      try{
        const info=await api.connect(nc,remember);
        toast(remember?'已连接：'+(info.full_name||nc.repo):'已连接（令牌未在本机长期保存，关闭浏览器后需重新粘贴）');
        return true;
      }catch(e){showModalErr(e.message);return false;}
    }
  });
  const dis=$('#smDis');
  if(dis)dis.addEventListener('click',()=>{api.disconnect();closeModal();toast('已断开连接');});
}
api.openConnectModal=openConnectModal;

/* ---------- 顶栏状态入口 ---------- */
function injectCloudBtn(){
  const nav=$('.nav-links');if(!nav)return;
  const b=document.createElement('a');
  b.className='nav-cloud rip';b.id='cloudBtn';b.href='javascript:void 0';
  b.innerHTML='<span class="cdot"></span><span class="ctxt">存储</span>';
  b.addEventListener('click',openConnectModal);
  nav.appendChild(b);
  api.onState((s,msg)=>{
    b.dataset.st=s;
    b.title=msg||(s==='ok'?'数据已同步到 '+cfg.owner+'/'+cfg.repo:s==='busy'?'同步中…':s==='err'?'同步失败，点击重连':'点击连接你的 GitHub 私有仓库');
    b.querySelector('.ctxt').textContent=s==='busy'?'同步中':s==='ok'?'已连接':s==='err'?'同步失败':'存储';
  });
}

/* ---------- 启动 ---------- */
loadCfg();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectCloudBtn);
else injectCloudBtn();
const readyP=load();
/* 数据层联动：云数据变化时先重建运行时结构（applyTax 由 data.js 提供），页面渲染回调后执行 */
if(typeof applyTax==='function'){readyP.then(applyTax);api.onData(applyTax);}
})();
