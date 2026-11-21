(function () {
  'use strict';

  var CHECKS = [
    { key: 'hasSite', label: 'A website customers can visit', fix: 'A simple ordering page makes you look open for business, 24 hours a day.' },
    { key: 'hasMaps', label: 'A Google Maps listing', fix: 'Add a website link and WhatsApp button to your Maps listing so people can act.' },
    { key: 'hasWa', label: 'A way to order or book on WhatsApp', fix: 'One WhatsApp button with a prefilled message turns a question into an order.' },
    { key: 'hasPhone', label: 'A phone number shown clearly online', fix: 'Put your number where customers can tap it — not buried in a caption.' }
  ];

  function valueOf(key) {
    var el = document.getElementById(key);
    return el ? el.value : 'no';
  }

  function points(answer) {
    if (answer === 'yes') return 25;
    if (answer === 'unknown') return 10;
    return 0;
  }

  function mark(answer) {
    if (answer === 'yes') return '<span class="mark ok">✓</span>';
    if (answer === 'unknown') return '<span class="mark mid">?</span>';
    return '<span class="mark no">✕</span>';
  }

  function compute(answers) {
    return CHECKS.reduce(function (sum, c) { return sum + points(answers[c.key]); }, 0);
  }

  function titleFor(score) {
    if (score < 40) return 'Hard to find right now';
    if (score < 70) return "You're halfway there";
    return 'Looking good — let’s make it great';
  }

  function noteFor(score) {
    if (score < 40) return 'Most customers won’t discover you online yet. The good news: this is fixable in a day.';
    if (score < 70) return 'You have the basics, but a few gaps are costing you orders.';
    return 'You’re ahead of most local businesses. A proper page would make it effortless to order from you.';
  }

  function render(business, category, city, answers, score, save) {
    document.getElementById('auditFormCard').classList.add('hidden');
    document.getElementById('result').classList.remove('hidden');

    var ring = document.getElementById('scoreRing');
    ring.style.setProperty('--score', score + '%');
    document.getElementById('scoreValue').textContent = String(score);
    document.getElementById('scoreTitle').textContent = titleFor(score);
    document.getElementById('scoreNote').textContent = noteFor(score);

    document.getElementById('checkList').innerHTML = CHECKS.map(function (c) {
      var answer = answers[c.key];
      var line = answer === 'yes' ? 'In place.' : (answer === 'unknown' ? 'Worth checking.' : c.fix);
      return '<li>' + mark(answer) + '<div><strong>' + LM.esc(c.label) + '</strong><br><span class="soft">' + LM.esc(line) + '</span></div></li>';
    }).join('');

    var toMockup = document.getElementById('toMockup');
    toMockup.href = 'mockup.html?b=' + encodeURIComponent(business) +
      '&cat=' + encodeURIComponent(category) + '&city=' + encodeURIComponent(city) +
      '&ref=' + encodeURIComponent(LM.source());

    var saved = document.getElementById('saved');
    if (!save) {
      saved.textContent = 'This is a shared result. Want your own? Take the check above.';
      return;
    }

    saved.textContent = 'Saving your result…';
    var payload = {
      type: 'audit',
      business: business,
      category: category,
      city: city,
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      consent: true,
      score: score,
      details: Object.assign({}, answers, { source: LM.source() })
    };

    LM.post('/api/leads', payload).then(function (res) {
      saved.textContent = 'Saved ✓ We’ll be in touch at ' + (payload.phone || payload.email) + '.';
    }).catch(function (err) {
      saved.textContent = 'We couldn’t save your result (' + err.message + '). Message us on WhatsApp: 0708 620 8596.';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    var prefill = [
      ['business', 'b'], ['category', 'cat'], ['city', 'city'],
      ['hasSite', 's'], ['hasMaps', 'm'], ['hasWa', 'w'], ['hasPhone', 'p']
    ];
    prefill.forEach(function (pair) {
      var value = params.get(pair[1]);
      var el = document.getElementById(pair[0]);
      if (value && el) el.value = value;
    });

    // Shared result link: show the result immediately, without saving a lead.
    if (params.get('r') === '1' && params.get('b')) {
      var answers = { hasSite: params.get('s') || 'no', hasMaps: params.get('m') || 'no',
        hasWa: params.get('w') || 'no', hasPhone: params.get('p') || 'no' };
      var biz = params.get('b') || '';
      var cat = params.get('cat') || 'other';
      var ct = params.get('city') || '';
      render(biz, cat, ct, answers, compute(answers), false);
    }

    document.getElementById('auditForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var error = document.getElementById('error');
      var business = document.getElementById('business').value.trim();
      var city = document.getElementById('city').value.trim();
      var phone = document.getElementById('phone').value.trim();
      var email = document.getElementById('email').value.trim();
      var consent = document.getElementById('consent').checked;

      if (!business || !city) { error.textContent = 'Add your business name and location.'; error.classList.remove('hidden'); return; }
      if (!phone && !email) { error.textContent = 'Add a phone number or email so we can reach you.'; error.classList.remove('hidden'); return; }
      if (!consent) { error.textContent = 'Please agree to be contacted.'; error.classList.remove('hidden'); return; }
      error.classList.add('hidden');

      var answers = { hasSite: valueOf('hasSite'), hasMaps: valueOf('hasMaps'),
        hasWa: valueOf('hasWa'), hasPhone: valueOf('hasPhone') };
      var category = document.getElementById('category').value;
      var score = compute(answers);

      render(business, category, city, answers, score, true);

      document.getElementById('copyResult').addEventListener('click', function () {
        var link = location.origin + location.pathname +
          '?r=1&b=' + encodeURIComponent(business) +
          '&cat=' + encodeURIComponent(category) +
          '&city=' + encodeURIComponent(city) +
          '&s=' + answers.hasSite + '&m=' + answers.hasMaps +
          '&w=' + answers.hasWa + '&p=' + answers.hasPhone;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(function () { LM.toast('Link copied'); });
        } else {
          window.prompt('Copy this link:', link);
        }
      });
    });
  });
})();
