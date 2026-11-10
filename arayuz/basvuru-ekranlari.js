'use strict';
const $ = id => document.getElementById(id);
const time = value => new Date(value).toLocaleString('tr-TR');
const element = (tag, text) => Object.assign(document.createElement(tag), {textContent:text});
let config, secret = '', rows = [], marker;
const map = L.map('map').setView([39.9334,32.8597], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).on('tileerror', () => {
  $('mapNote').textContent = 'Harita görselleri yüklenemedi. Konumu koordinat girerek belirtebilirsiniz.';
}).addTo(map);
function mark(lat, lng) {
  if (marker) marker.setLatLng([lat,lng]);
  else marker = L.circleMarker([lat,lng], {color:'#fff',fillColor:'#b44921',fillOpacity:1,radius:9,weight:3}).addTo(map);
}
map.on('click', e => {
  const point = e.latlng.wrap();
  $('lat').value = point.lat.toFixed(6);
  $('lng').value = point.lng.toFixed(6);
  mark(point.lat,point.lng);
});
for (const id of ['lat','lng']) $(id).addEventListener('change', () => {
  if ($('lat').validity.valid && $('lng').validity.valid) {
    const point = [Number($('lat').value),Number($('lng').value)];
    mark(...point);
    map.panTo(point);
  }
});
function navigate() {
  const pages = ['basvuru','takip','personel'];
  const page = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : pages[0];
  for (const id of pages) $(id).hidden = id !== page;
  for (const a of document.querySelectorAll('nav a')) {
    if (a.hash === '#' + page) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  }
  if (page === 'basvuru') map.invalidateSize();
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
    $('category').add(new Option(category,category));
    $('unit').add(new Option(unit,unit));
  }
}
init().catch(() => $('submitMsg').textContent = 'Bağlantı kurulamadı. Sayfayı yenileyin.');
$('category').onchange = () => $('route').textContent = config.departments[$('category').value] || '';
$('report').onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $('submitMsg').textContent = 'Başvurunuz işleniyor…';
  try {
    const report = {kind:new FormData($('report')).get('kind'),category:$('category').value,
      description:$('description').value,lat:Number($('lat').value),lng:Number($('lng').value)};
    const r = await api('reports', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(report)});
    $('assigned').textContent = 'İlgili birim: ' + r.department;
    $('receiptCode').value = r.code;
    $('code').value = r.code;
    $('receipt').hidden = false;
    $('report').hidden = true;
    $('submitMsg').textContent = '';
    $('receiptCode').focus();
  } catch (e) { $('submitMsg').textContent = e.message; }
  finally { button.disabled = false; }
};
$('again').onclick = () => {
  $('receipt').hidden = true;
  $('report').hidden = false;
  $('report').reset();
  $('route').textContent = '';
  if (marker) { marker.remove(); marker = null; }
  map.invalidateSize();
};
async function lookup() {
  $('result').replaceChildren();
  $('trackMsg').textContent = 'Sorgulanıyor…';
  try {
    const r = await api('track/' + encodeURIComponent($('code').value.trim().toUpperCase()));
    const list = element('ol','');
    for (const event of r.events) list.append(element('li', event.status + ' · ' + time(event.at)));
    $('result').replaceChildren(element('h2',r.status),element('p',r.category + ' · ' + r.department),element('h3','İşlem geçmişi'),list);
    $('trackMsg').textContent = '';
  } catch (e) { $('trackMsg').textContent = e.message; }
}
$('openTrack').onclick = () => { $('code').value = $('receiptCode').value; lookup(); };
$('lookup').onsubmit = e => { e.preventDefault(); lookup(); };
function staffHeaders() { return {Authorization:'Bearer ' + secret, 'Content-Type':'application/json'}; }
function drawQueue() {
  $('queue').replaceChildren();
  for (const r of rows.filter(r => !$('unit').value || r.department === $('unit').value)) {
    const card = element('article','');
    card.className = 'ticket';
    const tag = element('span','Öncelik ' + r.score + '/100 · ' + r.source);
    tag.className = 'tag';
    const link = element('a','Konumu görüntüle ↗');
    link.href = 'https://www.openstreetmap.org/?mlat=' + r.lat + '&mlon=' + r.lng + '#map=17/' + r.lat + '/' + r.lng;
    link.target = '_blank';
    link.rel = 'noreferrer';
    card.append(tag,element('h2',r.category + ' · ' + r.kind), element('p',r.description),
      element('small',r.department + ' · ' + time(r.created)),element('small',r.reason),
      element('small',r.code + ' · ' + r.status),link);
    const next = config.statuses[config.statuses.indexOf(r.status) + 1];
    if (next) {
      const button = element('button','İlerlet → ' + next);
      button.onclick = async () => {
        button.disabled = true;
        try {
          await api('staff/' + r.code,{method:'PATCH',headers:staffHeaders(),body:JSON.stringify({previous:r.status,status:next})});
          await refresh();
        } catch (e) { $('staffMsg').textContent = e.message; button.disabled = false; }
      };
      card.append(button);
    }
    $('queue').append(card);
  }
  if (!$('queue').childElementCount) $('queue').append(element('p','Bu görünümde başvuru yok.'));
}
async function refresh() {
  rows = await api('staff',{headers:staffHeaders()});
  $('loginBox').hidden = true;
  $('desk').hidden = false;
  $('staffMsg').textContent = '';
  drawQueue();
}
$('login').onsubmit = async e => {
  e.preventDefault();
  secret = $('password').value;
  try { await refresh(); $('password').value = ''; }
  catch (e) { $('staffMsg').textContent = e.message; secret = ''; }
};
$('refresh').onclick = () => refresh().catch(e => $('staffMsg').textContent = e.message);
$('unit').onchange = drawQueue;
$('logout').onclick = () => {
  secret = ''; rows = [];
  $('desk').hidden = true;
  $('loginBox').hidden = false;
  $('queue').replaceChildren();
  $('staffMsg').textContent = '';
  $('unit').value = '';
};
