/* =============================================
   ADMIN ANALYTICS - Revenue Dashboard
   js/admin-analytics.js
   ============================================= */

var analyticsData = {
    totalRevenue: 0,
    totalPayout: 0,
    netProfit: 0,
    dailyData: {},
    topMatches: [],
    topPlayers: []
};

async function loadAnalytics() {
    console.log('Loading analytics...');
    
    try {
        // Reset
        analyticsData = {
            totalRevenue: 0,
            totalPayout: 0,
            netProfit: 0,
            dailyData: {},
            topMatches: [],
            topPlayers: []
        };
        
        // Load wallet requests
        var walSnap = await rtdb.ref(DB_WALLET).once('value');
        
        walSnap.forEach(function(c) {
            var w = c.val();
            if (w.status !== 'approved') return;
            
            var amount = Number(w.amount) || 0;
            var date = new Date(w.createdAt || w.timestamp || Date.now());
            var dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            
            if (!analyticsData.dailyData[dayKey]) {
                analyticsData.dailyData[dayKey] = { revenue: 0, payout: 0 };
            }
            
            var type = normalizeWalletType(w.type);
            if (type === 'add') {
                analyticsData.totalRevenue += amount;
                analyticsData.dailyData[dayKey].revenue += amount;
            } else if (type === 'withdraw') {
                analyticsData.totalPayout += amount;
                analyticsData.dailyData[dayKey].payout += amount;
            }
        });
        
        // Load match prizes distributed
        var matchSnap = await rtdb.ref(DB_MATCHES).once('value');
        var matchPrizes = [];
        
        matchSnap.forEach(function(c) {
            var m = c.val();
            var totalDistributed = 0;
            
            if (m.results) {
                Object.values(m.results).forEach(function(r) {
                    totalDistributed += Number(r.totalWinning) || 0;
                });
            }
            
            if (totalDistributed > 0) {
                analyticsData.totalPayout += totalDistributed;
                matchPrizes.push({
                    id: c.key,
                    name: m.name,
                    prizePool: m.prizePool || 0,
                    distributed: totalDistributed
                });
            }
        });
        
        // Sort top matches by prize pool
        analyticsData.topMatches = matchPrizes.sort(function(a, b) {
            return b.distributed - a.distributed;
        }).slice(0, 5);
        
        // Calculate net profit
        analyticsData.netProfit = analyticsData.totalRevenue - analyticsData.totalPayout;
        
        // Load top players by earnings
        if (usersSnapshot) {
            var players = [];
            usersSnapshot.forEach(function(c) {
                var u = c.val();
                var earnings = (u.totalWinnings || 0) + (u.stats ? u.stats.earnings || 0 : 0);
                if (earnings > 0) {
                    players.push({
                        uid: c.key,
                        ign: u.ign || 'Unknown',
                        earnings: earnings
                    });
                }
            });
            analyticsData.topPlayers = players.sort(function(a, b) {
                return b.earnings - a.earnings;
            }).slice(0, 5);
        }
        
        renderAnalytics();
        
    } catch (e) {
        console.error('Analytics error:', e);
        showToast('Error loading analytics: ' + e.message, true);
    }
}

function renderAnalytics() {
    // Main stats cards
    document.getElementById('analRevenue').textContent = '₹' + analyticsData.totalRevenue.toLocaleString();
    document.getElementById('analPayout').textContent = '₹' + analyticsData.totalPayout.toLocaleString();
    
    var netEl = document.getElementById('analNet');
    netEl.textContent = '₹' + analyticsData.netProfit.toLocaleString();
    netEl.className = analyticsData.netProfit >= 0 ? 'value text-primary' : 'value text-danger';
    
    // Bar chart (last 7 days)
    renderBarChart();
    
    // Top matches
    var topMatchesHtml = '';
    if (analyticsData.topMatches.length === 0) {
        topMatchesHtml = '<p class="text-muted text-xs">No match data yet</p>';
    } else {
        analyticsData.topMatches.forEach(function(m, i) {
            topMatchesHtml += '<div class="feed-item">' +
                '<div class="flex items-center justify-between">' +
                    '<span class="text-xs font-bold">#' + (i + 1) + ' ' + m.name + '</span>' +
                    '<span class="text-primary font-bold">₹' + m.distributed + '</span>' +
                '</div>' +
            '</div>';
        });
    }
    document.getElementById('analTopMatches').innerHTML = topMatchesHtml;
    
    // Top players
    var topPlayersHtml = '';
    if (analyticsData.topPlayers.length === 0) {
        topPlayersHtml = '<p class="text-muted text-xs">No player data yet</p>';
    } else {
        analyticsData.topPlayers.forEach(function(p, i) {
            topPlayersHtml += '<div class="feed-item">' +
                '<div class="flex items-center justify-between">' +
                    '<span class="text-xs font-bold">#' + (i + 1) + ' ' + p.ign + '</span>' +
                    '<span class="text-primary font-bold">₹' + p.earnings + '</span>' +
                '</div>' +
            '</div>';
        });
    }
    document.getElementById('analTopPlayers').innerHTML = topPlayersHtml;
}

function renderBarChart() {
    var chartEl = document.getElementById('analChart');
    if (!chartEl) return;
    
    // Get last 7 days
    var days = [];
    for (var i = 6; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }
    
    var maxVal = 1;
    days.forEach(function(day) {
        var data = analyticsData.dailyData[day] || { revenue: 0 };
        if (data.revenue > maxVal) maxVal = data.revenue;
    });
    
    var html = '<div class="bar-chart">';
    days.forEach(function(day) {
        var data = analyticsData.dailyData[day] || { revenue: 0, payout: 0 };
        var pct = Math.round((data.revenue / maxVal) * 100);
        var dayLabel = new Date(day).toLocaleDateString('en-US', { weekday: 'short' });
        
        html += '<div class="bar-col">' +
            '<div class="bar-value">₹' + data.revenue + '</div>' +
            '<div class="bar-fill-container">' +
                '<div class="bar-fill" style="height:' + Math.max(pct, 5) + '%"></div>' +
            '</div>' +
            '<div class="bar-label">' + dayLabel + '</div>' +
        '</div>';
    });
    html += '</div>';
    
    chartEl.innerHTML = html;
}

function refreshAnalytics() {
    loadAnalytics();
    showToast('Analytics refreshed!');
}

console.log('✅ admin-analytics.js loaded');
