# KentBildir · Adana Harita Tabanlı Şikâyet ve Öneri Sistemi

Engineering Design · Proje 22 · Complaint/Suggestion System

Vatandaşların kurum veya belediyelere **şikâyet ve öneri** iletip, **takip numarasıyla (`KB-...`)** durumlarını sorgulayabildiği platform. Başvurular **Adana Bölge Haritası** üzerinden coğrafi konum işaretlenerek eklenir, kategorilerine göre **ilgili departmanlara otomatik yönlendirilir** ve **LLM API (Google Gemini / OpenAI)** ile şikâyet metinlerinin **öncelik skoru (0–100)** analiz edilerek sıralanır.

---

## Proje Dosya Yapısı

```text
├── index.html              # Birleşik arayüz (Başvuru Oluştur + Takip + Personel Paneli)
├── style.css               # Arayüz ve harita tasarımı
├── app.js                  # Harita tıklama callback'leri (sikayetCallback), takip ve personel ekranı
├── server.py               # Ana HTTP sunucusu, SQLite (data/kent.db) + JSON (sikayetler.json) kayıt ve API uçları
├── basvuru-kurallari.js    # Departman yönlendirme kuralları, veri doğrulama ve önceliklendirme
├── complaint_ordering.js   # Google Gemini LLM öncelik analizi, toplu sıralama ve ortak yerel puanlama
├── ornek-ayarlar.env       # Örnek ortam değişkenleri şablonu
└── sikayetler.json         # Kaydedilen başvuruların otomatik senkronize edilen JSON çıktısı
```

---

## Kurulum ve Çalıştırma

1. Ayar dosyasını oluşturun (isteğe bağlı olarak içine `GEMINI_API_KEY`, `OPENAI_API_KEY` veya `ADMIN_PASSWORD` ekleyin):
   ```powershell
   Copy-Item ornek-ayarlar.env .env
   ```
2. Sunucuyu başlatın:
   ```powershell
   py -B server.py
   ```
3. Tarayıcıda açın:
   * **[http://localhost:3000](http://localhost:3000)**
   * **Başvuru Oluştur (`#basvuru`):** Haritadan bölgeye tıklayın (bölge adı ve `readonly` enlem/boylam otomatik dolar), kategori ve açıklamayı girip gönderin.
   * **Başvuru Takibi (`#takip`):** Verilen `KB-...` takip numarasıyla başvurunun atandığı departmanı, öncelik puanını ve durum geçmişini sorgulayın.
   * **Personel Paneli (`#personel`):** Parola ile giriş yaparak başvuruları öncelik sırasına göre inceleyin, **"✨ AI ile Sırala"** ile yeniden sıralayın veya işlem durumunu (`Alındı → İnceleniyor → İşlemde → Sonuçlandı`) ilerletin.
