(function () {
  'use strict';

  var LM = {
    post: function (path, data) {
      return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Request failed');
          return body;
        });
      });
    },

    patch: function (path, data, token) {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['x-admin-token'] = token;
      return fetch(path, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(data)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Request failed');
          return body;
        });
      });
    },

    esc: function (value) {
      var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
    },

    param: function (name, fallback) {
      var v = new URLSearchParams(window.location.search).get(name);
      return v === null ? (fallback === undefined ? '' : fallback) : v;
    },

    wa: function (number, text) {
      var digits = String(number || '').replace(/\D/g, '');
      if (!digits) return '#';
      return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
    },

    source: function () {
      var params = new URLSearchParams(window.location.search);
      return params.get('ref') || params.get('utm_source') || sessionStorage.getItem('lm_source') || 'direct';
    },

    toast: function (message) {
      var old = document.querySelector('.toast');
      if (old) old.remove();
      var el = document.createElement('div');
      el.className = 'toast';
      el.textContent = message;
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 2600);
    },

    init: function () {
      var year = document.getElementById('year');
      if (year) year.textContent = new Date().getFullYear();
      var ref = this.param('ref') || this.param('utm_source');
      if (ref) sessionStorage.setItem('lm_source', ref);
    }
  };

  window.LM = LM;
  document.addEventListener('DOMContentLoaded', function () { LM.init(); });
})();
