# Panduan Setup CI/CD (GitHub Actions - Self Hosted)

Karena server Linux Anda berada di jaringan lokal (tidak memiliki IP Publik atau Domain), kita tidak bisa menggunakan SSH dari luar (GitHub). 

Sebagai solusinya, kita menggunakan metode **Self-Hosted Runner**. Artinya, kita akan menginstal sebuah "agen robot" kecil dari GitHub secara langsung ke dalam server Linux Anda. Agen inilah yang akan *standby* dan menarik (*pull*) perintah dari GitHub setiap kali ada kode baru.

File `.github/workflows/deploy.yml` pada proyek Anda sudah saya sesuaikan untuk membaca *runner* lokal ini (perhatikan tulisan `runs-on: self-hosted`).

---

## Langkah-langkah Memasang Self-Hosted Runner di Server Linux

**Perhatian:** Jalankan perintah-perintah di bawah ini di dalam terminal server Linux Anda (sebaiknya jangan jalankan menggunakan user `root`, melainkan user biasa seperti `ubuntu` atau `abap`). Jika Anda *login* sebagai root, Anda mungkin perlu membuat user baru atau menambahkan parameter `--allow-runasroot`.

### 1. Dapatkan Token dan Perintah Instalasi dari GitHub
1. Buka repositori GitHub Anda di web browser.
2. Klik tab **Settings** (Pengaturan).
3. Di menu sebelah kiri bawah, cari bagian **Actions** lalu klik dropdown **Runners**.
4. Klik tombol warna hijau **New self-hosted runner**.
5. Pilih sistem operasi **Linux** dan arsitektur **x64**.

Di halaman tersebut, GitHub akan memberikan urutan perintah *copy-paste* (*Download* dan *Configure*). Silakan jalankan perintah-perintah tersebut secara berurutan di terminal Linux Anda. Biasanya terlihat seperti ini:

```bash
# 1. Buat folder dan masuk ke dalamnya
mkdir actions-runner && cd actions-runner

# 2. Download paket installer (Tautan di bawah ini hanya contoh, ikuti yang ada di web GitHub Anda)
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/...

# 3. Ekstrak file
tar xzf ./actions-runner-linux-x64.tar.gz

# 4. Konfigurasi (Ikuti tautan token persis yang ada di web GitHub Anda)
./config.sh --url https://github.com/USERNAME/ABAP-Git-Repository --token ABCDEFG123456...
```
*(Saat proses `./config.sh`, Anda cukup menekan tombol Enter terus menerus untuk menyetujui semua nama default yang ditawarkan).*

### 2. Jalankan Runner Secara Permanen (sebagai Service)
Jika langkah ke-4 di atas sudah berhasil terhubung, jalankan perintah berikut di dalam folder `actions-runner` tersebut agar robot GitHub selalu menyala (*standby*) meski server di-restart:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

### 3. Selesai! Saatnya Mengetes
1. Pastikan status runner Anda di menu **Settings -> Actions -> Runners** di web GitHub bertanda hijau (*Idle*).
2. Lakukan **Git Commit** file `.github/workflows/deploy.yml` dan `CI_CD.md` yang baru ini, lalu jalankan `git push` ke GitHub (branch `main`).
3. Buka tab **Actions** di repositori GitHub Anda.
4. Anda akan melihat bahwa *deploy* berjalan dan berhasil mengeksekusi perintah *pull* dan *build* langsung dari dalam server Linux Anda tanpa perlu *Public IP*!
