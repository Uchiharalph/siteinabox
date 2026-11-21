(function () {
  'use strict';

  function naira(value) {
    return '₦' + Number(value || 0).toLocaleString('en-NG');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var source = window.LM.source();

    document.querySelectorAll('a[href^="mockup.html"], a[href^="audit.html"], a[href^="checkout.html"]').forEach(function (link) {
      if (!link.getAttribute('href').includes('?')) {
        link.setAttribute('href', link.getAttribute('href') + '?ref=' + encodeURIComponent(source));
      }
    });

    fetch('/api/config').then(function (res) { return res.json(); }).then(function (config) {
      var pricing = config.pricing || {};
      var plans = pricing.plans || {};
      var monthly = naira(pricing.monthlyNgn || 10000);

      function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
      }

      if (plans.launch) {
        setText('launchPrice', naira(plans.launch.setupNgn) + ' setup');
        setText('launchNote', 'Then ' + naira(plans.launch.monthlyNgn) + '/month. .org domain included.');
      }
      if (plans.dfy) {
        setText('dfyPrice', naira(plans.dfy.setupNgn) + ' setup');
        setText('dfyNote', 'Then ' + naira(plans.dfy.monthlyNgn) + '/month. Domain included.');
      }

      function configure(buttonId, plan, directUrl, apiCheckout) {
        var button = document.getElementById(buttonId);
        if (!button || !plans[plan]) return;
        var amount = naira(plans[plan].setupNgn);
        if (directUrl) {
          button.href = directUrl;
          button.textContent = 'Pay ' + amount + ' on Paystack →';
          button.setAttribute('target', '_blank');
          button.setAttribute('rel', 'noopener');
        } else if (apiCheckout) {
          button.href = '/checkout.html?plan=' + plan + '&ref=' + encodeURIComponent(source);
          button.textContent = 'Get started — ' + amount;
        } else {
          button.textContent = plan === 'launch' ? 'See my mockup first' : 'Talk to us on WhatsApp';
        }
      }

      configure('btnLaunch', 'launch', config.paystack.launchUrl, config.paystack.apiCheckout);
      configure('btnDfy', 'dfy', config.paystack.dfyUrl, config.paystack.apiCheckout);
    }).catch(function () {});
  });
})();
