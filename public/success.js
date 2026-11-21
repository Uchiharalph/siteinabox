(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function () {
    var reference = window.LM.param('reference', '');
    if (!reference) {
      $('statusTitle').textContent = 'No reference';
      $('statusText').textContent = 'Open the link from your payment confirmation, or message us on WhatsApp.';
      return;
    }

    fetch('/api/paystack/verify?reference=' + encodeURIComponent(reference))
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || 'Could not check payment');
        return body;
      }); })
      .then(function (sale) {
        var success = sale.status === 'success';
        $('statusTitle').textContent = success ? 'Payment received 🎉' : 'Payment not completed';
        $('statusText').textContent = success
          ? 'Thanks! We’ll contact you shortly to get your site live. If you don’t hear from us within a few hours, message us on WhatsApp.'
          : 'Paystack did not confirm this payment. If you were charged, message us with your reference.';

        var details = $('statusDetails');
        details.classList.remove('hidden');
        var naira = function (v) { return '₦' + Number(v || 0).toLocaleString('en-NG'); };
        details.innerHTML = '<strong>' + window.LM.esc(sale.business || 'Your business') + '</strong><br>' +
          '<small>Setup paid: ' + window.LM.esc(naira(sale.amount)) + '</small><br>' +
          '<small>Then: ' + window.LM.esc(naira(sale.monthlyAmount)) + '/month</small><br>' +
          '<small>Reference: ' + window.LM.esc(sale.reference) + '</small><br>' +
          '<small>Status: ' + window.LM.esc(sale.status || '—') + '</small>';
      })
      .catch(function (err) {
        $('statusTitle').textContent = 'Could not check payment';
        $('statusText').textContent = err.message + '. Message us on WhatsApp with your reference.';
      });
  });
})();
