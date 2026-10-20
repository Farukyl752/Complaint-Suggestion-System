const API_URL = "http://127.0.0.1:8080/api/sikayet";

const mapContainer = document.getElementById("mapContainer");
const mapPin = document.getElementById("mapPin");
const regionInput = document.getElementById("regionInput");
const latInput = document.getElementById("latInput");
const lngInput = document.getElementById("lngInput");
const complaintInput = document.getElementById("complaintInput");
const complaintForm = document.getElementById("complaintForm");
const outputBox = document.getElementById("outputBox");
const outputJson = document.getElementById("outputJson");

let secilenKonum = null;

// 1. Haritaya Tıklanınca Bölge ve Koordinatı Al
mapContainer.addEventListener("click", (e) => {
  const rect = mapContainer.getBoundingClientRect();
  const xOran = (e.clientX - rect.left) / rect.width;
  const yOran = (e.clientY - rect.top) / rect.height;

  // Adana koordinat hesabı ve tıklanan bölgenin adı
  const lat = Number((37.06 - yOran * 0.1).toFixed(6));
  const lng = Number((35.25 + xOran * 0.15).toFixed(6));
  const bolgeAdi =
    e.target.getAttribute("data-bolge") ||
    (xOran < 0.55 ? "Seyhan / Merkez Cadde" : "Yüreğir / Merkez Cadde");

  secilenKonum = { bolge: `Adana - ${bolgeAdi}`, lat, lng };

  // Form kutularını doldur
  regionInput.value = secilenKonum.bolge;
  latInput.value = lat;
  lngInput.value = lng;

  // Harita üzerinde pini göster
  mapPin.style.left = `${xOran * 100}%`;
  mapPin.style.top = `${yOran * 100}%`;
  mapPin.textContent = `📍 ${secilenKonum.bolge}`;
  mapPin.classList.remove("hidden");
});

// 2. Konum ve Şikayeti Sunucuya Gönderen Callback Fonksiyonu
async function sikayetCallback(veri) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(veri),
  });
  return await res.json();
}

// 3. Form Gönderildiğinde Dosyaya Kaydet
complaintForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!secilenKonum) {
    alert("Lütfen önce haritadan bir bölgeye tıklayın!");
    return;
  }

  const veri = {
    bolge: secilenKonum.bolge,
    konum: { lat: secilenKonum.lat, lng: secilenKonum.lng },
    sikayet: complaintInput.value.trim(),
  };

  const sonuc = await sikayetCallback(veri);

  outputBox.classList.remove("hidden");
  outputJson.textContent = JSON.stringify(sonuc, null, 2);
  complaintInput.value = "";
});
