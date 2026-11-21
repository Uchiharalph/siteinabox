(function () {
  'use strict';

  var DATA = {
    salon: {
      label: 'Salon & beauty', tag: 'Look good · Book fast', headline: 'Glam that fits your schedule',
      sub: 'Pick a service and message us on WhatsApp.', itemsLabel: 'Popular services',
      items: [['Wash & blowdry', '₦3,500'], ['Wedding makeup', '₦25,000'], ['Manicure & pedicure', '₦4,000']],
      cta: 'Book on WhatsApp', verb: 'book'
    },
    restaurant: {
      label: 'Food & drink', tag: 'Fresh · Fast · Local', headline: 'Your favourite meal, one tap away',
      sub: 'See what’s available and order on WhatsApp.', itemsLabel: 'Today’s favourites',
      items: [['Jollof plate', '₦2,500'], ['Suya wrap', '₦1,800'], ['Chilled drink', '₦800']],
      cta: 'Order on WhatsApp', verb: 'order'
    },
    retail: {
      label: 'Shop & retail', tag: 'Shop from anywhere', headline: 'The things you love, delivered',
      sub: 'Browse, pick and message us to buy.', itemsLabel: 'Popular picks',
      items: [['Classic tee', '₦6,000'], ['Ankara gown', '₦18,000'], ['Gift set', '₦9,500']],
      cta: 'Buy on WhatsApp', verb: 'buy'
    },
    health: {
      label: 'Health & professional', tag: 'Care that fits your day', headline: 'Book your appointment in seconds',
      sub: 'Choose a service and we’ll confirm on WhatsApp.', itemsLabel: 'Services',
      items: [['Consultation', '₦5,000'], ['Follow-up visit', '₦3,000'], ['Full session', '₦12,000']],
      cta: 'Book on WhatsApp', verb: 'book'
    },
    trades: {
      label: 'Trade & home services', tag: 'Help when you need it', headline: 'Tell us the problem. We’ll handle it.',
      sub: 'Pick a service and message us on WhatsApp.', itemsLabel: 'What we do',
      items: [['Leak repair', '₦8,000'], ['Pipe installation', '₦15,000'], ['Emergency visit', '₦12,000']],
      cta: 'Request on WhatsApp', verb: 'request a quote for'
    },
    other: {
      label: 'Business', tag: 'Order online', headline: 'Your services, one tap away',
      sub: 'Pick what you need and message us on WhatsApp.', itemsLabel: 'Popular',
      items: [['Service one', '₦5,000'], ['Service two', '₦10,000'], ['Service three', '₦15,000']],
      cta: 'Order on WhatsApp', verb: 'order'
    }
  };

  var PRESETS = {
    salon: { b: "Sade's Hair Studio", cat: 'salon', city: 'Wuse II, Abuja', tag: 'Look good. Book fast.', wa: '0803 123 4567' },
    restaurant: { b: "Mama Tee's Kitchen", cat: 'restaurant', city: 'Gwarinpa, Abuja', tag: 'Fresh meals, made daily.', wa: '0803 123 4567' },
    plumber: { b: 'QuickFix Plumbing', cat: 'trades', city: 'Lekki, Lagos', tag: 'We fix it. You relax.', wa: '0803 123 4567' },
    retail: { b: 'Lophix Boutique', cat: 'retail', city: 'Wuse 5, Abuja', tag: 'Style that travels.', wa: '0803 123 4567' },
    health: { b: 'Perfect Care Clinic', cat: 'health', city: 'Maitama, Abuja', tag: 'Care on your schedule.', wa: '0803 123 4567' }
  };

  function $(id) { return document.getElementById(id); }

  function selectedColor() {
    var checked = document.querySelector('input[name="color"]:checked');
    return checked ? checked.value : '#0e7c7b';
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'YB';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function render() {
    var business = $('business').value.trim() || 'Your Business';
    var category = DATA[$('category').value] ? $('category').value : 'other';
    var data = DATA[category];
    var city = $('city').value.trim() || 'Your area';
    var tagline = $('tagline').value.trim() || data.tag;
    var waNumber = $('waNumber').value.trim() || '2347086208596';

    $('miniLogo').textContent = initials(business);
    $('miniName').textContent = business;
    $('miniCity').textContent = city;
    $('miniTag').textContent = tagline;
    $('miniHeadline').textContent = data.headline;
    $('miniSub').textContent = data.sub;
    $('miniItemsLabel').textContent = data.itemsLabel;
    $('miniItems').innerHTML = data.items.map(function (item) {
      return '<div class="mini-item"><span>' + LM.esc(item[0]) + '</span><b>' + LM.esc(item[1]) + '</b></div>';
    }).join('');
    $('miniSite').style.setProperty('--mini-accent', selectedColor());

    var wa = $('miniWa');
    wa.textContent = '● ' + data.cta;
    wa.href = LM.wa(waNumber, 'Hi ' + business + ', I’d like to ' + data.verb + ' the ' + data.items[0][0] + '.');
  }

  function previewUrl() {
    return location.origin + location.pathname +
      '?b=' + encodeURIComponent($('business').value.trim()) +
      '&cat=' + encodeURIComponent($('category').value) +
      '&city=' + encodeURIComponent($('city').value.trim()) +
      '&tag=' + encodeURIComponent($('tagline').value.trim()) +
      '&color=' + encodeURIComponent(selectedColor()) +
      '&wa=' + encodeURIComponent($('waNumber').value.trim()) +
      '&ref=' + encodeURIComponent(LM.source());
  }

  document.addEventListener('DOMContentLoaded', function () {
    var preset = PRESETS[LM.param('demo')];
    if (preset) {
      $('business').value = LM.param('b', preset.b);
      $('category').value = DATA[LM.param('cat', preset.cat)] ? LM.param('cat', preset.cat) : preset.cat;
      $('city').value = LM.param('city', preset.city);
      $('tagline').value = LM.param('tag', preset.tag);
      $('waNumber').value = LM.param('wa', preset.wa);
    } else {
      $('business').value = LM.param('b', '');
      if (DATA[LM.param('cat')]) $('category').value = LM.param('cat');
      $('city').value = LM.param('city', '');
      $('tagline').value = LM.param('tag', '');
      $('waNumber').value = LM.param('wa', '');
    }

    var color = LM.param('color');
    if (color) {
      var radio = document.querySelector('input[name="color"][value="' + color.replace(/["\\]/g, '') + '"]');
      if (radio) radio.checked = true;
    }

    ['business', 'category', 'city', 'tagline', 'waNumber'].forEach(function (id) {
      $(id).addEventListener('input', render);
      $(id).addEventListener('change', render);
    });
    document.querySelectorAll('input[name="color"]').forEach(function (radio) {
      radio.addEventListener('change', render);
    });
    render();

    $('mockupForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var error = $('error');
      var business = $('business').value.trim();
      var city = $('city').value.trim();
      var waNumber = $('waNumber').value.trim();
      var phone = $('phone').value.trim();
      var email = $('email').value.trim();
      var consent = $('consent').checked;

      if (!business || !city || !waNumber) {
        error.textContent = 'Add your business name, area and WhatsApp number.';
        error.classList.remove('hidden');
        return;
      }
      if (!phone && !email) {
        error.textContent = 'Add a phone number or email so we can send you the link.';
        error.classList.remove('hidden');
        return;
      }
      if (!consent) {
        error.textContent = 'Please agree to be contacted.';
        error.classList.remove('hidden');
        return;
      }
      error.classList.add('hidden');

      var link = previewUrl();
      var payload = {
        type: 'mockup',
        business: business,
        category: $('category').value,
        city: city,
        name: $('name').value.trim(),
        phone: phone,
        email: email,
        consent: true,
        details: {
          tagline: $('tagline').value.trim(),
          color: selectedColor(),
          waNumber: waNumber,
          previewUrl: link,
          source: LM.source()
        }
      };

      var button = $('mockupForm').querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Saving…';

      LM.post('/api/leads', payload).then(function () {
        $('savedPanel').classList.remove('hidden');
        $('previewUrl').textContent = link;
        $('sendWa').href = LM.wa(phone, 'Your free mockup is ready: ' + link);
        $('goLive').href = LM.wa('2347086208596',
          'Hi Vinks, I saw my mockup for ' + business + ' and I’d like to go live.');
        $('savedPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function (err) {
        error.textContent = 'Could not save (' + err.message + '). Please try again or WhatsApp 0708 620 8596.';
        error.classList.remove('hidden');
      }).then(function () {
        button.disabled = false;
        button.textContent = 'Save & send me my mockup →';
      });
    });

    $('copyLink').addEventListener('click', function () {
      var link = $('previewUrl').textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function () { LM.toast('Preview link copied'); });
      } else {
        window.prompt('Copy this link:', link);
      }
    });
  });
})();
