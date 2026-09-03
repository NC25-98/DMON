const channelListEl = document.getElementById('channelList');
const messagesEl = document.getElementById('messages');
const channelNameEl = document.getElementById('channelName');
const channelIconEl = document.getElementById('channelIcon');
const refreshBtn = document.getElementById('refreshBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');

const CHANNEL_ICONS = { text: '#', announcement: '📢', forum: '💬', voice: '🔊', stage: '🎙️' };

let currentChannel = null; // { id, name }
let currentMessages = [];  // urut lama -> baru
let loadingMore = false;

// ---------- Sidebar drawer (mobile) ----------
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
}
function closeSidebarFn() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}
menuToggle.addEventListener('click', openSidebar);
closeSidebar.addEventListener('click', closeSidebarFn);
sidebarOverlay.addEventListener('click', closeSidebarFn);

// ---------- Load channel list ----------
async function loadChannels() {
  channelListEl.innerHTML = '<div class="state-msg">Memuat channel…</div>';
  try {
    const res = await fetch('/api/channels');
    const data = await res.json();
    if (!res.ok) throw data;
    renderChannelList(data);
  } catch (err) {
    channelListEl.innerHTML = `<div class="state-msg error">
      Gagal memuat channel.<br>${escapeHtml(err.detail || err.error || 'Cek koneksi/konfigurasi .env')}
      ${err.hint ? `<br><small>${escapeHtml(err.hint)}</small>` : ''}
    </div>`;
  }
}

function renderChannelList(groups) {
  if (!groups.length) {
    channelListEl.innerHTML = '<div class="state-msg">Tidak ada channel teks ditemukan.</div>';
    return;
  }
  channelListEl.innerHTML = '';
  groups.forEach((group) => {
    const catDiv = document.createElement('div');
    catDiv.className = 'category';

    const label = document.createElement('div');
    label.className = 'category-label';
    label.innerHTML = `<span class="arrow">▾</span><span>${escapeHtml(group.name)}</span>`;
    label.addEventListener('click', () => catDiv.classList.toggle('collapsed'));

    const list = document.createElement('div');
    list.className = 'category-channels';

    group.channels.forEach((ch) => {
      const item = document.createElement('div');
      item.className = 'channel-item';
      item.dataset.id = ch.id;
      item.dataset.name = ch.name.toLowerCase();
      const icon = CHANNEL_ICONS[ch.type] || '#';
      item.innerHTML = `<span class="hash">${icon}</span><span>${escapeHtml(ch.name)}</span>`;
      item.addEventListener('click', () => selectChannel(ch));
      list.appendChild(item);
    });

    catDiv.appendChild(label);
    catDiv.appendChild(list);
    channelListEl.appendChild(catDiv);
  });
}

// ---------- Select channel ----------
async function selectChannel(ch) {
  currentChannel = ch;
  channelNameEl.textContent = ch.name;
  channelIconEl.textContent = CHANNEL_ICONS[ch.type] || '#';
  refreshBtn.disabled = false;

  document.querySelectorAll('.channel-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === ch.id);
  });

  closeSidebarFn();
  await fetchLatestMessages();
}

// ---------- Fetch messages ----------
async function fetchLatestMessages() {
  if (!currentChannel) return;
  setRefreshing(true);
  messagesEl.innerHTML = '<div class="state-msg">Memuat pesan…</div>';
  loadMoreBtn.classList.add('hidden');

  try {
    const res = await fetch(`/api/channels/${currentChannel.id}/messages?limit=50`);
    const data = await res.json();
    if (!res.ok) throw data;
    currentMessages = data;
    renderMessages(currentMessages, { scrollToBottom: true });
    loadMoreBtn.classList.toggle('hidden', data.length < 50);
  } catch (err) {
    messagesEl.innerHTML = `<div class="state-msg error">
      Gagal memuat pesan.<br>${escapeHtml(err.detail || err.error || 'Terjadi kesalahan')}
      ${err.hint ? `<br><small>${escapeHtml(err.hint)}</small>` : ''}
    </div>`;
  } finally {
    setRefreshing(false);
  }
}

async function loadOlderMessages() {
  if (!currentChannel || !currentMessages.length || loadingMore) return;
  loadingMore = true;
  loadMoreBtn.textContent = 'Memuat…';

  const oldestId = currentMessages[0].id;
  const prevHeight = messagesEl.scrollHeight;

  try {
    const res = await fetch(`/api/channels/${currentChannel.id}/messages?limit=50&before=${oldestId}`);
    const data = await res.json();
    if (!res.ok) throw data;

    currentMessages = [...data, ...currentMessages];
    renderMessages(currentMessages, { scrollToBottom: false });

    // Pertahankan posisi scroll setelah pesan lama ditambahkan di atas
    messagesEl.scrollTop = messagesEl.scrollHeight - prevHeight;
    loadMoreBtn.classList.toggle('hidden', data.length < 50);
  } catch (err) {
    alert('Gagal memuat pesan lama: ' + (err.detail || err.error || 'Terjadi kesalahan'));
  } finally {
    loadingMore = false;
    loadMoreBtn.textContent = 'Muat pesan lebih lama';
  }
}

function setRefreshing(isLoading) {
  refreshBtn.classList.toggle('spinning', isLoading);
  refreshBtn.disabled = isLoading;
}

// ---------- Render messages ----------
function renderMessages(messages, { scrollToBottom }) {
  if (!messages.length) {
    messagesEl.innerHTML = '<div class="state-msg">Belum ada pesan di channel ini.</div>';
    return;
  }

  messagesEl.innerHTML = '';
  let lastDay = null;

  messages.forEach((m) => {
    const day = new Date(m.timestamp).toDateString();
    if (day !== lastDay) {
      const divider = document.createElement('div');
      divider.className = 'day-divider';
      divider.textContent = formatDay(m.timestamp);
      messagesEl.appendChild(divider);
      lastDay = day;
    }
    messagesEl.appendChild(renderMessage(m));
  });

  if (scrollToBottom) {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }
}

function renderMessage(m) {
  const wrap = document.createElement('div');
  wrap.className = 'msg';

  const img = document.createElement('img');
  img.className = 'msg-avatar';
  img.src = m.author.avatar;
  img.alt = m.author.name;
  img.loading = 'lazy';

  const body = document.createElement('div');
  body.className = 'msg-body';

  let replyHtml = '';
  if (m.replyTo) {
    replyHtml = `<div class="msg-reply">↩ <span class="reply-author">${escapeHtml(m.replyTo.author || 'Unknown')}</span> ${escapeHtml(m.replyTo.content)}</div>`;
  }

  const forwardHtml = m.isForward
    ? `<div class="msg-forward-badge">↪️ Pesan diteruskan (forward)</div>`
    : '';

  let extraHtml = '';
  if (m.stickerCount) extraHtml += `<span class="extra-badge">🏷️ stiker</span>`;

  const attachmentsHtml = renderAttachments(m.attachments);
  const embedsHtml = renderEmbeds(m.embeds);
  const pollHtml = renderPoll(m.poll, m.id);

  const noVisibleContent = !m.hasContent && !m.attachments.length && !m.embeds.length && !m.stickerCount && !m.poll;

  body.innerHTML = `
    ${forwardHtml}
    ${replyHtml}
    <div class="msg-header">
      <span class="msg-author${m.author.bot ? ' bot' : ''}" title="${escapeHtml(m.author.tag)}">${escapeHtml(m.author.name)}</span>
      <span class="msg-time">${formatTime(m.timestamp)}</span>
      ${m.edited ? '<span class="msg-edited">(diedit)</span>' : ''}
    </div>
    ${m.hasContent ? `<div class="msg-content">${m.contentHtml}</div>` : (noVisibleContent ? '<div class="msg-content empty-content">[tanpa teks]</div>' : '')}
    ${attachmentsHtml}
    ${embedsHtml}
    ${pollHtml}
    ${extraHtml ? `<div>${extraHtml}</div>` : ''}
  `;

  wrap.appendChild(img);
  wrap.appendChild(body);
  return wrap;
}

function renderPoll(poll, messageId) {
  if (!poll) return '';

  const statusHtml = poll.finalized
    ? '<span class="poll-status ended">Voting selesai</span>'
    : (poll.expiresAt
      ? `<span class="poll-status active">Berakhir ${formatPollExpiry(poll.expiresAt)}</span>`
      : '<span class="poll-status active">Sedang berlangsung</span>');

  // Cari jumlah suara tertinggi untuk menandai pemenang sementara
  const maxCount = Math.max(0, ...poll.answers.map((a) => a.count));

  const answersHtml = poll.answers.map((a) => {
    const isLeading = poll.totalVotes > 0 && a.count === maxCount && maxCount > 0;
    const clickable = a.count > 0;
    return `
      <div class="poll-answer${isLeading ? ' leading' : ''}${clickable ? ' clickable' : ''}"
           ${clickable ? `data-message-id="${messageId}" data-answer-id="${a.id}"` : ''}>
        <div class="poll-answer-row">
          <span class="poll-answer-text">${a.emoji ? escapeHtml(a.emoji) + ' ' : ''}${escapeHtml(a.text)}</span>
          <span class="poll-answer-count">${a.count} suara (${a.percent}%)${clickable ? ' <span class=\"poll-see-voters\">· lihat</span>' : ''}</span>
        </div>
        <div class="poll-bar-track">
          <div class="poll-bar-fill" style="width:${a.percent}%"></div>
        </div>
        <div class="poll-voters hidden" data-voters-for="${messageId}:${a.id}"></div>
      </div>`;
  }).join('');

  return `
    <div class="poll-card">
      <div class="poll-header">
        <span class="poll-icon">📊</span>
        <span class="poll-question">${escapeHtml(poll.question)}</span>
      </div>
      ${answersHtml}
      <div class="poll-footer">
        <span>${poll.totalVotes} total suara${poll.multiselect ? ' · bisa pilih lebih dari 1' : ''}</span>
        ${statusHtml}
      </div>
    </div>`;
}

// Cache sederhana supaya tidak fetch ulang saat opsi yang sama dibuka-tutup
const voterCache = {};

async function togglePollVoters(answerDiv) {
  const { messageId, answerId } = answerDiv.dataset;
  const votersDiv = answerDiv.querySelector('.poll-voters');
  if (!votersDiv) return;

  const isOpen = !votersDiv.classList.contains('hidden');
  if (isOpen) {
    votersDiv.classList.add('hidden');
    return;
  }

  votersDiv.classList.remove('hidden');
  const cacheKey = `${messageId}:${answerId}`;

  if (voterCache[cacheKey]) {
    votersDiv.innerHTML = renderVotersList(voterCache[cacheKey]);
    return;
  }

  votersDiv.innerHTML = '<div class="poll-voters-loading">Memuat pemilih…</div>';
  try {
    const res = await fetch(`/api/channels/${currentChannel.id}/messages/${messageId}/poll-voters/${answerId}`);
    const data = await res.json();
    if (!res.ok) throw data;
    voterCache[cacheKey] = data;
    votersDiv.innerHTML = renderVotersList(data);
  } catch (err) {
    votersDiv.innerHTML = `<div class="poll-voters-error">Gagal memuat pemilih: ${escapeHtml(err.detail || err.error || 'error')}</div>`;
  }
}

function renderVotersList(voters) {
  if (!voters.length) {
    return '<div class="poll-voters-empty">Tidak ada data pemilih.</div>';
  }
  const items = voters.map((v) => `
    <div class="voter-chip">
      <img src="${v.avatar}" alt="${escapeHtml(v.name)}" loading="lazy">
      <span>${escapeHtml(v.name)}</span>
    </div>`).join('');
  return `<div class="voters-list">${items}</div>`;
}

// Event delegation: klik opsi poll untuk buka/tutup daftar pemilih
messagesEl.addEventListener('click', (e) => {
  const answerDiv = e.target.closest('.poll-answer.clickable');
  if (answerDiv) togglePollVoters(answerDiv);
});

function formatPollExpiry(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderAttachments(attachments) {
  if (!attachments || !attachments.length) return '';
  const items = attachments.map((a) => {
    const type = a.contentType || '';
    if (type.startsWith('image/')) {
      return `<a href="${a.url}" target="_blank" rel="noopener"><img class="attachment-img" src="${a.url}" alt="${escapeHtml(a.filename)}" loading="lazy"></a>`;
    }
    if (type.startsWith('video/')) {
      return `<video class="attachment-video" src="${a.url}" controls playsinline muted preload="metadata"></video>`;
    }
    if (type.startsWith('audio/')) {
      return `<audio class="attachment-audio" src="${a.url}" controls preload="metadata"></audio>`;
    }
    return `<a class="attachment-file" href="${a.url}" target="_blank" rel="noopener">📎 ${escapeHtml(a.filename)} <small>(${formatSize(a.size)})</small></a>`;
  }).join('');
  return `<div class="attachments">${items}</div>`;
}

function renderEmbeds(embeds) {
  if (!embeds || !embeds.length) return '';
  const items = embeds.map((e) => {
    const borderColor = e.color || '#4752c4';
    const titleHtml = e.title
      ? (e.url
        ? `<a href="${e.url}" target="_blank" rel="noopener" class="embed-title">${escapeHtml(e.title)}</a>`
        : `<div class="embed-title">${escapeHtml(e.title)}</div>`)
      : '';
    const siteHtml = e.siteName ? `<div class="embed-site">${escapeHtml(e.siteName)}</div>` : '';
    const descHtml = e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : '';
    const imgHtml = e.image ? `<img class="embed-image" src="${e.image}" loading="lazy" alt="">` : '';
    return `<div class="embed-card" style="border-left-color:${borderColor}">
      ${siteHtml}${titleHtml}${descHtml}${imgHtml}
    </div>`;
  }).join('');
  return `<div class="embeds">${items}</div>`;
}

// ---------- Helpers ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hari ini';
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------- Events ----------
refreshBtn.addEventListener('click', fetchLatestMessages);
loadMoreBtn.addEventListener('click', loadOlderMessages);

loadChannels();
