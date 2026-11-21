(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function naira(value) {
    return '₦' + Number(value || 0).toLocaleString('en-NG');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var plan = window.LM.param('plan', 'launch');
    if (plan !== 'launch' && plan !== 'dfy') plan = 'launch';

    $('business').value = window.LM.param('b', '');
    $('email').value = window.LM.param('email', '');
    $('name').value = window.LM.param('name', '');
    $('phone').value = window.LM.param('phone', '');

    fetch('/api/config').then(function (res) { return res.json(); }).then(function (config) {
      var info = (config.pricing && config.pricing.plans && config.pricing.plans[plan]) || null;
      var setup = info ? naira(info.setupNgn) : '₦—';
      var monthly = info ? naira(info.monthlyNgn) : '₦—';

      $('planTitle').textContent = plan === 'launch' ? 'Get your site and domain' : 'Let us build it for you';
      $('planLabel').textContent = info ? info.name : (plan === 'launch' ? 'Launch' : 'Done-for-you');
      $('planPrice').innerHTML = setup + ' <small>setup</small>';
      $('planPeriod').textContent = 'Then ' + monthly + '/month — ' + (info ? info.delivery.toLowerCase() : 'hosting included');
      $('planNote').textContent = 'Includes your .org domain for the first year. You’ll be taken to Paystack to complete payment.';

      var url = plan === 'launch' ? config.paystack.launchUrl : config.paystack.dfyUrl;
      if (!config.paystack.apiCheckout && url) {
        $('payButton').classList.add('hidden');
        $('fallbackLink').classList.remove('hidden');
        $('fallbackLink').href = url;
      }
      if (!config.paystack.apiCheckout && !url) {
        $('payButton').disabled = true;
        $('payButton').textContent = 'Checkout not configured yet';
        $('planNote').textContent = 'Online payment isn’t turned on yet. Message us on WhatsApp: 0708 620 8596.';
      }
    }).catch(function () {});

    $('checkoutForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var error = $('error');
      var email = $('email').value.trim();
      var business = $('business').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        error.textContent = 'Enter a valid email address.';
        error.classList.remove('hidden');
        return;
      }
      if (!business) {
        error.textContent = 'Enter your business name.';
        error.classList.remove('hidden');
        return;
      }
      error.classList.add('hidden');

      var button = $('payButton');
      button.disabled = true;
      button.textContent = 'Opening Paystack…';

      fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan,
          email: email,
          name: $('name').value.trim(),
          phone: $('phone').value.trim(),
          business: business
        })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Could not start checkout');
          window.location.href = body.authorizationUrl;
        });
      }).catch(function (err) {
        error.textContent = err.message + '. You can also message us on WhatsApp: 0708 620 8596.';
        error.classList.remove('hidden');
        button.disabled = false;
        button.textContent = 'Continue to Paystack →';
      });
    });
  });
})();
