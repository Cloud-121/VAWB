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

  async function apiFetch(url, token) {
    const res = await fetch(url, { headers: { Authorization: token } });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.message || res.statusText;
      throw new Error(`${res.status} ${msg}`);
    }
    return data;
  }

  async function fetchFriends(token) {
    console.log('✉️ Fetching friends...');
    const data = await apiFetch('https://discord.com/api/v9/users/@me/relationships', token);
    return Object.values(data)
      .filter((r) => r && r.type === 1 && r.user)
      .map((r) => r.user);
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function buildFriendData(friends, token) {
    const output = {};
    const mins = Math.floor((friends.length % 3600) / 60);
    const secs = friends.length % 60;
    const eta = `${mins > 0 ? `${mins} minute${mins === 1 ? '' : 's'} and ` : ''}${secs > 0 ? `${secs} second${secs === 1 ? '' : 's'}` : ''}`;
    console.log(`⏱ This will take about ${eta || 'a moment'}`);

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

      const mutuals = await apiFetch(`https://discord.com/api/v9/users/${user.id}/relationships`, token);
      output[user.id] = {
        name: tag,
        avatar: avatarUrl,
        mutual: Object.values(mutuals)
          .filter((r) => r && r.type === 1)
          .map((r) => r.id),
      };
      console.log(`📃 Parsing friends... [${i + 1}/${friends.length}]`);
      await wait(400);
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
