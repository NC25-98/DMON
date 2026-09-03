require('dotenv').config();
const express = require('express');
const path = require('path');
const { getChannels, getMessages, getPollVoters } = require('./src/discordApi');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Daftar channel (dikelompokkan per kategori)
app.get('/api/channels', async (req, res) => {
  try {
    const channels = await getChannels();
    res.json(channels);
  } catch (err) {
    handleDiscordError(res, err, 'Gagal mengambil daftar channel');
  }
});

// Pesan dalam sebuah channel
app.get('/api/channels/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { before, limit } = req.query;
    const messages = await getMessages(id, { before, limit });
    res.json(messages);
  } catch (err) {
    handleDiscordError(res, err, 'Gagal mengambil pesan');
  }
});

// Daftar pemilih untuk satu opsi poll
app.get('/api/channels/:channelId/messages/:messageId/poll-voters/:answerId', async (req, res) => {
  try {
    const { channelId, messageId, answerId } = req.params;
    const voters = await getPollVoters(channelId, messageId, answerId);
    res.json(voters);
  } catch (err) {
    handleDiscordError(res, err, 'Gagal mengambil daftar pemilih');
  }
});

function handleDiscordError(res, err, fallbackMessage) {
  const status = err.response?.status || 500;
  const discordMessage = err.response?.data?.message;

  console.error(fallbackMessage, '-', err.response?.data || err.message);

  let hint = '';
  if (status === 401) hint = 'Token bot salah atau tidak valid. Cek DISCORD_BOT_TOKEN di .env.';
  if (status === 403) hint = 'Bot tidak punya izin akses channel ini, atau Message Content Intent belum diaktifkan di Developer Portal.';
  if (status === 404) hint = 'Server/channel tidak ditemukan. Cek DISCORD_GUILD_ID di .env, atau pastikan bot sudah di-invite ke server.';

  res.status(status).json({
    error: fallbackMessage,
    detail: discordMessage || err.message,
    hint,
  });
}

app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`  Dashboard berjalan di: http://localhost:${PORT}`);
  console.log('  Buka alamat di atas lewat browser HP/PC kamu.');
  console.log('==================================================');
});
