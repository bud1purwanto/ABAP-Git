# ABAP Git & Versioning - Deployment Guide

Panduan ini berisi langkah-langkah lengkap untuk menginstal dan menjalankan aplikasi **ABAP Git & Versioning** pada server Linux (misalnya Ubuntu/Debian) dari awal (*from scratch*), serta panduan untuk memperbarui aplikasi saat ada fitur baru dari GitHub.

---

## 1. Persiapan Server & Dependensi (Instalasi Awal)

Server Linux Anda harus memiliki dependensi berikut:
- **Python 3.12** (Sangat direkomendasikan untuk Backend FastAPI)
- **Node.js 18+ & npm** (Untuk Frontend Vite/React)
- **Git**
- **Compiler C++** (Untuk build `pyrfc` secara manual)

### Install Dependensi OS
Jalankan perintah berikut di terminal Linux Anda:
```bash
sudo apt update
sudo apt install build-essential python3.12-dev python3.12-venv git curl unzip wget
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
3. Beritahu OS Linux letak *library* C++ milik SAP SDK agar bisa dibaca secara global:
   ```bash
   echo "/usr/local/sap/nwrfcsdk/lib" | sudo tee /etc/ld.so.conf.d/nwrfcsdk.conf
   sudo ldconfig
   ```

---

## 3. Kloning Proyek (Pertama Kali)

Pilih lokasi tempat aplikasi akan di-hosting (misal di `/var/www/`):

```bash
sudo mkdir -p /var/www/ABAP-Git
sudo chown -R $USER:$USER /var/www/ABAP-Git
cd /var/www/ABAP-Git

# Clone repositori dari GitHub (ganti dengan URL repo GitHub Anda)
git clone <URL_GITHUB_ANDA> .
```

---

## 4. Setup Backend (FastAPI)

1. Masuk ke folder backend dan buat Virtual Environment terisolasi:
   ```bash
   cd backend
   python3.12 -m venv venv
   source venv/bin/activate
   ```
2. **Upgrade Pip (PENTING)**. `pip` versi lama sering gagal menginstal paket yang menggunakan format `wheel` modern:
   ```bash
   pip install --upgrade pip setuptools wheel
   ```
3. Install semua dependensi Python:
   ```bash
   pip install -r requirements.txt
   ```

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
   *(Proses ini akan menghasilkan folder `dist` yang memuat file HTML/JS/CSS statis).*

---

## 6. Menjalankan Aplikasi di Server secara Permanen (Systemd)

Untuk menjaga *backend* tetap menyala dan otomatis *restart* saat server Linux di-*reboot*, kita gunakan **systemd**.

1. Buat file service:
   ```bash
   sudo nano /etc/systemd/system/abapgit-backend.service
   ```
2. Isi dengan konfigurasi berikut (sesuaikan `User` dan `WorkingDirectory`):
   ```ini
   [Unit]
   Description=ABAP Git FastAPI Backend
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/var/www/ABAP-Git/backend
   ExecStart=/var/www/ABAP-Git/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
3. Aktifkan dan jalankan service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable abapgit-backend
   sudo systemctl start abapgit-backend
   ```

---
---

## 🔁 Panduan Update Aplikasi (Deployment Lanjutan)

Ketika ada pembaharuan fitur dari GitHub, ikuti 3 langkah cepat berikut di *server* Anda:

### 1. Tarik Perubahan Baru
```bash
cd /var/www/ABAP-Git
git pull origin main
```

### 2. Update Backend (Jika ada library python baru & fitur baru)
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt  # Opsional: Jika ada package Python baru
sudo systemctl restart abapgit-backend   # Restart service systemd backend
```

### 3. Update Frontend (Jika ada perubahan Tampilan UI/React)
```bash
cd ../frontend
npm install        # Opsional: Jika Anda menambah library Node baru
npm run build      # Wajib agar folder 'dist' diperbarui untuk dibaca oleh Nginx
```

---
---

## ⚠️ Troubleshooting & Masalah Umum

### 1. `pyrfc` Gagal Diinstal (No matching distribution found)
**Gejala:** Saat menjalankan `pip install -r requirements.txt`, muncul error `ERROR: Could not find a version that satisfies the requirement pyrfc`.
**Penyebab:** Repositori PyPI memblokir beberapa versi PyRFC untuk OS tertentu.
**Solusi Bypass:** Download *wheel* aslinya langsung dari GitHub SAP dan instal manual:
```bash
# Pastikan Anda berada di dalam venv
wget https://github.com/SAP/PyRFC/releases/download/3.3.1/pyrfc-3.3.1-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl
pip install pyrfc-3.3.1-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl
```

### 2. Error Saat Import PyRFC: `libsapucum.so: cannot open shared object file`
**Gejala:** Saat Anda mencoba menjalankan backend, muncul error C++ library tidak ditemukan.
**Penyebab:** OS Linux belum mendaftarkan *path* ke file SDK SAP (walaupun file-nya ada).
**Solusi:** Jalankan ulang *ldconfig* untuk memaksanya membaca path `/usr/local/sap/nwrfcsdk/lib`:
```bash
echo "/usr/local/sap/nwrfcsdk/lib" | sudo tee /etc/ld.so.conf.d/nwrfcsdk.conf
sudo ldconfig
# Lalu restart backend
sudo systemctl restart abapgit-backend
```

### 3. Perintah `pm2` Not Found
**Gejala:** Error `Command 'pm2' not found` saat mencoba me-restart backend.
**Penyebab:** Jika Anda menggunakan `systemd` (seperti di panduan nomor 6), maka PM2 tidak digunakan.
**Solusi:** Selalu gunakan `sudo systemctl restart abapgit-backend`.
