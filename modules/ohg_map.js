/* Map layers + region filter + tile placeholder. Overrides viewMap from runtime. */
function viewMap(){
  const locs=(DATA.locations||[]).map(l=>({...l,_layer:locLayer(l),_cat:'locations',_region:l.region||l.zone||'Nalcott'}));
  const layers=[...new Set(['all',...locs.map(l=>l._layer)])];
  const regions=[...new Set(['all',...locs.map(l=>l._region)])];
  if(!window.mapRegion) window.mapRegion='all';
  const shown=locs.filter(l=>(mapLayer==='all'||l._layer===mapLayer)&&(window.mapRegion==='all'||l._region===window.mapRegion));
  fillList(shown);
  const tiles=Array.from({length:24},(_,i)=>{
    const hit=shown.filter(l=>((String(l.id||l.name).length+i)%24)===i).length;
    return `<i class="tile${hit?' on':''}" title="${hit} pin">${hit||''}</i>`;
  }).join('');
  return `<div class="kicker">Map · vrstvy</div><h1>Interaktivní mapa</h1>
    <p class="sub">${shown.length} bodů · vrstva <b>${mapLayer}</b> · region <b>${window.mapRegion}</b></p>
    <div class="filters">
      ${layers.map(l=>`<button class="btn ${mapLayer===l?'':'ghost'}" onclick="mapLayer='${l}';render()">${l}</button>`).join('')}
    </div>
    <div class="filters">
      ${regions.map(r=>`<button class="btn ${window.mapRegion===r?'':'ghost'}" onclick="mapRegion='${String(r).replace(/'/g,"")}';render()">${r}</button>`).join('')}
    </div>
    <div class="mapbox">${tiles}${shown.map(l=>{
      const x=Math.max(6,Math.min(94,Number(l.x)||((String(l.id||l.name).length*17)%88+6)));
      const y=Math.max(8,Math.min(92,Number(l.y)||((String(l.name||'').length*13)%80+10)));
      return `<button class="pin" style="left:${x}%;top:${y}%" title="${l.name}" aria-label="${l.name}" onclick='openEntity(${JSON.stringify(l).replace(/'/g,"&#39;")})'>📍</button>`;
    }).join('')}</div>
    ${device==='desktop'||device==='ultrawide'?'':`<div class="list" style="margin-top:12px">${shown.slice(0,24).map(itemRow).join('')}</div>`}`;
}
