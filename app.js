'use strict';

const $ = id => document.getElementById(id);
const time = value => new Date(value).toLocaleString('tr-TR');
const element = (tag, text) => Object.assign(document.createElement(tag), {textContent: text});

let config, secret = '', rows = [];
let secilenKonum = null;

// 1. Haritaya Tıklanınca Bölge ve Koordinatı Al
$('mapContainer').addEventListener('click', e => {
  const rect = $('mapContainer').getBoundingClientRect();
  const xOran = (e.clientX - rect.left) / rect.width;
  const yOran = (e.clientY - rect.top) / rect.height;

  // Adana koordinat hesabı ve tıklanan bölgenin adı
  const lat = Number((37.06 - yOran * 0.1).toFixed(6));
  const lng = Number((35.25 + xOran * 0.15).toFixed(6));
  const bolgeAdi =
    e.target.getAttribute('data-bolge') ||
    (xOran < 0.55 ? 'Seyhan / Merkez Cadde' : 'Yüreğir / Merkez Cadde');

  secilenKonum = { bolge: `Adana - ${bolgeAdi}`, lat, lng };

  // Form kutularını doldur (readonly Enlem / Boylam / Bölge)
  $('regionInput').value = secilenKonum.bolge;
  $('latInput').value = lat;
  $('lngInput').value = lng;

  // Harita üzerinde pini göster
  const mapPin = $('mapPin');
  mapPin.style.left = `${xOran * 100}%`;
  mapPin.style.top = `${yOran * 100}%`;
  mapPin.textContent = `📍 ${secilenKonum.bolge}`;
  mapPin.hidden = false;
});

// 2. Konum ve Şikayeti Sunucuya Gönderen Callback Fonksiyonu
async function sikayetCallback(veri) {
  return await api('reports', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(veri)
  });
}

// Sekme Yönlendirmesi (#basvuru, #takip, #personel)
function navigate() {
  const pages = ['basvuru', 'takip', 'personel'];
  const page = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : pages[0];
  for (const id of pages) $(id).hidden = id !== page;
  for (const a of document.querySelectorAll('nav a')) {
    if (a.hash === '#' + page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange', navigate);
navigate();

async function api(path, options) {
  const response = await fetch('/api/' + path, options);
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'İşlem tamamlanamadı.');
  return result;
}

async function init() {
  config = await api('config');
  for (const [category, unit] of Object.entries(config.departments)) {
    $('category').add(new Option(category, category));
    $('unit').add(new Option(unit, unit));
  }
}
init().catch(() => $('submitMsg').textContent = 'Bağlantı kurulamadı. Sayfayı yenileyin.');

$('category').onchange = () => $('route').textContent = config.departments[$('category').value] || '';

// 3. Form Gönderildiğinde Callback ile Kaydet ve Takip Numarası Üret
$('report').onsubmit = async event => {
  event.preventDefault();
  if (!secilenKonum) {
    $('submitMsg').textContent = 'Lütfen önce haritadan bir bölgeye tıklayın!';
    return;
  }
  const button = event.submitter;
  button.disabled = true;
  $('submitMsg').textContent = 'Başvurunuz işleniyor…';
  try {
    const veri = {
      kind: new FormData($('report')).get('kind'),
      category: $('category').value,
      description: $('complaintInput').value.trim(),
      lat: secilenKonum.lat,
      lng: secilenKonum.lng,
      region: secilenKonum.bolge
    };
    const r = await sikayetCallback(veri);
    $('assigned').textContent = 'İlgili birim: ' + r.department + (r.region ? ' · Bölge: ' + r.region : '');
    $('priorityInfo').textContent = r.score !== undefined ? `Öncelik Analizi: ${r.score}/100 (${r.source}) — ${r.reason}` : '';
    $('receiptCode').value = r.code;
    $('code').value = r.code;
    $('receipt').hidden = false;
    $('report').hidden = true;
    $('submitMsg').textContent = '';
    $('receiptCode').focus();
  } catch (e) {
    $('submitMsg').textContent = e.message;
  } finally {
    button.disabled = false;
  }
};

$('again').onclick = () => {
  $('receipt').hidden = true;
  $('report').hidden = false;
  $('report').reset();
  $('route').textContent = '';
  $('mapPin').hidden = true;
  secilenKonum = null;
};

// 4. Takip Numarası ile Durum Sorgulama
async function lookup() {
  $('result').replaceChildren();
  $('trackMsg').textContent = 'Sorgulanıyor…';
  try {
    const r = await api('track/' + encodeURIComponent($('code').value.trim().toUpperCase()));
    const list = element('ol', '');
    for (const event of r.events) list.append(element('li', event.status + ' · ' + time(event.at)));
    const metaText = [r.category, r.department, r.region].filter(Boolean).join(' · ');
    const nodes = [element('h2', r.status), element('p', metaText)];
    if (r.score !== undefined) {
      nodes.push(element('small', `Öncelik Puanı: ${r.score}/100 (${r.source || 'Yerel kural'}) — ${r.reason || ''}`));
    }
    nodes.push(element('h3', 'İşlem geçmişi'), list);
    $('result').replaceChildren(...nodes);
    $('trackMsg').textContent = '';
  } catch (e) {
    $('trackMsg').textContent = e.message;
  }
}

$('openTrack').onclick = () => { $('code').value = $('receiptCode').value; lookup(); };
$('lookup').onsubmit = e => { e.preventDefault(); lookup(); };

// 5. Personel Paneli ve AI Öncelik Sıralama
function staffHeaders() {
  return {Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json'};
}

function drawQueue() {
  $('queue').replaceChildren();
  for (const r of rows.filter(r => !$('unit').value || r.department === $('unit').value)) {
    const card = element('article', '');
    card.className = 'ticket';
    const tag = element('span', 'Öncelik ' + r.score + '/100 · ' + r.source);
    tag.className = 'tag';
    const locationMeta = [r.department, r.region || `(${r.lat}, ${r.lng})`, time(r.created)].filter(Boolean).join(' · ');
    card.append(
      tag,
      element('h2', r.category + ' · ' + r.kind),
      element('p', r.description),
      element('small', locationMeta),
      element('small', r.reason),
      element('small', r.code + ' · ' + r.status)
    );
    const next = config.statuses[config.statuses.indexOf(r.status) + 1];
    if (next) {
      const button = element('button', 'İlerlet → ' + next);
      button.onclick = async () => {
        button.disabled = true;
        try {
          await api('staff/' + r.code, {
            method: 'PATCH',
            headers: staffHeaders(),
            body: JSON.stringify({previous: r.status, status: next})
          });
          await refresh();
        } catch (e) {
          $('staffMsg').textContent = e.message;
          button.disabled = false;
        }
      };
      card.append(button);
    }
    $('queue').append(card);
  }
  if (!$('queue').childElementCount) $('queue').append(element('p', 'Bu görünümde başvuru yok.'));
}

async function refresh() {
  rows = await api('staff', {headers: staffHeaders()});
  $('loginBox').hidden = true;
  $('desk').hidden = false;
  $('staffMsg').textContent = '';
  drawQueue();
}

$('login').onsubmit = async e => {
  e.preventDefault();
  secret = $('password').value;
  try {
    await refresh();
    $('password').value = '';
  } catch (e) {
    $('staffMsg').textContent = e.message;
    secret = '';
  }
};

$('refresh').onclick = () => refresh().catch(e => $('staffMsg').textContent = e.message);

$('reorderBtn').onclick = async () => {
  $('reorderBtn').disabled = true;
  $('staffMsg').textContent = 'Şikayetler önem ve aciliyet sırasına göre yeniden analiz ediliyor…';
  try {
    rows = await api('staff/reorder', {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify(rows)
    });
    $('staffMsg').textContent = 'Öncelik sıralaması güncellendi.';
    drawQueue();
  } catch (e) {
    $('staffMsg').textContent = e.message;
  } finally {
    $('reorderBtn').disabled = false;
  }
};

$('unit').onchange = drawQueue;

$('logout').onclick = () => {
  secret = '';
  rows = [];
  $('desk').hidden = true;
  $('loginBox').hidden = false;
  $('queue').replaceChildren();
  $('staffMsg').textContent = '';
  $('unit').value = '';
};
