/* Pack channel: remote version.json → structured proposal in Agent queue. Never writes the pack. */
async function checkPackChannel(){
  const meta=window.OHG_META||{};
  const localVer=meta.version||meta.data_version||'local';
  const localN=meta.entities||(window.OHG_DATA&&Object.values(window.OHG_DATA).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0))||0;
  let remote=null;
  try{
    const res=await fetch('version.json',{cache:'no-store'});
    if(res.ok) remote=await res.json();
  }catch(e){ remote=null; }
  if(!remote){
    try{
      const base='https://raw.githubusercontent.com/smus-rgb/once-human-guide/main';
      const res=await fetch(base+'/version.json',{cache:'no-store'});
      if(res.ok) remote=await res.json();
    }catch(e){ /* offline */ }
  }
  window.OHG.packRemote=remote;
  if(!remote) return {ok:false,reason:'offline'};
  const diffs=[];
  if(remote.data_version && remote.data_version!==localVer) diffs.push({field:'data_version',local:localVer,remote:remote.data_version});
  if(remote.records!=null && Number(remote.records)!==Number(localN)) diffs.push({field:'records',local:localN,remote:remote.records});
  if(remote.shell_version && remote.shell_version!=='19.0') diffs.push({field:'shell_version',local:'19.0',remote:remote.shell_version});
  if(!diffs.length) return {ok:true,diffs:[]};
  const id='pack-'+remote.data_version;
  if(!user.queue.some(q=>q.id===id)){
    user.queue.push({
      id,
      type:'pack-diff',
      action:'edit',
      title:'Pack channel '+remote.data_version,
      status:'pending',
      diffs,
      note:'Schválení uloží overlay do user layer. Kanonický pack se nemění.',
      at:new Date().toISOString()
    });
    saveUser();
    toast('Pack diff ve frontě agenta');
  }
  return {ok:true,diffs};
}
function approveQueue(id){
  const q=user.queue.find(x=>x.id===id);
  if(!q) return;
  q.status='approved';
  if(!user.packPatches) user.packPatches=[];
  user.packPatches.push({id:q.id,diffs:q.diffs||[],at:new Date().toISOString()});
  saveUser();
  toast('Návrh schválen (overlay, pack beze změny)');
  render();
}
function rejectQueue(id){
  const q=user.queue.find(x=>x.id===id);
  if(!q) return;
  q.status='rejected';
  saveUser();
  render();
}
const _viewAgent=viewAgent;
viewAgent=function(){
  const base=_viewAgent();
  const extra=(user.queue||[]).filter(q=>q.type==='pack-diff').map(q=>`
    <div class="item"><div><b>${q.title||q.id}</b><div class="muted">${q.status} · ${(q.diffs||[]).map(d=>d.field+': '+d.local+' → '+d.remote).join(', ')}</div></div>
    <span class="row"><button class="btn" onclick="approveQueue('${q.id}')">Schválit</button><button class="btn ghost" onclick="rejectQueue('${q.id}')">Odmítnout</button></span></div>`).join('');
  return base+(extra?`<h3 style="margin-top:16px">Pack channel</h3><div class="list">${extra}</div>`:'');
}
checkPackChannel();
