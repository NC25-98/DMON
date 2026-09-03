const axios = require('axios');

const API_BASE = 'https://discord.com/api/v10';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || TOKEN === 'isi_token_bot_disini') {
  console.warn('[PERINGATAN] DISCORD_BOT_TOKEN belum diisi di file .env');
}
if (!GUILD_ID || GUILD_ID === 'isi_guild_id_disini') {
  console.warn('[PERINGATAN] DISCORD_GUILD_ID belum diisi di file .env');
}

const discord = axios.create({
  baseURL: API_BASE,
  headers: {
    Authorization: `Bot ${TOKEN}`,
  },
  timeout: 15000,
});

// Cache ringan untuk role & channel (dipakai buat resolve tag @role, #channel)
const CACHE_TTL = 5 * 60 * 1000; // 5 menit
let rolesCache = { data: null, ts: 0 };
let channelNameCache = { data: null, ts: 0 };

async function getRolesMap() {
  const now = Date.now();
  if (rolesCache.data && now - rolesCache.ts < CACHE_TTL) return rolesCache.data;
  const { data } = await discord.get(`/guilds/${GUILD_ID}/roles`);
  const map = {};
  data.forEach((r) => { map[r.id] = { name: r.name, color: r.color }; });
  rolesCache = { data: map, ts: now };
  return map;
}

async function getChannelNameMap() {
  const now = Date.now();
  if (channelNameCache.data && now - channelNameCache.ts < CACHE_TTL) return channelNameCache.data;
  const { data } = await discord.get(`/guilds/${GUILD_ID}/channels`);
  const map = {};
  data.forEach((c) => { map[c.id] = c.name; });
  channelNameCache = { data: map, ts: now };
  return map;
}

// Tipe channel Discord yang relevan untuk ditampilkan
// 0=text, 5=announcement, 15=forum, 2=voice, 13=stage
const MESSAGEABLE_TYPES = [0, 5, 15, 2, 13];
const CATEGORY_TYPE = 4;

const TYPE_LABEL = {
  0: 'text',
  5: 'announcement',
  15: 'forum',
  2: 'voice',
  13: 'stage',
};

function mapChannel(c) {
  return {
    id: c.id,
    name: c.name,
    type: TYPE_LABEL[c.type] || 'text',
    topic: c.topic || null,
  };
}

/**
 * Ambil semua channel (teks, forum, voice, stage) di server, dikelompokkan per kategori.
 */
async function getChannels() {
  const { data } = await discord.get(`/guilds/${GUILD_ID}/channels`);

  const categories = data
    .filter((c) => c.type === CATEGORY_TYPE)
    .sort((a, b) => a.position - b.position);

  const messageable = data
    .filter((c) => MESSAGEABLE_TYPES.includes(c.type))
    .sort((a, b) => a.position - b.position);

  const groups = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    channels: messageable
      .filter((c) => c.parent_id === cat.id)
      .map(mapChannel),
  })).filter((g) => g.channels.length > 0);

  const uncategorized = messageable
    .filter((c) => !c.parent_id)
    .map(mapChannel);

  if (uncategorized.length) {
    groups.unshift({ id: 'uncategorized', name: 'Tanpa Kategori', channels: uncategorized });
  }

  return groups;
}

function resolveAvatar(author) {
  if (author.avatar) {
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=80`;
  }
  // Fallback avatar default Discord
  const idx = author.discriminator && author.discriminator !== '0'
    ? Number(author.discriminator) % 5
    : Number((BigInt(author.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Ubah konten pesan mentah jadi HTML aman: escape dulu, baru sisipkan
 * markup terpercaya untuk tag @user, @role, #channel, @everyone/@here, dan link.
 */
function buildContentHtml(rawContent, msgLike, rolesMap, channelNameMap) {
  let html = escapeHtml(rawContent || '');

  const userMap = {};
  (msgLike.mentions || []).forEach((u) => {
    userMap[u.id] = u.global_name || u.username;
  });

  // <@123> atau <@!123> -> tag user
  html = html.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
    const name = userMap[id];
    return `<span class="mention">@${escapeHtml(name || 'pengguna')}</span>`;
  });

  // <@&123> -> tag role  (ingat: & di dalamnya sudah jadi &amp; setelah escape)
  html = html.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => {
    const role = rolesMap[id];
    return `<span class="mention mention-role">@${escapeHtml(role ? role.name : 'role')}</span>`;
  });

  // <#123> -> tag channel
  html = html.replace(/&lt;#(\d+)&gt;/g, (_, id) => {
    const name = channelNameMap[id];
    return `<span class="mention mention-channel">#${escapeHtml(name || 'channel')}</span>`;
  });

  // @everyone / @here (hanya di-highlight kalau memang benar-benar ping semua)
  if (msgLike.mention_everyone) {
    html = html.replace(/@everyone|@here/g, (m) => `<span class="mention mention-everyone">${m}</span>`);
  }

  // Custom emoji <:name:id> / <a:name:id> -> tampilkan sebagai teks :name:
  html = html.replace(/&lt;a?:(\w+):(\d+)&gt;/g, (_, name) => `<span class="custom-emoji">:${escapeHtml(name)}:</span>`);

  // Linkify URL biasa
  html = html.replace(/(https?:\/\/[^\s&<]+)/g, (url) => `<a href="${url}" target="_blank" rel="noopener" class="msg-link">${url}</a>`);

  return html;
}

function mapAttachment(a) {
  return {
    id: a.id,
    url: a.url,
    filename: a.filename,
    contentType: a.content_type || '',
    size: a.size,
    width: a.width || null,
    height: a.height || null,
  };
}

function mapEmbed(e) {
  return {
    title: e.title || null,
    description: e.description ? e.description.slice(0, 300) : null,
    url: e.url || null,
    color: typeof e.color === 'number' ? `#${e.color.toString(16).padStart(6, '0')}` : null,
    image: e.image?.url || e.thumbnail?.url || null,
    siteName: e.provider?.name || e.author?.name || null,
  };
}

function mapPoll(poll) {
  if (!poll) return null;

  const counts = {};
  (poll.results?.answer_counts || []).forEach((c) => { counts[c.answer_id] = c.count; });

  const totalVotes = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const answers = (poll.answers || []).map((a) => {
    const count = counts[a.answer_id] || 0;
    return {
      id: a.answer_id,
      text: a.poll_media?.text || '',
      emoji: a.poll_media?.emoji?.name || null,
      count,
      percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
    };
  });

  const expiresAt = poll.expiry || null;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

  return {
    question: poll.question?.text || '',
    answers,
    totalVotes,
    multiselect: !!poll.allow_multiselect,
    expiresAt,
    finalized: !!poll.results?.is_finalized || isExpired,
  };
}

function mapMessage(m, rolesMap, channelNameMap) {
  // Deteksi pesan hasil "Forward" (bukan reply biasa) -> isi asli ada di message_snapshots
  const isForward = m.message_reference
    && m.message_reference.type === 1
    && Array.isArray(m.message_snapshots)
    && m.message_snapshots.length > 0;

  const source = isForward ? m.message_snapshots[0].message : m;

  return {
    id: m.id,
    contentHtml: buildContentHtml(source.content, { ...source, mentions: source.mentions || m.mentions, mention_everyone: source.mention_everyone }, rolesMap, channelNameMap),
    hasContent: !!(source.content && source.content.trim().length),
    timestamp: m.timestamp,
    edited: !!m.edited_timestamp,
    author: {
      id: m.author.id,
      name: m.author.global_name || m.author.username,
      tag: m.author.discriminator && m.author.discriminator !== '0'
        ? `${m.author.username}#${m.author.discriminator}`
        : `@${m.author.username}`,
      avatar: resolveAvatar(m.author),
      bot: !!m.author.bot,
    },
    attachments: (source.attachments || []).map(mapAttachment),
    embeds: (source.embeds || []).map(mapEmbed).filter((e) => e.image || e.title || e.description),
    poll: mapPoll(source.poll),
    stickerCount: (source.sticker_items || []).length,
    isForward,
    replyTo: (!isForward && m.referenced_message)
      ? {
        author: m.referenced_message.author?.global_name || m.referenced_message.author?.username || 'Unknown',
        content: (m.referenced_message.content || '[Lampiran/Embed]').slice(0, 120),
      }
      : (!isForward && m.message_reference ? { author: null, content: '[Pesan asli tidak tersedia]' } : null),
  };
}

/**
 * Ambil pesan dari sebuah channel.
 * @param {string} channelId
 * @param {{before?: string, limit?: number}} opts
 */
async function getMessages(channelId, opts = {}) {
  const params = { limit: opts.limit ? Math.min(Number(opts.limit), 100) : 50 };
  if (opts.before) params.before = opts.before;

  const [{ data }, rolesMap, channelNameMap] = await Promise.all([
    discord.get(`/channels/${channelId}/messages`, { params }),
    getRolesMap(),
    getChannelNameMap(),
  ]);

  await enrichMissingPollResults(channelId, data);

  // Discord mengembalikan pesan terbaru dulu -> balik urutan jadi lama -> baru
  return data.map((m) => mapMessage(m, rolesMap, channelNameMap)).reverse();
}

/**
 * BUG FIX: endpoint list pesan (GET /channels/:id/messages) sering TIDAK
 * menyertakan field "poll.results" sama sekali — ini bukan berarti 0 suara,
 * tapi memang belum dihitung/disertakan oleh Discord di endpoint bulk ini
 * (lihat dokumentasi resmi Poll Resource: "results field may be not present
 * in certain responses... should be treated as 'unknown results', as
 * opposed to 'no results'"). Makanya vote selalu tampil 0/kosong di dashboard.
 *
 * Solusinya: untuk tiap pesan yang punya poll tapi "results"-nya kosong,
 * fetch ulang pesan itu satu-satu lewat GET /channels/:id/messages/:messageId
 * — endpoint ini SELALU menyertakan hasil vote yang akurat.
 */
// Pesan forward menyimpan konten aslinya (termasuk poll) di message_snapshots[0].message
function getPollHolder(m) {
  if (m.message_reference?.type === 1 && m.message_snapshots?.[0]?.message) {
    return m.message_snapshots[0].message;
  }
  return m;
}

async function enrichMissingPollResults(channelId, messages) {
  const needsFetch = messages
    .map((m) => ({ m, holder: getPollHolder(m) }))
    .filter(({ holder }) => holder.poll && !holder.poll.results);
  if (!needsFetch.length) return;

  const fetched = await Promise.all(
    needsFetch.map(({ m }) =>
      discord.get(`/channels/${channelId}/messages/${m.id}`)
        .then((res) => res.data)
        .catch(() => null) // kalau satu gagal, jangan gagalkan semuanya
    )
  );

  fetched.forEach((full, i) => {
    if (!full) return;
    const freshHolder = getPollHolder(full);
    if (freshHolder.poll) {
      needsFetch[i].holder.poll = freshHolder.poll;
    }
  });
}

/**
 * Ambil daftar user yang vote pada satu opsi poll tertentu.
 */
async function getPollVoters(channelId, messageId, answerId) {
  const { data } = await discord.get(`/channels/${channelId}/polls/${messageId}/answers/${answerId}`, {
    params: { limit: 100 },
  });
  return (data.users || []).map((u) => ({
    id: u.id,
    name: u.global_name || u.username,
    tag: u.discriminator && u.discriminator !== '0' ? `${u.username}#${u.discriminator}` : `@${u.username}`,
    avatar: resolveAvatar(u),
    bot: !!u.bot,
  }));
}

module.exports = { getChannels, getMessages, getPollVoters };
