import test from 'node:test';
import assert from 'node:assert/strict';
import {prioritize, validReport, inferCategory, departments} from '../basvuru-kurallari.js';
import {analyzeWithGemini, orderComplaintList, localPrioritize} from '../complaint_ordering.js';

const report = {kind:'Şikâyet',category:'Yol ve kaldırım',description:'Kaldırımın ortasında açık rögar var.',lat:37.01,lng:35.32,region:'Adana - Seyhan / Gazipaşa Mah.'};

test('Ortak yerel puanlama kuralı hem tekil kayıtta hem sıralamada aynı sonucu verir', async () => {
  const single = await prioritize(report, '');
  const local = localPrioritize(report);
  assert.equal(single.score, 85);
  assert.equal(local.score, 85);
  assert.equal(single.source, 'Yerel kural');
});

test('OpenAI LLM puanını ve gerekçesini saklar, isteğe koordinat eklemez', async () => {
  const mock = async (url,options) => {
    const user = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.deepEqual(Object.keys(user),['type','category','text']);
    return Response.json({choices:[{message:{content:'{"score":91,"reason":"Açık rögar düşme riski oluşturuyor."}'}}]});
  };
  assert.equal((await prioritize(report,'test','test-model',mock)).score,91);
});

test('Gemini LLM analizi ve toplu sıralama çalışır', async () => {
  const geminiMock = async () => Response.json({
    candidates: [{content: {parts: [{text: '{"score":94,"reason":"Yüksek düşme ve yaralanma riski."}' }]}}]
  });
  const res = await analyzeWithGemini(report, 'AIzaSyTestKey', 'gemini-2.5-flash', geminiMock);
  assert.equal(res.score, 94);
  assert.equal(res.source, 'LLM (Gemini)');

  const ordered = await orderComplaintList([
    {kind: 'Öneri', description: 'Parka yeni banklar eklensin lütfen.'},
    {kind: 'Şikâyet', description: 'Sokakta açık rögar ve kopmuş kablo var!'}
  ], '');
  assert.equal(ordered[0].score, 85);
  assert.equal(ordered[1].score, 25);
});

test('Bozuk LLM yanıtında yerel puana döner', async () => {
  const result = await prioritize(report,'test','test-model',async () => Response.json({choices:[]}));
  assert.equal(result.source,'Yerel kural');
});

test('Kategori, departman yönlendirme ve konum sınırları denetlenir', () => {
  assert.ok(validReport({...report, kind:'Öneri'}));
  assert.equal(departments['Yol ve kaldırım'], 'Fen İşleri Müdürlüğü');
  assert.equal(inferCategory('Mahalledeki çöp konteyneri taşmış'), 'Atık ve temizlik');
  for (const fields of [{category:'constructor'},{lng:181},{lat:-91},{description:'Kısa'}]) {
    assert.ok(!validReport({...report,...fields}));
  }
});
