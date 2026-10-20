import json
import os
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8080
DOSYA_ADI = "sikayetler.json"


class SikayetSunucusu(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/sikayet":
            self.send_error(404)
            return

        # 1. Gelen JSON verisini oku
        uzunluk = int(self.headers.get("Content-Length", 0))
        gelen_veri = json.loads(self.rfile.read(uzunluk).decode("utf-8"))
        gelen_veri["tarih"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 2. Mevcut sikayetler.json dosyasını oku ve yeni şikayeti ekle
        kayitlar = []
        if os.path.exists(DOSYA_ADI):
            with open(DOSYA_ADI, "r", encoding="utf-8") as f:
                kayitlar = json.load(f)

        kayitlar.append(gelen_veri)

        with open(DOSYA_ADI, "w", encoding="utf-8") as f:
            json.dump(kayitlar, f, ensure_ascii=False, indent=2)

        # 3. Başarılı yanıt döndür
        yanit = json.dumps(gelen_veri, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(yanit)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


if __name__ == "__main__":
    print(f"Sunucu aktif: http://localhost:{PORT}", flush=True)
    ThreadingHTTPServer(("", PORT), SikayetSunucusu).serve_forever()
