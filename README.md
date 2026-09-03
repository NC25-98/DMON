# Discord Channel Monitor

Dashboard web lokal untuk melihat/memantau pesan di semua channel teks server
Discord kamu, tanpa perlu buka aplikasi Discord. Menggunakan bot Discord
(sudah role Administrator) untuk mengambil data lewat Discord REST API.

⚠️ **Hanya untuk dipakai di server Discord milik/kelola sendiri**, dan hanya
diakses secara lokal (localhost/HP sendiri) — tidak ada sistem login karena
memang didesain untuk pemakaian pribadi, bukan untuk diekspos ke internet.

---

## 1. Siapkan Bot Discord

1. Buka https://discord.com/developers/applications → pilih aplikasi bot kamu
   (yang sudah di-invite ke server dengan role Administrator).
2. Masuk ke tab **Bot** (sidebar kiri).
3. Scroll ke bagian **Privileged Gateway Intents**, aktifkan:
   - ✅ **MESSAGE CONTENT INTENT** (wajib, tanpa ini isi pesan tidak akan terbaca)
4. Klik **Reset Token** (atau **Copy** jika masih tersimpan) untuk mendapatkan
   token bot. Simpan baik-baik, jangan dibagikan ke siapa pun.
5. Ambil **Server ID (Guild ID)**:
   - Di aplikasi Discord: Settings → Advanced → aktifkan **Developer Mode**.
   - Klik kanan nama server kamu → **Copy Server ID**.
6. **(Opsional, untuk fitur "siapa di voice channel")** Aktifkan Server Widget:
   - Di Discord: **Server Settings → Widget** → aktifkan **Enable Server Widget**.
   - Pilih **Server Invite Channel** — bebas pilih channel apa saja, ini cuma dipakai
     kalau ada orang klik "join" dari widget (kita tidak akan pakai fitur itu).
   - Tanpa langkah ini, panel "Sedang di Voice" akan menampilkan pesan
     "Widget belum aktif" dan fitur lain tetap jalan normal.

## 2. Install di Termux

```bash
# Update paket & install Node.js (jika belum ada)
pkg update && pkg upgrade
pkg install nodejs git

# Masuk ke folder project (setelah kamu pindahkan/extract project ini ke HP)
cd discord-dashboard

# Install dependency
npm install
```

## 3. Konfigurasi `.env`

```bash
cp .env.example .env
nano .env
```

Isi dengan token bot & guild ID yang sudah diambil tadi:

```
DISCORD_BOT_TOKEN=token_bot_kamu
DISCORD_GUILD_ID=id_server_kamu
PORT=3000
```

Simpan (`Ctrl+O`, Enter, lalu `Ctrl+X` untuk keluar dari nano).

## 4. Jalankan

```bash
npm start
```

Kalau berhasil, akan muncul:

```
==================================================
  Dashboard berjalan di: http://localhost:3000
  Buka alamat di atas lewat browser HP/PC kamu.
==================================================
```

Buka browser (Chrome/Firefox) di HP yang sama, lalu akses:

```
http://localhost:3000
```

## Fitur yang sudah dihandle

- Gambar/video/audio yang di-upload langsung (attachment) ditampilkan inline.
- Gambar dari link preview / embed (misal link YouTube, Twitter, artikel, dsb) ikut dirender.
- Tag `@user`, `@role`, `#channel`, dan `@everyone`/`@here` diterjemahkan jadi nama asli
  dan diberi highlight warna (bukan muncul mentah seperti `<@123456789>`).
- Pesan **Forward** (fitur "Teruskan Pesan" Discord) — kontennya diambil dari pesan asli
  yang diteruskan, bukan tampil kosong, dan diberi label "↪️ Pesan diteruskan".
- Reply/balasan menampilkan cuplikan pesan yang dibalas.
- Emoji custom server ditampilkan sebagai teks `:nama_emoji:` (gambar emoji custom tidak
  dirender karena butuh permission tambahan; ini batasan yang disengaja untuk kesederhanaan).
- **Poll/voting** (fitur native Discord Polls) ditampilkan sebagai kartu dengan progress bar
  tiap opsi, persentase, total suara, status berlangsung/selesai, dan opsi dengan suara
  terbanyak ditandai warna hijau. Tap sebuah opsi yang punya suara untuk melihat **daftar
  siapa saja yang memilih opsi tersebut** (nama & avatar).
- **Voice channel** (termasuk stage channel) ikut muncul di daftar channel dengan ikon 🔊/🎙️,
  dan bisa dibuka untuk melihat chat teks di dalamnya (fitur "Text in Voice").
- **Panel "Sedang di Voice"** di bagian atas sidebar menampilkan siapa saja yang sedang
  connect ke voice channel mana, lengkap dengan status mute/deafen. Perlu Server Widget
  diaktifkan dulu (lihat langkah instalasi poin 6).
- **Kolom pencarian channel** di sidebar untuk mempermudah kalau server punya banyak sekali
  channel — daftar channel sendiri tidak pernah terpotong/kena limit, Discord API selalu
  mengembalikan semua channel sekaligus.

## 5. Pemakaian

- Tap ikon ☰ di kiri atas (mobile) untuk membuka daftar channel.
- Tap salah satu channel untuk melihat 50 pesan terakhir.
- Tombol **Refresh** di kanan atas untuk memuat ulang pesan terbaru
  (tidak ada auto-update/real-time, sesuai permintaan — hemat baterai & data).
- Tombol **Muat pesan lebih lama** di atas daftar pesan untuk melihat riwayat
  yang lebih lama (pagination).

## Menjalankan tetap hidup di background (opsional)

Kalau mau Termux tetap jalan walau layar HP dikunci/ganti aplikasi:

```bash
pkg install termux-api   # opsional, agar termux dapat wake-lock
termux-wake-lock
npm start
```

Atau jalankan dengan `nohup` supaya tetap hidup walau sesi Termux ditutup:

```bash
nohup npm start > monitor.log 2>&1 &
```

## Troubleshooting

| Gejala | Penyebab kemungkinan |
|---|---|
| Error 401 saat load channel | Token bot salah/expired → reset token lagi di Developer Portal |
| Error 403 | Message Content Intent belum diaktifkan, atau bot tidak punya akses ke channel tsb |
| Error 404 | GUILD_ID salah, atau bot belum di-invite ke server tsb |
| Channel list kosong | Bot mungkin hanya punya akses ke sebagian channel (cek permission channel) |
| Pesan lampiran gambar tidak muncul | Link CDN Discord kadaluarsa/butuh koneksi internet aktif di HP |

## Struktur Project

```
discord-dashboard/
├── server.js              # Express server + routing API
├── src/discordApi.js      # Fungsi ambil channel & pesan dari Discord API
├── public/
│   ├── index.html         # Struktur halaman
│   ├── style.css          # Tampilan dark mode, responsive
│   └── app.js             # Logic frontend (fetch, render, dsb)
├── .env.example            # Template variabel environment
└── package.json
```
