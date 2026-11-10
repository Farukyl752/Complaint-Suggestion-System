import test from 'node:test';
import assert from 'node:assert/strict';
import {application} from '../sunucu.js';
import {prioritize, validReport} from '../basvuru-kurallari.js';

const report = {kind:'Şikâyet',category:'Yol ve kaldırım',description:'Kaldırımın ortasında açık rögar var.',lat:39.93,lng:32.86};

test('Kayıt, otomatik atama, yetki, durum geçişi ve takip geçmişi', async t => {
  const server = application({database:':memory:',password:'sample'});
  await new Promise(done => server.listen(0,'127.0.0.1',done));
  t.after(() => new Promise(done => server.close(done)));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/';
  const post = data => fetch(url+'reports',{method:'POST',body:JSON.stringify(data)});
  assert.equal((await post({...report,lat:null})).status,400);
  const response = await post(report);
  assert.equal(response.status,201);
  const {code,department} = await response.json();
  assert.equal(department,'Fen İşleri Müdürlüğü');
  assert.match(code,/^KB-[A-F0-9]{20}$/);
  assert.equal((await fetch(url+'staff')).status,401);
  const headers = {Authorization:'Bearer sample'};
  const [item] = await (await fetch(url+'staff',{headers})).json();
  assert.equal(item.score,85);
  assert.equal(item.lat,report.lat);
  assert.equal(item.source,'Yerel kural');
  const patch = (previous,status) => fetch(url+'staff/'+code,{method:'PATCH',headers,body:JSON.stringify({previous,status})});
  assert.equal((await patch('Alındı','Sonuçlandı')).status,400);
  assert.equal((await patch('Alındı','İnceleniyor')).status,200);
  assert.equal((await patch('Alındı','İnceleniyor')).status,409);
  assert.equal((await patch('İnceleniyor','İşlemde')).status,200);
  assert.equal((await patch('İşlemde','Sonuçlandı')).status,200);
  const tracked = await (await fetch(url+'track/'+code)).json();
  assert.deepEqual(tracked.events.map(e=>e.status),['Alındı','İnceleniyor','İşlemde','Sonuçlandı']);
  assert.equal(tracked.status,'Sonuçlandı');
  assert.equal((await fetch(url+'track/unknown')).status,404);
});

test('LLM puanını ve gerekçesini saklar, isteğe koordinat eklemez', async () => {
  const mock = async (url,options) => {
    const user = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.deepEqual(Object.keys(user),['type','category','text']);
    return Response.json({choices:[{message:{content:'{"score":91,"reason":"Açık rögar düşme riski oluşturuyor."}'}}]});
  };
  assert.equal((await prioritize(report,'test','test-model',mock)).score,91);
});
test('Bozuk LLM yanıtında yerel puana döner', async () => {
  const result = await prioritize(report,'test','test-model',async () => Response.json({choices:[]}));
  assert.equal(result.source,'Yerel kural');
});
test('Kategori ve konum sınırları denetlenir', () => {
  assert.ok(validReport({...report, kind:'Öneri'}));
  for (const fields of [{category:'constructor'},{lng:181},{lat:-91},{description:'Kısa'}]) {
    assert.ok(!validReport({...report,...fields}));
  }
});
