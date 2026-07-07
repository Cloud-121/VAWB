// Discord friend exporter — based on https://github.com/Escartem/fwendator
// Run this in the browser console while on https://discord.com/app (while logged in)
// Safe to re-run — wrapped in an IIFE so nothing leaks into the console scope.
// WARNING: Uses your Discord user token (self-botting). Token stays local; never sent to third parties.

(async () => {
  function collectTokenCandidates() {
    const candidates = [];
    const seen = new Set();

    const add = (value) => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim().replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '');
      if (trimmed.length > 20 && !seen.has(trimmed)) {
        seen.add(trimmed);
        candidates.push(trimmed);
      }
    };

    // Prefer localStorage — this is the live session token when logged in
    try {
      const stored = localStorage.getItem('token');
      if (stored) {
        try {
          add(JSON.parse(stored));
        } catch {
          add(stored);
        }
      }
    } catch {}

    try {
      window.webpackChunkdiscord_app.push([[Symbol()], {}, (req) => {
        for (const m of Object.values(req.c)) {
          try {
            if (!m.exports || m.exports === window) continue;
            const tryGet = (obj) => {
              if (obj && typeof obj.getToken === 'function') {
                try { add(obj.getToken()); } catch {}
              }
            };
            tryGet(m.exports);
            tryGet(m.exports.default);
            for (const key in m.exports) {
              const exp = m.exports[key];
              if (exp?.[Symbol.toStringTag] === 'IntlMessagesProxy') continue;
              tryGet(exp);
            }
          } catch {}
        }
      }]);
      window.webpackChunkdiscord_app.pop();
    } catch {}

    return candidates;
  }

  async function resolveToken() {
    const candidates = collectTokenCandidates();
    for (const token of candidates) {
      const res = await fetch('https://discord.com/api/v9/users/@me', {
        headers: { Authorization: token },
      });
      if (res.ok) return token;
    }
    return null;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ~10s per friend, randomized to reduce rate limits (8–14 seconds)
  const DELAY_MIN_MS = 8000;
  const DELAY_MAX_MS = 14000;
  const randomDelay = () => DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);

  async function apiFetch(url, token, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, { headers: { Authorization: token } });
      const data = await res.json();

      if (res.status === 429 && attempt < retries) {
        const retryMs = ((data?.retry_after ?? 10) + Math.random() * 2) * 1000;
        console.warn(`⏳ Rate limited — waiting ${(retryMs / 1000).toFixed(1)}s...`);
        await wait(retryMs);
        continue;
      }

      if (!res.ok) {
        const msg = data?.message || res.statusText;
        throw new Error(`${res.status} ${msg}`);
      }
      return data;
    }
    throw new Error('429 Too Many Requests');
  }

  async function fetchFriends(token) {
    console.log('✉️ Fetching friends...');
    const data = await apiFetch('https://discord.com/api/v9/users/@me/relationships', token);
    return Object.values(data)
      .filter((r) => r && r.type === 1 && r.user)
      .map((r) => r.user);
  }

  async function fetchMutualIds(friendId, token) {
    // Discord blocked /users/{id}/relationships for other users — use profile instead
    const profileParams = new URLSearchParams({
      type: 'modal',
      with_mutual_guilds: 'false',
      with_mutual_friends: 'true',
      with_mutual_friends_count: 'false',
    });

    try {
      const profile = await apiFetch(
        `https://discord.com/api/v9/users/${friendId}/profile?${profileParams}`,
        token,
      );
      const mutualFriends = profile.mutual_friends || profile.mutualFriends || [];
      const ids = mutualFriends
        .map((m) => (typeof m === 'string' ? m : m?.id))
        .filter(Boolean);
      if (ids.length > 0) return ids;
    } catch (err) {
      console.warn(`profile fetch failed for ${friendId}:`, err.message);
    }

    // fwendator fallback (may return empty on newer Discord)
    try {
      const rels = await apiFetch(`https://discord.com/api/v9/users/${friendId}/relationships`, token);
      return Object.values(rels)
        .map((r) => r?.user?.id || r?.id)
        .filter(Boolean);
    } catch {}

    return [];
  }

  async function buildFriendData(friends, token) {
    const output = {};
    const avgDelaySec = (DELAY_MIN_MS + DELAY_MAX_MS) / 2 / 1000;
    const totalSec = Math.round(friends.length * avgDelaySec);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const eta = `${mins > 0 ? `${mins} minute${mins === 1 ? '' : 's'} and ` : ''}${secs > 0 ? `${secs} second${secs === 1 ? '' : 's'}` : ''}`;
    console.log(`⏱ ~${avgDelaySec}s between each friend (randomized). Estimated time: ${eta || 'a moment'}`);

    for (let i = 0; i < friends.length; i++) {
      const user = friends[i];
      const avatarHash = user.avatar;
      const disc = user.discriminator != null ? user.discriminator % 5 : parseInt(user.id, 10) % 5;
      const avatarUrl = avatarHash
        ? `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=512`
        : `https://cdn.discordapp.com/embed/avatars/${disc}.png`;

      const tag = user.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : user.global_name || user.username;

      const mutual = await fetchMutualIds(user.id, token);
      output[user.id] = {
        name: tag,
        avatar: avatarUrl,
        mutual,
      };
      console.log(`📃 Parsing friends... [${i + 1}/${friends.length}] (${mutual.length} mutual)`);
      if (i < friends.length - 1) {
        const delay = randomDelay();
        console.log(`💤 Waiting ${(delay / 1000).toFixed(1)}s before next friend...`);
        await wait(delay);
      }
    }
    return output;
  }

  function showDownloadPage(data) {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.body.appendChild(Object.assign(document.createElement('h1'), { innerHTML: 'Your friends data ✨' }));
    document.body.appendChild(Object.assign(document.createElement('p'), {
      innerHTML: 'Download this JSON and upload it to Discord Family Tree.',
    }));
    document.body.appendChild(Object.assign(document.createElement('textarea'), {
      value: JSON.stringify(data, null, 2),
      readOnly: true,
      style: 'width: 100%; height: 400px;',
    }));
    document.body.appendChild(Object.assign(document.createElement('button'), {
      innerHTML: '📄 Download data',
      onclick() {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        Object.assign(document.createElement('a'), {
          href: url,
          download: `friends-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19).replaceAll('-', '')}.json`,
        }).click();
        URL.revokeObjectURL(url);
      },
    }));
  }

  if (window.location.host !== 'discord.com') {
    alert('Open discord.com/app first, then paste this script in the console.');
    return;
  }

  try {
    let token = await resolveToken();
    if (!token) {
      const manual = prompt('Could not read your session automatically. Paste your Discord token:');
      if (!manual) return;
      token = manual.trim().replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '');
      const check = await fetch('https://discord.com/api/v9/users/@me', {
        headers: { Authorization: token },
      });
      if (!check.ok) {
        alert('That token did not work. Make sure you are logged into Discord and try again.');
        return;
      }
    } else {
      console.log('🔑 Using your current Discord session');
    }

    const friends = await fetchFriends(token);
    if (friends.length === 0) {
      console.warn('No friends returned — you may have no Discord friends, or the API blocked the request.');
    }
    const data = await buildFriendData(friends, token);
    showDownloadPage(data);
    console.log('✨ Done');
  } catch (err) {
    console.error('Export failed:', err);
    alert(`Export failed: ${err.message}\n\nTry refreshing Discord and running the script again.`);
  }
})();
