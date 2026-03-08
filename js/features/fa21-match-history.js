/* ADMIN FEATURE A21: Match History
   Complete record of all matches played — who joined, results, fees, prizes */
(function(){
'use strict';

var _allJoinData = [], _matchNames = {}, _loaded = false;

window.loadMatchHistory = async function() {
  var el = document.getElementById('matchHistoryTable');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  
  // Timeout helper
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function(_, rej) { setTimeout(function() { rej(new Error('Timeout: Firebase slow/blocked')); }, ms); })
    ]);
  }
  
  try {
    // Load matches, joinRequests, results in parallel with 10s timeout
    var results = await withTimeout(
      Promise.all([
        rtdb.ref('matches').once('value'),
        rtdb.ref('joinRequests').once('value'),
        rtdb.ref('results').once('value')
      ]),
      10000
    );
    var ms = results[0], js = results[1], resSnap = results[2];

    // Match names
    _matchNames = {};
    if (ms.exists()) ms.forEach(function(c){ var d=c.val(); if(d) _matchNames[c.key] = d.name || c.key; });
    
    // Populate match filter
    var sel = document.getElementById('mhMatchFilter');
    if (sel) {
      sel.innerHTML = '<option value="">All Matches</option>';
      Object.keys(_matchNames).forEach(function(mid) {
        var opt = document.createElement('option');
        opt.value = mid; opt.textContent = _matchNames[mid];
        sel.appendChild(opt);
      });
    }
    
    // Join requests
    _allJoinData = [];
    if (js.exists()) {
      js.forEach(function(c) {
        var d = c.val(); if (!d) return;
        d._key = c.key;
        _allJoinData.push(d);
      });
    }
    
    // Results
    var resultsByUser = {};
    if (resSnap.exists()) {
      resSnap.forEach(function(c) {
        var d = c.val(); if (!d || !d.userId) return;
        var key = (d.matchId||'')+'__'+(d.userId||'');
        resultsByUser[key] = d;
      });
    }
    
    // Merge results into join data
    _allJoinData.forEach(function(d) {
      var key = (d.matchId||d.tournamentId||'')+'__'+(d.userId||d.uid||'');
      var res = resultsByUser[key];
      if (res) {
        d.rank = d.rank || res.rank;
        d.kills = d.kills || res.kills;
        d.reward = d.reward || res.winnings;
        d.resultStatus = d.resultStatus || 'completed';
      }
    });
    
    _loaded = true;
    renderMatchHistory(_allJoinData);
  } catch(e) {
    if (el) el.innerHTML = '<div style="color:#ff4444;padding:14px;text-align:center">⚠️ Error: ' + e.message + '</div>';
    console.error('loadMatchHistory error:', e);
  }
};

function renderMatchHistory(data) {
  var el = document.getElementById('matchHistoryTable');
  if (!el) return;
  
  if (!data.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa">No match history found</div>';
    return;
  }
  
  // Sort by newest first
  data = data.slice().sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });
  
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="background:rgba(255,255,255,.04);border-bottom:2px solid rgba(0,255,156,.2)">'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">#</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Match</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Player</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">FF UID</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Mode</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Slot</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Fee</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Rank</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Kills</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Prize</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Date</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Status</th>'
    + '<th style="padding:8px 10px;text-align:left;color:var(--primary,#00ff9c);font-size:11px">Action</th>'
    + '</tr></thead><tbody>';
  
  data.forEach(function(d, i) {
    var ts = d.createdAt || d.timestamp || 0;
    var dateStr = ts ? new Date(ts).toLocaleString('en-IN',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';
    var matchName = _matchNames[d.matchId] || d.matchName || d.matchId || '-';
    var ign = d.userName || d.playerName || d.ign || 'Unknown';
    var ffUid = d.userFFUID || d.ffUid || '-';
    var mode = (d.mode || 'solo').toUpperCase();
    var slot = d.slotNumber || d.slot || '-';
    var fee = d.entryFee || 0;
    var rank = d.rank || 0;
    var kills = d.kills || 0;
    var prize = d.reward || d.winnings || 0;
    var status = d.resultStatus || d.status || 'joined';
    var statusColor = status === 'completed' ? '#00ff9c' : status === 'cancelled' ? '#ff4444' : '#ffd700';
    
    var rowBg = i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent';
    h += '<tr style="background:'+rowBg+';border-bottom:1px solid rgba(255,255,255,.04)">'
      + '<td style="padding:7px 10px;color:#aaa">'+(i+1)+'</td>'
      + '<td style="padding:7px 10px;font-weight:600;color:#fff;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+matchName+'">'+matchName+'</td>'
      + '<td style="padding:7px 10px;color:var(--primary,#00ff9c);font-weight:700">'+ign+'</td>'
      + '<td style="padding:7px 10px;color:#00d4ff;font-family:monospace;font-size:11px">'+ffUid+'</td>'
      + '<td style="padding:7px 10px;color:#aaa">'+mode+'</td>'
      + '<td style="padding:7px 10px;color:#aaa">'+slot+'</td>'
      + '<td style="padding:7px 10px;color:#ffd700">₹'+fee+'</td>'
      + '<td style="padding:7px 10px;font-weight:700;color:'+(rank===1?'#ffd700':rank===2?'#c0c0c0':rank===3?'#cd7f32':'#aaa')+'">'+(rank?'#'+rank:'-')+'</td>'
      + '<td style="padding:7px 10px;color:#ff6b6b">'+kills+'</td>'
      + '<td style="padding:7px 10px;font-weight:700;color:'+(prize>0?'#00ff9c':'#aaa')+'">₹'+prize+'</td>'
      + '<td style="padding:7px 10px;color:#aaa;font-size:11px">'+dateStr+'</td>'
      + '<td style="padding:7px 10px"><span style="font-size:10px;font-weight:700;color:'+statusColor+'">'+status.toUpperCase()+'</span></td>'
      + '<td style="padding:7px 10px"><button onclick="openResultCorrection(\'' + (d.matchId||d.tournamentId||'') + '\',\'' + (d.userId||d.uid||'') + '\',\'' + (d.userName||d.ign||'') + '\')" style="padding:4px 8px;border-radius:6px;background:rgba(255,170,0,.12);color:#ffaa00;border:1px solid rgba(255,170,0,.2);font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-edit"></i> Fix</button></td>'
      + '</tr>';
  });
  
  h += '</tbody></table></div>';
  h += '<div style="font-size:11px;color:#aaa;padding:8px;text-align:right">Total records: '+data.length+'</div>';
  el.innerHTML = h;
}

window.filterMatchHistory = function() {
  if (!_loaded) { loadMatchHistory(); return; }
  var q = (document.getElementById('mhSearch')||{}).value||'';
  var mid = (document.getElementById('mhMatchFilter')||{}).value||'';
  q = q.toLowerCase().trim();
  var filtered = _allJoinData.filter(function(d) {
    if (mid && d.matchId !== mid) return false;
    if (!q) return true;
    var s = [d.userName,d.ign,d.playerName,d.userFFUID,d.ffUid,d.matchName,_matchNames[d.matchId]].join(' ').toLowerCase();
    return s.indexOf(q) > -1;
  });
  renderMatchHistory(filtered);
};

})();

/* ─── RESULT CORRECTION ─── */
window.openResultCorrection = function(matchId, userId, userName) {
  var h = '<div style="padding:8px">';
  h += '<div style="font-size:12px;color:#aaa;margin-bottom:12px">Player: <strong style="color:#fff">' + (userName||userId) + '</strong><br>Match ID: <span style="color:#00d4ff;font-family:monospace;font-size:10px">' + matchId + '</span></div>';
  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Correct Rank</label>';
  h += '<input type="number" id="rcRank" min="1" placeholder="e.g. 1" style="width:100%;padding:9px;border-radius:8px;background:#0a0a0a;border:1px solid #2a2a2a;color:#fff;font-size:13px;box-sizing:border-box"></div>';
  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Correct Kills</label>';
  h += '<input type="number" id="rcKills" min="0" placeholder="e.g. 5" style="width:100%;padding:9px;border-radius:8px;background:#0a0a0a;border:1px solid #2a2a2a;color:#fff;font-size:13px;box-sizing:border-box"></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Corrected Prize (₹)</label>';
  h += '<input type="number" id="rcPrize" min="0" placeholder="e.g. 100" style="width:100%;padding:9px;border-radius:8px;background:#0a0a0a;border:1px solid #2a2a2a;color:#fff;font-size:13px;box-sizing:border-box"></div>';
  h += '<button onclick="submitResultCorrection(\'' + matchId + '\',\'' + userId + '\',\'' + userName + '\')" style="width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,#ffaa00,#ff8800);color:#000;font-weight:800;border:none;cursor:pointer;font-size:13px"><i class="fas fa-save"></i> Save Correction</button>';
  h += '</div>';
  var m = document.getElementById('genericModal'), mt = document.getElementById('genericModalTitle'), mb = document.getElementById('genericModalBody');
  if(m && mt && mb){ mt.innerHTML = '✏️ Correct Result'; mb.innerHTML = h; m.classList.add('show'); }
};

window.submitResultCorrection = async function(matchId, userId, userName) {
  var rank = Number((document.getElementById('rcRank')||{}).value)||0;
  var kills = Number((document.getElementById('rcKills')||{}).value)||0;
  var prize = Number((document.getElementById('rcPrize')||{}).value)||0;
  if(!rank) { showToast('❌ Rank required', true); return; }
  try {
    var rtdb = window.rtdb || window.db;
    // Update result record
    var resSnap = await rtdb.ref('results').orderByChild('userId').equalTo(userId).once('value');
    var resKey = null;
    if(resSnap.exists()) resSnap.forEach(function(c){ if((c.val().matchId||c.val().tournamentId)===matchId) resKey=c.key; });
    var updateData = { rank: rank, kills: kills, winnings: prize, correctedAt: Date.now(), correctedBy: 'admin', correctionNote: 'Manual correction' };
    if(resKey) await rtdb.ref('results/' + resKey).update(updateData);
    // Update user stats if prize changed
    if(prize > 0 && userId) {
      var uSnap = await rtdb.ref('users/' + userId).once('value');
      var u = uSnap.val() || {};
      var oldStats = u.stats || {};
      await rtdb.ref('users/' + userId + '/realMoney/winnings').set((Number((u.realMoney||{}).winnings)||0) + prize);
      await rtdb.ref('users/' + userId + '/stats/earnings').set((oldStats.earnings||0) + prize);
      await rtdb.ref('users/' + userId + '/notifications').push({ title: '✅ Result Corrected', message: 'Your result has been corrected: Rank #' + rank + ', Prize ₹' + prize, timestamp: Date.now(), read: false });
    }
    // Log action
    await rtdb.ref('adminActions').push({ action: 'result_correction', matchId: matchId, userId: userId, userName: userName, newRank: rank, newKills: kills, newPrize: prize, timestamp: Date.now() });
    showToast('✅ Result corrected!');
    document.getElementById('genericModal').classList.remove('show');
    loadMatchHistory();
  } catch(e) { showToast('❌ Error: ' + e.message, true); }
};
