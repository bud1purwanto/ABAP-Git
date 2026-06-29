# ABAP Git & Versioning - Deployment Guide

Panduan ini berisi langkah-langkah lengkap untuk menginstal dan menjalankan aplikasi **ABAP Git & Versioning** pada server Linux (misalnya Ubuntu/Debian) dari awal (*from scratch*), serta panduan untuk memperbarui aplikasi saat ada fitur baru dari GitHub.

---

## 1. Persiapan Server & Dependensi (Instalasi Awal)

Server Linux Anda harus memiliki dependensi berikut:
- **Python 3.8 - 3.12** (Untuk Backend FastAPI)
- **Node.js 18+ & npm** (Untuk Frontend Vite/React)
- **Git**
- **Compiler C++** (Untuk build `pyrfc` secara manual)

### Install Dependensi OS
Jalankan perintah berikut di terminal Linux Anda:
```bash
sudo apt update
sudo apt install build-essential python3-dev git curl unzip
```

### Install Node.js (via NodeSource)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Instalasi SAP NW RFC SDK (Sangat Krusial!)

Aplikasi ini wajib membutuhkan **SAP NetWeaver RFC SDK** agar library `pyrfc` pada Python bisa berkomunikasi dengan sistem SAP secara natif.

1. Unduh `nwrfc750X_X-xxxxxxx.zip` (Linux x86_64) dari **SAP Support Portal** menggunakan akun S-User Anda.
2. Pindahkan file tersebut ke server Linux Anda, lalu ekstrak ke `/usr/local/sap/nwrfcsdk`:
   ```bash
   sudo mkdir -p /usr/local/sap
   sudo unzip nwrfc750X_X-xxxxxxx.zip -d /usr/local/sap
   ```
3. Beritahu OS Linux letak *library* C++ milik SAP SDK agar bisa dibaca:
   ```bash
   echo "/usr/local/sap/nwrfcsdk/lib" | sudo tee /etc/ld.so.conf.d/nwrfcsdk.conf
   sudo ldconfig
   ```
4. Tambahkan *Environment Variable* (Sangat disarankan). Tambahkan baris ini ke `~/.bashrc`:
   ```bash
   echo "export SAPNWRFC_HOME=/usr/local/sap/nwrfcsdk" >> ~/.bashrc
   source ~/.bashrc
   ```

---

## 3. Kloning Proyek (Pertama Kali)

Pilih lokasi tempat aplikasi akan di-hosting (misal di Home Directory `~/` pengguna Anda):

```bash
# Buat folder
mkdir -p ~/abap-git
cd ~/abap-git

# Clone repositori dari GitHub (ganti dengan URL repo GitHub Anda)
git clone <URL_GITHUB_ANDA> .
```

---

## 4. Setup Backend (FastAPI)

1. Masuk ke folder backend dan buat Virtual Environment terisolasi:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```
2. **Upgrade Pip (PENTING)**. `pip` versi lama sering gagal menginstal paket yang menggunakan format `wheel` modern (penyebab utama gagal install `pyrfc`):
   ```bash
   pip install --upgrade pip setuptools wheel
   ```
3. Install semua dependensi Python:
   ```bash
   pip install -r requirements.txt
   ```
   *(Catatan: Jika `pyrfc` masih gagal, pastikan Anda menggunakan versi Python yang didukung (misal 3.10) dan langkah nomor 2 sudah dilakukan dengan benar).*

---

## 5. Setup Frontend (React / Vite)

1. Keluar dari folder backend, dan masuk ke frontend:
   ```bash
   cd ../frontend
   ```
2. Install dependensi Node.js:
   ```bash
   npm install
   ```
3. Build ke *production*:
   ```bash
   npm run build
   ```
   *(Proses ini akan menghasilkan folder `dist` yang memuat file HTML/JS/CSS statis dan sangat ringan).*

---

## 6. Menjalankan Aplikasi di Server secara Permanen

Untuk *production*, sangat disarankan menggunakan **PM2** (Node.js Process Manager) agar aplikasi Anda otomatis berjalan di latar belakang (background) dan langsung menyala otomatis ketika server linux di-*restart*.

### Install PM2
```bash
sudo npm install -g pm2
```

### Jalankan Backend (FastAPI)
Masuk ke folder `~/abap-git` dan jalankan:
```bash
pm2 start "cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000" --name "abap-backend"
```

### Jalankan Frontend (Serve statis)
Gunakan modul `serve` untuk menyajikan folder `dist`:
```bash
sudo npm install -g serve
pm2 start "serve -s frontend/dist -l 5173" --name "abap-frontend"
```

### Simpan Konfigurasi PM2 (Startup Otomatis)
```bash
pm2 save
pm2 startup
```
Lalu *copy-paste* perintah yang dimunculkan oleh `pm2 startup` di terminal Anda.

---
---

## 🔁 Panduan Update Aplikasi (Deployment Lanjutan)

Anda **TIDAK PERLU** melakukan `git clone` atau menginstal SAP SDK lagi ketika ada pembaharuan fitur dari GitHub. Ikuti 3 langkah cepat berikut di *server* Anda:

### 1. Tarik Perubahan Baru
```bash
cd ~/abap-git
git pull origin main
```

### 2. Update Backend (Jika ada library python baru & fitur baru)
```bash
source backend/venv/bin/activate
pip install -r backend/requirements.txt  # Opsional: Jika ada package Python baru
sudo systemctl restart abapgit-backend   # Restart service systemd backend
```

### 3. Update Frontend (Jika ada perubahan Tampilan UI/React)
```bash
cd frontend
npm install        # Opsional: Jika Anda menambah library Node baru
npm run build      # Wajib agar folder 'dist' diperbarui untuk dibaca oleh Nginx
```

Aplikasi Anda kini sudah selesai di-*update* dan langsung aktif!
