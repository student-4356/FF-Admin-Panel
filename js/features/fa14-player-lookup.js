/* ADMIN FEATURE A14: Instant Player Lookup
   FF UID / phone / IGN se instant player card — ban, send coins, view history. */
(function(){
'use strict';
window.fa14PlayerLookup=function(){
  var h='<div>'
    +'<div class="form-group"><label>Search (FF UID / Phone / IGN)</label>'
    +'<input id="pl_q" class="form-input" placeholder="Enter FF UID, phone or IGN..." oninput="fa14Search()"></div>'
    +'<div id="pl_result"></div></div>';
  showAdminModal('🔍 Player Lookup',h);
};

window.fa14Search=async function(){
  var q=(document.getElementById('pl_q').value||'').trim().toLowerCase();
  var out=document.getElementById('pl_result'); if(!out||q.length<3) return;
  out.innerHTML='<div style="text-align:center;color:#aaa;padding:10px">Searching...</div>';
  var s=await rtdb.ref('users').once('value');
  var found=null,fk='';
  s.forEach(function(c){
    if(found) return;
    var d=c.val()||{};
    if((d.ffUid||'').toLowerCase()===q||(d.phone||'').includes(q)||(d.ign||'').toLowerCase().includes(q)){
      found=d; fk=c.key;
    }
  });
  if(!found){ out.innerHTML='<div style="text-align:center;color:#ff4444;padding:10px">No user found</div>'; return; }
  var bal=((found.realMoney||{}).balance)||0;
  out.innerHTML='<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:14px">'
    +'<div style="font-size:15px;font-weight:700;margin-bottom:4px">'+(found.ign||'Unknown')+' '+(found.profileStatus==='verified'?'✅':''+(found.banned?'🚫':''))+'</div>'
    +'<div style="font-size:12px;color:#aaa;margin-bottom:10px">UID: '+fk+' · FF: '+(found.ffUid||'-')+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">'
    +'<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px;text-align:center"><div style="font-size:11px;color:#aaa">Wallet</div><div style="font-weight:700">₹'+bal+'</div></div>'
    +'<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px;text-align:center"><div style="font-size:11px;color:#aaa">Coins</div><div style="font-weight:700">🪙'+(found.coins||0)+'</div></div>'
    +'</div>'
    +'<div style="display:flex;gap:6px">'
    +(found.banned
      ?'<button onclick="fa14Unban(\''+fk+'\')" style="flex:1;padding:8px;border-radius:8px;background:#00ff9c;color:#000;font-weight:700;border:none;cursor:pointer;font-size:12px">✅ Unban</button>'
      :'<button onclick="fa14Ban(\''+fk+'\')" style="flex:1;padding:8px;border-radius:8px;background:#ff4444;color:#fff;font-weight:700;border:none;cursor:pointer;font-size:12px">🚫 Ban</button>'
    )
    +'<button onclick="fa14GiveCoins(\''+fk+'\')" style="flex:1;padding:8px;border-radius:8px;background:#ffd700;color:#000;font-weight:700;border:none;cursor:pointer;font-size:12px">🪙 Give Coins</button>'
    +'</div></div>';
};

window.fa14Ban=async function(uid){
  var r=prompt('Ban reason:'); if(!r) return;
  await rtdb.ref('users/'+uid).update({banned:true,banReason:r,bannedAt:Date.now()});
  showToast('🚫 Banned!'); fa14Search();
};
window.fa14Unban=async function(uid){
  await rtdb.ref('users/'+uid).update({banned:false,banReason:null,bannedAt:null});
  showToast('✅ Unbanned!'); fa14Search();
};
window.fa14GiveCoins=async function(uid){
  var amt=Number(prompt('Coins amount:')); if(!amt) return;
  await rtdb.ref('users/'+uid+'/coins').transaction(function(c){return(c||0)+amt;});
  showToast('🪙 '+amt+' coins given!'); fa14Search();
};
})();
