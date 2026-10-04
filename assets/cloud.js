/* ============ 云存储层：GitHub 私有仓库即后端 ============
   所有可变数据（自定义人物关系/故事场景、已存配方、当前配方）
   统一保存在用户自己的 GitHub 私有仓库 story-matrix-data.json 中。
   访问令牌只保存在本机浏览器 localStorage，从不外传。 */
(function(){
const LS_CFG='sm_cloud_cfg',FILE='story-matrix-data.json';
let cfg=null,data=null,sha=null,state='off',busyMsg='',saveTimer=null,saving=false,dirty=false;
const stateFns=[],dataFns=[];
const apiBase=()=>window.SM_API_BASE||'https://api.github.com';
function blank(){return {v:1,rels:[],scenes:[],saved:[],pf:[]};}
function norm(){data=Object.assign(blank(),data||{});['rels','scenes','saved','pf'].forEach(k=>{if(!Array.isArray(data[k]))data[k]=[];});}
function loadCfg(){try{cfg=JSON.parse(localStorage.getItem(LS_CFG)||'null');}catch(e){cfg=null;}}
function persistCfg(){if(cfg&&cfg.owner&&cfg.repo&&cfg.token)localStorage.setItem(LS_CFG,JSON.stringify(cfg));else localStorage.removeItem(LS_CFG);}
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
function touch(){queueSave();}

/* ---------- 对外业务接口 ---------- */
const api={
  get data(){return data||blank();},
  get state(){return state;},
  get ready(){return readyP;},
  onState,onData,
  async connect(c){
    c={owner:(c.owner||'').trim(),repo:(c.repo||'').trim(),token:(c.token||'').trim()};
    if(!c.owner||!c.repo||!c.token)throw new Error('请填写完整：用户名、仓库名、令牌');
    setState('busy','正在验证连接…');
    const info=await testCfg(c);
    cfg=c;persistCfg();await load();
    return info;
  },
  disconnect(){cfg=null;persistCfg();sha=null;data=blank();setState('off');emit();},
  async ensureConnected(){
    if(cfg&&state==='ok')return true;
    openConnectModal();return false;
  },
  addRel(tag,l1){norm();if(!data.rels.some(x=>x.tag===tag&&x.l1===l1)){data.rels.push({tag,l1});touch();emit();return true;}return false;},
  delRel(tag,l1){norm();const n=data.rels.length;data.rels=data.rels.filter(x=>!(x.tag===tag&&x.l1===l1));if(data.rels.length!==n){touch();emit();return true;}return false;},
  addScene(tag,l1){norm();if(!data.scenes.some(x=>x.tag===tag&&x.l1===l1)){data.scenes.push({tag,l1});touch();emit();return true;}return false;},
  delScene(tag,l1){norm();const n=data.scenes.length;data.scenes=data.scenes.filter(x=>!(x.tag===tag&&x.l1===l1));if(data.scenes.length!==n){touch();emit();return true;}return false;},
  saveSaved(sv){norm();data.saved=sv;touch();},
  savePF(pf){norm();data.pf=pf;touch();},
  isOn(){return !!cfg&&state==='ok';}
};
window.SMCloud=api;

/* ---------- 通用弹窗 ---------- */
function openModal({title,body,okText='确定',onOk,cancelText='取消',hideFooter=false}){
  closeModal();
  const mask=document.createElement('div');mask.className='sm-mask';mask.id='smMask';
  mask.innerHTML=`<div class="sm-panel" role="dialog">
    <div class="sm-head"><b>${title}</b><button class="sm-x" id="smX">✕</button></div>
    <div class="sm-body">${body}</div>
    ${hideFooter?'':`<div class="sm-foot"><button class="btn btn-ghost btn-sm rip" id="smCancel">${cancelText}</button><button class="btn btn-pri btn-sm rip" id="smOk">${okText}</button></div>`}
  </div>`;
  document.body.append(mask);
  requestAnimationFrame(()=>{mask.classList.add('open');mask.querySelector('.sm-panel').classList.add('open');});
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
      <label class="sm-field"><span>访问令牌（Fine-grained token）</span><input id="smToken" type="password" value="${c.token||''}" placeholder="只授权该私有仓库 Contents 读写"></label>
      ${has?`<button class="btn btn-ghost btn-sm rip" id="smDis" style="margin-top:6px">断开连接</button>`:''}
      ${has?'':`<a class="sm-help" href="https://docs.github.com/zh/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens" target="_blank" rel="noopener">不知道怎么生成令牌？点这里看官方教程 ↗</a>`}
    `,
    onOk:async(mask)=>{
      const errEl=$('#smErr');if(errEl)errEl.remove();
      const nc={owner:mask.querySelector('#smOwner').value,repo:mask.querySelector('#smRepo').value,token:mask.querySelector('#smToken').value};
      try{
        const info=await api.connect(nc);
        toast('已连接：'+(info.full_name||nc.repo));
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
})();
