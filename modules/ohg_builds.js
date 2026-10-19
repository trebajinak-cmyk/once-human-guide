/* Build slot validation + JSON export. Wraps viewBuilds. */
const _viewBuilds = viewBuilds;
function slotIssues(build){
  const issues=[];
  BUILD_SLOTS.forEach(s=>{
    const id=build&&build[s.id];
    if(!id) return;
    const e=allEntities().find(x=>x.id===id);
    if(!e){ issues.push(s.label+': id není v packu'); return; }
    if(s.cats && e._cat && !s.cats.includes(e._cat)) issues.push(s.label+': špatná kategorie ('+e._cat+')');
  });
  return issues;
}
function exportBuildJSON(){
  const slots=user.currentBuild||{};
  const issues=slotIssues(slots);
  const payload={
    name:'current',
    exported_at:new Date().toISOString(),
    shell:'19.0',
    slots,
    issues,
    score:typeof calcBuild==='function'?calcBuild({slots}):null
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='ohg-build.json';
  a.click();
  toast(issues.length?('Export s '+issues.length+' varováními'):'Build JSON exportován');
}
viewBuilds = function(){
  const html=_viewBuilds();
  const issues=slotIssues(user.currentBuild||{});
  const warn=issues.length?`<p class="sub" style="color:var(--warn)">${issues.join(' · ')}</p>`:'<p class="sub">Sloty sedí na pack.</p>';
  return html+warn+`<div class="row" style="margin-top:8px"><button class="btn" onclick="exportBuildJSON()">Export build JSON</button></div>`;
};
