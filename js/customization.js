'use strict';
function customize(){
 titlebar('Team Customization','Rename all 16 franchises and give each one its own logo. History and records stay attached to the same franchise.');
 $('app').innerHTML=`<div class="notice">Changes save immediately in this browser. Logos are included when you export a league backup. PNG, JPG or WebP (up to 5 MB) — automatically resized to 160 × 160.</div><div class="custom-grid">${state.teams.map(t=>`<section class="custom-team"><div class="custom-header">${teamMark(t.id)}<div><b>Franchise ${t.id+1}</b><div class="sub tiny">${esc(t.name)} · ${fmt(t.titles)} titles · ${fmt(t.regW)}–${fmt(t.regL)} all-time</div></div></div><div class="custom-main"><input class="custom-name" id="team-name-${t.id}" data-team-name="${t.id}" type="text" minlength="2" maxlength="50" aria-label="Name for franchise ${t.id+1}" value="${esc(t.name)}"><button data-save-team="${t.id}" class="primary">Save name</button></div><div class="custom-tools"><button data-upload-logo="${t.id}">${t.logo?'Replace logo':'Upload logo'}</button>${t.logo?`<button data-remove-logo="${t.id}" class="danger">Remove logo</button>`:''}<input id="logo-input-${t.id}" data-logo-input="${t.id}" type="file" accept="image/png,image/jpeg,image/webp" hidden></div></section>`).join('')}</div><div class="panel" style="margin-top:16px"><h3>History is safe</h3><p class="sub">Names and logos are cosmetic: franchise IDs, previous seasons, game scores, wins, losses and championships do not change. Your updated branding appears throughout the historical views. Export a backup from Settings to keep logos too.</p></div>`;
}
async function changeTeamName(id){
 if(busy){setBanner('Finish the simulation before editing teams.',true);return}
 let t=state.teams[id], input=$('team-name-'+id);if(!t||!input)return;
 let name=input.value.trim().replace(/\s+/g,' ');
 if(name.length<2||name.length>50){setBanner('Use a team name between 2 and 50 characters.',true);return}
 if(state.teams.some(o=>o.id!==id&&o.name.toLocaleLowerCase()===name.toLocaleLowerCase())){setBanner('That name is already used by another team.',true);return}
 if(name===t.name){setBanner('That team already has this name.');return}
 const old=t.name;t.name=name;
 try{await commitState();setBanner(`${old} renamed to ${name}. All franchise history was preserved.`);await render()}
 catch(err){t.name=old;setBanner('Unable to save team name: '+err.message,true)}
}
async function removeTeamLogo(id){
 if(busy){setBanner('Finish the simulation before editing teams.',true);return}
 let t=state.teams[id];if(!t)return;const old=t.logo;t.logo=null;
 try{await commitState();setBanner('Logo removed for '+t.name+'. No game records changed.');await render()}
 catch(err){t.logo=old;setBanner('Unable to remove logo: '+err.message,true)}
}
async function resizeTeamLogo(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Use a PNG, JPG or WebP image.');
 if(file.size>5*1024*1024)throw Error('Logo must be smaller than 5 MB.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight)throw Error('Could not read this image.');
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image conversion is not supported in this browser.');
  ctx.clearRect(0,0,160,160);const scale=Math.min(160/img.naturalWidth,160/img.naturalHeight);const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  ctx.drawImage(img,(160-w)/2,(160-h)/2,w,h);
  let data=canvas.toDataURL('image/png');
  if(data.length>250000)data=canvas.toDataURL('image/webp',.85);
  if(data.length>450000)throw Error('Logo is too complex to save. Try a simpler image.');
  return data;
 }finally{URL.revokeObjectURL(url)}
}
async function changeTeamLogo(id,file){
 if(busy){setBanner('Finish the simulation before editing teams.',true);return}
 let t=state.teams[id];if(!t||!file)return;
 try{
  const data=await resizeTeamLogo(file),old=t.logo;t.logo=data;
  try{await commitState()}catch(err){t.logo=old;throw err}
  setBanner('Logo saved for '+t.name+'. It is also included in exported league backups.');await render();
 }catch(err){setBanner('Logo upload failed: '+err.message,true)}
}
