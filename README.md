# KentBildir

Engineering Design · Proje 22 · Complaint/Suggestion System

Vatandaşlar bir şikâyet veya öneri için konum işaretler ve takip numarası alır. Belediye personeli başvuruları ilgili birime göre filtreler, öncelik puanını inceler ve işlem durumunu günceller. Arayüz Türkçedir.

## Yerel kurulum

Node.js 24 veya üzeri ve npm gerekir. Sunucu Node.js’in yerleşik HTTP ve SQLite modüllerini kullanır. Leaflet dosyaları projeye dahildir.

1. ZIP dosyasını açın. Terminalde içine çıkarılan `kentbildir` klasörüne geçin.
2. Aşağıdaki komutları çalıştırın. Windows PowerShell’de ilk komut için `Copy-Item ornek-ayarlar.env .env` kullanabilirsiniz.

```bash
cp ornek-ayarlar.env .env
npm start
```

3. Tarayıcıda [KentBildir’i açın](http://127.0.0.1:3000). Port doluysa önce sunucuyu durdurun, `.env` içinde PORT değerini değiştirin ve yeniden başlatın.
4. Personel sekmesi için terminalde yazılan geçici parolayı kullanın. Kalıcı parola belirlemek için `.env` içindeki ADMIN_PASSWORD alanını doldurun ve sunucuyu yeniden başlatın.

Sunucu yalnızca yerel bilgisayarda dinler. Başvurular ilk çalıştırmada oluşturulan `data/kent.db` dosyasında saklanır ve yeniden başlatıldığında korunur.

## LLM ile öncelik analizi

Gerçek API ile gösterim için `.env` içindeki OPENAI_API_KEY alanına kendi OpenAI API anahtarınızı yazın. OPENAI_MODEL varsayılanı gpt-4o-mini değeridir. Hesabınızda erişilebilen, Chat Completions ve JSON nesne çıktısını destekleyen bir model kullanın. Değişiklikten sonra sunucuyu yeniden başlatıp yeni bir başvuru oluşturun.

Sunucu API’ye yalnızca tür, kategori ve açıklamayı iletir. Model fiziksel risk, etkilenen kişi sayısı ve zaman hassasiyetinden 0–100 arası bir öncelik puanı ve Türkçe gerekçe üretir. Personel panelinde başarılı model yanıtı **LLM** olarak görünür. Puan başvuruları sıralamak içindir. Durum geçişini personel yapar.

Anahtar boşsa, servis hata verirse, 10 saniyede cevap gelmezse veya yanıt beklenen biçime uymazsa kayıt **Yerel kural** etiketiyle tamamlanır. Bu modda risk ifadeleri 85, diğer şikâyetler 50 ve diğer öneriler 25 puan alır. Önceden kaydedilmiş başvuruların puanları sonradan değişmez.

## Sınıfta gösterim

1. **Başvuru oluştur** ekranında Şikâyet ve Yol ve kaldırım seçeneklerini seçin. “Okul girişindeki kaldırımda açık rögar var, öğrenciler yanından geçiyor.” yazın.
2. Haritada bir noktaya tıklayın. Enlem ve boylamın dolduğunu görün. Harita Ankara merkezinde açılır, başka bir bölgeye kaydırılabilir. Harita görselleri için internet gerekir. Bağlantısız demoda koordinat alanlarına 39.9334 ve 32.8597 girebilirsiniz.
3. Başvuruyu gönderin ve verilen takip numarasını kopyalayın. İlgili birim Fen İşleri Müdürlüğü olarak görünür.
4. **Personel** ekranına girin. Fen İşleri Müdürlüğünü seçin, öncelik gerekçesini ve kaynağını gösterin. Başvuruyu İnceleniyor aşamasına ilerletin.
5. **Başvuru takibi** ekranında numarayı sorgulayın. Hem Alındı hem de İnceleniyor olaylarının tarih ve saatleri görünür.
6. Öneri türü ve Park ve yeşil alan kategorisiyle ikinci bir kayıt açarak farklı birime yönlendirmeyi gösterin.

## Tasarım

| Gereksinim | Uygulama |
| --- | --- |
| Şikâyet ve öneri iletme | Tür, kategori, açıklama ve koordinatları sunucu doğrular. |
| Haritada konum | Leaflet ve OpenStreetMap ile tıklanan koordinat kayda eklenir. Personel kayıtlı noktayı açabilir. |
| Otomatik yönlendirme | Sunucu seçilen kategoriyi basvuru-kurallari.js içindeki sabit departman tablosuyla eşler. |
| Öncelik sıralaması | Sunucu puanı ve gerekçeyi kaydeder. Panel önce yüksek puanlı başvuruları, eşit puanda önce eski kaydı gösterir. |
| Takip numarası | Kriptografik rastgele 80 bitten KB- önekli bir kod üretilir. Vatandaş bu kodla birimi, durumu ve geçmişi görür. |
| Durum geçmişi | Alındı → İnceleniyor → İşlemde → Sonuçlandı. Durum güncellemesi ve geçmiş kaydı aynı SQLite işleminde yazılır. |

**Kod düzeni.** sunucu.js HTTP uçlarını ve kalıcı kayıt işlemlerini, basvuru-kurallari.js doğrulamayı, yönlendirme kurallarını ve öncelik analizini içerir. arayuz/ klasöründe vatandaş ve personel arayüzleri, testler/ klasöründe Node.js testleri bulunur. reports tablosu her başvurunun son durumunu, events tablosu o başvurunun tüm durum geçişlerini saklar.

## Test

```bash
npm test
```

Testler geçici bir bellek veritabanı kullanır. Başvuru oluşturma, veri doğrulama, otomatik birim ataması, personel erişimi, durum geçişleri, eski durumla güncelleme çakışması ve takip geçmişi denetlenir. LLM testlerinde örnek API yanıtı kullanılır. Gerçek servisle doğrulama için yeni kaydın paneldeki puan kaynağını kontrol edin.

## GitHub’a yükleme

GitHub’da boş bir depo oluşturun. README ekleme seçeneğini kapalı bırakın. Proje klasöründe aşağıdaki komutları çalıştırırken remote add origin satırındaki depo adresini kendi adresinize göre düzenleyin.

```bash
git init
git add .
git commit -m "Add KentBildir complaint and suggestion system"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADI/kentbildir.git
git push -u origin main
```

ornek-ayarlar.env depoya dahildir. .gitignore kişisel .env dosyasını ve yerel veritabanını dışarıda bırakır. GitHub Pages yalnız statik dosya sunduğu için bu Node.js sunucusunu yerel kurulumla çalıştırın.

## Üçüncü taraf bileşenleri

Leaflet lisans bilgileri arayuz/kutuphaneler/leaflet/LICENSE.txt dosyasındadır. Harita altlıkları OpenStreetMap katkıcılarından gelir. Harita içindeki atıf bağlantısı görünür tutulur.
