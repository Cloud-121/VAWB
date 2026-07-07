// Discord friend exporter — based on https://github.com/Escartem/fwendator
// Run this in the browser console while on https://discord.com/app (while logged in)
// Safe to re-run — wrapped in an IIFE so nothing leaks into the console scope.
// WARNING: Uses your Discord user token (self-botting). Token stays local; never sent to third parties.

(async () => {
  function getDiscordToken() {
    let token;

    try {
      window.webpackChunkdiscord_app.push([[Symbol()], {}, (req) => {
        for (const m of Object.values(req.c)) {
          try {
            if (!m.exports || m.exports === window) continue;
            if (typeof m.exports.getToken === 'function') {
              token = m.exports.getToken();
              break;
            }
            if (typeof m.exports.default?.getToken === 'function') {
              token = m.exports.default.getToken();
              break;
            }
            for (const key in m.exports) {
              const exp = m.exports[key];
              if (typeof exp?.getToken === 'function' && exp[Symbol.toStringTag] !== 'IntlMessagesProxy') {
                token = exp.getToken();
                break;
              }
            }
          } catch {}
        }
      }]);
      window.webpackChunkdiscord_app.pop();
    } catch {}

    if (token) return token;

    try {
      const stored = localStorage.getItem('token');
      if (stored) return stored.replace(/^"|"$/g, '');
    } catch {}

    return null;
  }

  async function apiFetch(url, token) {
    const res = await fetch(url, { headers: { Authorization: token } });
    return res.json();
  }

  async function fetchFriends(token) {
    console.log('✉️ Fetching friends...');
    const data = await apiFetch('https://discord.com/api/v9/users/@me/relationships', token);
    return Object.values(data).map((r) => r.user);
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function buildFriendData(friends, token) {
    const output = {};
    const mins = Math.floor((friends.length % 3600) / 60);
    const secs = friends.length % 60;
    const eta = `${mins > 0 ? `${mins} minute${mins === 1 ? '' : 's'} and ` : ''}${secs > 0 ? `${secs} second${secs === 1 ? '' : 's'}` : ''}`;
    console.log(`⏱ This will take about ${eta}`);

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
        mutual: Object.values(mutuals).map((r) => r.id),
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

  let token = getDiscordToken();
  if (!token) {
    token = prompt('Could not read your session automatically. Enter your token:');
    if (!token) return;
  } else {
    console.log('🔑 Using your current Discord session');
  }

  const friends = await fetchFriends(token);
  const data = await buildFriendData(friends, token);
  showDownloadPage(data);
  console.log('✨ Done');
})();
