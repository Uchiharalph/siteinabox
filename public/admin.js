(function () {
  'use strict';

  var token = '';
  var leads = [];

  function statusClass(status) {
    return 'status-pill status-' + LM.esc(status);
  }

  function contactCell(lead) {
    if (lead.phone) {
      return '<a href="' + LM.esc(LM.wa(lead.phone, 'Hi ' + lead.business + ', about your mockup…')) +
        '" target="_blank" rel="noopener">' + LM.esc(lead.phone) + '</a>' +
        (lead.email ? '<br><small>' + LM.esc(lead.email) + '</small>' : '');
    }
    return '<a href="mailto:' + LM.esc(lead.email) + '">' + LM.esc(lead.email) + '</a>';
  }

  function render() {
    document.getElementById('statTotal').textContent = leads.length;
    var today = new Date().toISOString().slice(0, 10);
    document.getElementById('statToday').textContent = leads.filter(function (l) {
      return String(l.createdAt).slice(0, 10) === today;
    }).length;
    document.getElementById('statAudit').textContent = leads.filter(function (l) { return l.type === 'audit'; }).length;
    document.getElementById('statMockup').textContent = leads.filter(function (l) { return l.type === 'mockup'; }).length;

    var rows = leads.map(function (lead) {
      return '<tr>' +
        '<td>' + LM.esc(new Date(lead.createdAt).toLocaleString()) + '</td>' +
        '<td><strong>' + LM.esc(lead.business) + '</strong><br><small>' + LM.esc(lead.city) + '</small></td>' +
        '<td>' + LM.esc(lead.type) + '</td>' +
        '<td>' + contactCell(lead) + '</td>' +
        '<td>' + (lead.score === null || lead.score === undefined ? '—' : LM.esc(lead.score)) + '</td>' +
        '<td><span class="' + statusClass(lead.status) + '">' + LM.esc(lead.status) + '</span></td>' +
        '<td><select class="status-select" data-id="' + LM.esc(lead.id) + '">' +
          ['new', 'contacted', 'won', 'lost'].map(function (s) {
            return '<option value="' + s + '"' + (s === lead.status ? ' selected' : '') + '>' + s + '</option>';
          }).join('') +
        '</select></td>' +
      '</tr>';
    }).join('');

    document.getElementById('leadRows').innerHTML = rows;
    document.getElementById('empty').textContent = leads.length ? '' : 'No leads yet. Share your mockup link to get the first one.';

    document.querySelectorAll('.status-select').forEach(function (select) {
      select.addEventListener('change', function () {
        LM.patch('/api/leads/' + encodeURIComponent(select.dataset.id), { status: select.value }, token)
          .then(function () { LM.toast('Status updated'); })
          .catch(function (err) { LM.toast(err.message); });
      });
    });
  }

  function load() {
    token = document.getElementById('token').value.trim();
    var error = document.getElementById('gateError');
    var headers = token ? { 'x-admin-token': token } : {};

    fetch('/api/leads', { headers: headers }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || 'Could not open inbox');
        leads = body.leads || [];
        document.getElementById('gate').classList.add('hidden');
        document.getElementById('inbox').classList.remove('hidden');
        render();
      });
    }).catch(function (err) {
      error.textContent = err.message;
      error.classList.remove('hidden');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('unlock').addEventListener('click', load);
    document.getElementById('token').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') load();
    });

    document.getElementById('export').addEventListener('click', function () {
      var header = ['id', 'createdAt', 'type', 'business', 'category', 'city', 'name', 'phone', 'email', 'score', 'status'];
      var cell = function (v) {
        var s = String(v == null ? '' : v);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      var csv = [header.join(','), header.map(function (h) {
        return leads.map(function (l) { return cell(l[h]); }).join(',');
      }).join('\n')].join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'leads.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    });
  });
})();
