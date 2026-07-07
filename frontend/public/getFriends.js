// Discord friend exporter — based on https://github.com/Escartem/fwendator
// Run this in the browser console while on https://discord.com/app (while logged in)
// WARNING: Uses your Discord user token (self-botting). Token stays local; never sent to third parties.

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

async function f(e, n) {
  return await fetch(e, { headers: { Authorization: n } })
    .then(e => e.json())
    .then(e => e);
}

async function lf(e) {
  console.log("✉️ Fetching friends...");
  return Object.values(await f("https://discord.com/api/v9/users/@me/relationships", e)).map(e => e.user);
}

const tm = e => new Promise(n => setTimeout(n, e));

async function gl(e, n) {
  const fp = {};
  const m = Math.floor(e.length % 3600 / 60);
  const s = Math.floor(e.length % 60);
  console.log(`⏱ This will take about ${(m > 0 ? m + (1 == m ? " minute and " : " minutes and ") : "") + (s > 0 ? s + (1 == s ? " second" : " seconds") : "")}`);
  for (let t in e) {
    const user = e[t];
    const avatarHash = user.avatar;
    const disc = user.discriminator != null ? user.discriminator % 5 : parseInt(user.id, 10) % 5;
    const avatarUrl = avatarHash
      ? `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=512`
      : `https://cdn.discordapp.com/embed/avatars/${disc}.png`;

    const tag = user.discriminator && user.discriminator !== "0"
      ? `${user.username}#${user.discriminator}`
      : user.global_name || user.username;

    fp[user.id] = {
      name: tag,
      avatar: avatarUrl,
      mutual: Object.values(await f(`https://discord.com/api/v9/users/${user.id}/relationships`, n)).map(e => e.id)
    };
    console.log(`📃 Parsing friends... [${parseInt(t) + 1}/${e.length}]`);
    await tm(400);
  }
  return fp;
}

function up(e) {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.body.appendChild(Object.assign(document.createElement("h1"), { innerHTML: "Your friends data ✨" }));
  document.body.appendChild(Object.assign(document.createElement("p"), {
    innerHTML: "Download this JSON and upload it to Discord Family Tree."
  }));
  document.body.appendChild(Object.assign(document.createElement("textarea"), {
    value: JSON.stringify(e, null, 2),
    readOnly: true,
    style: "width: 100%; height: 400px;"
  }));
  document.body.appendChild(Object.assign(document.createElement("button"), {
    innerHTML: "📄 Download data",
    onclick: function() {
      const url = URL.createObjectURL(new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }));
      Object.assign(document.createElement("a"), {
        href: url,
        download: `friends-${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19).replaceAll("-", "")}.json`
      }).click();
      URL.revokeObjectURL(url);
    }
  }));
}

async function m() {
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

  const friends = await lf(token);
  const data = await gl(friends, token);
  up(data);
  console.log('✨ Done');
}

m();
