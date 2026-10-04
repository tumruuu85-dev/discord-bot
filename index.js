const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const Database = require('better-sqlite3');
const express = require('express');
const play = require('play-dl');

// 🌐 Express Dashboard
const app = express();
app.get('/', (req, res) => res.send('🌸 Aesthetic Discord Bot is Running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web Server running on port ${PORT}`));

// 🤖 Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// 💾 SQLite Database
const db = new Database('database.db');

// Database Setup
db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
        guild_id TEXT PRIMARY KEY,
        currency TEXT DEFAULT '🌸',
        start_balance INTEGER DEFAULT 100,
        bet_min INTEGER DEFAULT 10,
        bet_max INTEGER DEFAULT 10000,
        bj_decks INTEGER DEFAULT 1,
        game_cooldown INTEGER DEFAULT 5,
        audit_log TEXT,
        chat_min INTEGER DEFAULT 5,
        chat_max INTEGER DEFAULT 25,
        chat_cooldown INTEGER DEFAULT 60,
        counting_channel TEXT,
        counting_last INTEGER DEFAULT 0,
        auto_mod_mentions INTEGER DEFAULT 5,
        log_member TEXT, log_message TEXT, log_voice TEXT, log_mod TEXT, log_server TEXT,
        welcome_channel TEXT, welcome_msg TEXT, leave_channel TEXT, leave_msg TEXT, boost_msg TEXT,
        mod_role TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS economy (
        guild_id TEXT, user_id TEXT, wallet INTEGER, bank INTEGER,
        last_work INTEGER DEFAULT 0, last_crime INTEGER DEFAULT 0, last_slut INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS store (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, price INTEGER, role_id TEXT, description TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
        guild_id TEXT, user_id TEXT, item_id INTEGER, quantity INTEGER DEFAULT 1
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS custom_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, type TEXT, success INTEGER, text TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS auto_responders (
        guild_id TEXT, trigger TEXT, response TEXT, PRIMARY KEY(guild_id, trigger)
    )
`).run();

// --- Aesthetic Helper Embed Function ---
function sendEmbed(channel, title, description, color = '#ffd1dc', fields = []) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: '🌸 Aesthetic Bot • System' });
    
    if (fields.length > 0) embed.addFields(fields);
    return channel.send({ embeds: [embed] });
}

function getSettings(guildId) {
    let s = db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(guildId);
    if (!s) {
        db.prepare('INSERT INTO settings (guild_id) VALUES (?)').run(guildId);
        s = db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(guildId);
    }
    return s;
}

function getUser(guildId, userId) {
    const s = getSettings(guildId);
    let u = db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    if (!u) {
        db.prepare('INSERT INTO economy (guild_id, user_id, wallet, bank) VALUES (?, ?, ?, 0)').run(guildId, userId, s.start_balance);
        u = db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    }
    return u;
}

function parseTime(str) {
    if (!str) return 0;
    const unit = str.slice(-1);
    const num = parseInt(str.slice(0, -1));
    if (isNaN(num)) return 0;
    if (unit === 's') return num * 1000;
    if (unit === 'm') return num * 60 * 1000;
    if (unit === 'h') return num * 3600 * 1000;
    if (unit === 'd') return num * 86400 * 1000;
    return 0;
}

const PREFIX = '!';

/* ==================== EVENT HANDLERS ==================== */

client.on('guildMemberAdd', member => {
    const s = getSettings(member.guild.id);
    if (s.welcome_channel && s.welcome_msg) {
        const ch = member.guild.channels.cache.get(s.welcome_channel);
        if (ch) sendEmbed(ch, '🎀 Welcome! ✨', s.welcome_msg.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name), '#f7d6e0');
    }
});

client.on('guildMemberRemove', member => {
    const s = getSettings(member.guild.id);
    if (s.leave_channel && s.leave_msg) {
        const ch = member.guild.channels.cache.get(s.leave_channel);
        if (ch) sendEmbed(ch, '☁️ Goodbye~', s.leave_msg.replace('{user}', member.user.tag), '#e2ece9');
    }
});

/* ==================== COMMAND HANDLER ==================== */

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const s = getSettings(guildId);

    // Auto-mod Mentions
    if (message.mentions.users.size >= s.auto_mod_mentions && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        message.delete();
        return sendEmbed(message.channel, '⚠️ Auto-Mod Alert', `✨ <@${userId}>, mass mention хийхийг хориглоно!`, '#ffb3ba');
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    /* ================= 📖 HELP COMMAND ================= */

    if (command === 'help' || command === 'h') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🌸 ✨ Aesthetic Bot Command Menu ✨ 🌸')
            .setDescription('Доорх ангиллуудаас хэрэгтэй коммандаа сонгон ашиглаарай! Товчлолуудыг (`alaises`) багтаав.')
            .setColor('#f7d6e0')
            .addFields(
                {
                    name: '🎀 1. Economy & Money (!bal, !dep, !with)',
                    value: '`!bal` (`!balance`) - Баланс харах\n`!dep` (`!deposit`) - Банкинд хийх\n`!with` (`!withdraw`) - Банкнаас авах\n`!work` / `!slut` / `!crime` - Орлого олох\n`!rob` - Дээрэмдэх\n`!give-money` (`!pay`) - Мөнгө шилжүүлэх\n`!collect-income` - Ролын орлого авах'
                },
                {
                    name: '🎲 2. Casino & Games (!bj, !hl, !rr)',
                    value: '`!bj` (`!blackjack`) - Blackjack\n`!hl` (`!higher-lower`) - Higher/Lower\n`!roulette` - Рулет\n`!rr` (`!russian-roulette`) - Russian Roulette\n`!slots` (`!slot-machine`) - Slot machine'
                },
                {
                    name: '🛒 3. Store & Items (!store, !buy, !sell)',
                    value: '`!store` - Дэлгүүр харах\n`!buy-item` (`!buy`) - Худалдаж авах\n`!sell-item` (`!sell`) - Зарах\n`!give-item` - Бэлэглэх\n`!item-info` - Барааны мэдээлэл'
                },
                {
                    name: '🌷 4. Mimu & Customization (!greeting, !embed)',
                    value: '`!greeting message` - Угтах мессеж\n`!leave message` - Гарах мессеж\n`!boost message` - Boost мессеж\n`!embed create` - Custom Embed үүсгэх\n`!autoresponder add` - Автомат хариулагч'
                },
                {
                    name: '⚙️ 5. Server Config & Admin (!set-currency, !add-money)',
                    value: '`!set-currency` - Валют солих\n`!set-start-balance` - Эхлэх баланс\n`!add-money` / `!remove-money` - Мөнгө өгөх/хасах\n`!add-money-role` / `!remove-money-role` - Ролоор мөнгө өгөх/хасах\n`!reset-money` / `!reset-economy` - Шинэчлэх\n`!create-item` / `!edit-item` / `!delete-item`'
                },
                {
                    name: '🛡 6. Moderation & Logs (!mute, !ban, !kick)',
                    value: '`!mute` / `!timeout` - Мутлах (1s/1m/1h/1d)\n`!ban` / `!kick` - Бандах/Кикдэх\n`!log-member` / `!log-message` / `!log-voice` - Лог суваг\n`!auto-mod-mentions` - Mass mention сэрэмжлүүлэг'
                },
                {
                    name: '🎶 7. Music Bot (!p, !s, !stop)',
                    value: '`!p` (`!play`) - Дуу тоглуулах\n`!s` (`!skip`) - Дуу алгасах\n`!stop` / `!leave` (`!l`) - Сувгаас гарах\n`!volume` - Дууны чанга сулыг тохируулах'
                }
            )
            .setFooter({ text: '🌸 ✨ Have a lovely day ✨ 🌸' });

        return message.channel.send({ embeds: [helpEmbed] });
    }

    /* ================= 💰 ECONOMY COMMANDS ================= */

    if (command === 'balance' || command === 'bal') {
        const target = message.mentions.members.first() || message.member;
        const tu = getUser(guildId, target.id);
        return sendEmbed(message.channel, `🌸 ${target.user.username}-н Хэтэвч`, '✨ Дансны мэдээлэл харагдаж байна.', '#f7d6e0', [
            { name: '👛 Түрэвч (Wallet)', value: `**${s.currency} ${tu.wallet}**`, inline: true },
            { name: '🏦 Банк (Bank)', value: `**${s.currency} ${tu.bank}**`, inline: true },
            { name: '✨ Нийт (Total)', value: `**${s.currency} ${tu.wallet + tu.bank}**`, inline: true }
        ]);
    }

    if (command === 'deposit' || command === 'dep') {
        const amt = args[0] === 'all' ? u.wallet : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.wallet < amt) return sendEmbed(message.channel, '❌ Алдаа', 'Буруу дүн оруулсан эсвэл бэлэн мөнгө хүрэлцэхгүй байна.', '#ffb3ba');
        db.prepare('UPDATE economy SET wallet = wallet - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ?').run(amt, amt, guildId, userId);
        return sendEmbed(message.channel, '🏦 Банкинд Орлогодох', `Амжилттай **${s.currency} ${amt}**-ийг банк руугаа шилжүүллээ. ✨`, '#b5ead7');
    }

    if (command === 'withdraw' || command === 'with') {
        const amt = args[0] === 'all' ? u.bank : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return sendEmbed(message.channel, '❌ Алдаа', 'Банкны үлдэгдэл хүрэлцэхгүй байна.', '#ffb3ba');
        db.prepare('UPDATE economy SET wallet = wallet + ?, bank = bank - ? WHERE guild_id = ? AND user_id = ?').run(amt, amt, guildId, userId);
        return sendEmbed(message.channel, '🏪 Банкнаас Зарлагадах', `Амжилттай **${s.currency} ${amt}**-ийг бэлнээр гаргаж авлаа. ✨`, '#b5ead7');
    }

    if (['work', 'slut', 'crime'].includes(command)) {
        const u = getUser(guildId, userId);
        const now = Date.now();
        const cd = 60 * 1000;
        if (now - u[`last_${command}`] < cd) return sendEmbed(message.channel, '⏳ Хүлээгээрэй', 'Та хэдэн секундийн дараа дахин ажиллах боломжтой.', '#ffdac1');

        const isWin = Math.random() >= 0.3;
        const amt = Math.floor(Math.random() * 200) + 50;

        if (isWin) db.prepare(`UPDATE economy SET wallet = wallet + ?, last_${command} = ? WHERE guild_id = ? AND user_id = ?`).run(amt, now, guildId, userId);
        else db.prepare(`UPDATE economy SET wallet = MAX(0, wallet - ?), last_${command} = ? WHERE guild_id = ? AND user_id = ?`).run(amt, now, guildId, userId);

        const status = isWin ? `✨ Та амжилттай **${s.currency} ${amt}** оллоо!` : `💸 Харамсалтай нь та **${s.currency} ${amt}** алдлаа.`;
        return sendEmbed(message.channel, `🌸 Command: !${command}`, status, isWin ? '#b5ead7' : '#ffb3ba');
    }

    /* ================= 🎲 CASINO GAMES ================= */

    if (command === 'blackjack' || command === 'bj') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || u.wallet < bet) return sendEmbed(message.channel, '❌ Мөрий Буруу', 'Мөрийний дүн хүрэлцэхгүй байна.', '#ffb3ba');

        const p = Math.floor(Math.random() * 10) + 12;
        const d = Math.floor(Math.random() * 10) + 12;
        const isWin = p <= 21 && (p > d || d > 21);

        if (isWin) db.prepare('UPDATE economy SET wallet = wallet + ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);
        else db.prepare('UPDATE economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);

        return sendEmbed(message.channel, '🃏 Blackjack Game', `**Таны оноо:** ${p}\n**Дилерийн оноо:** ${d}\n\n${isWin ? `🎉 Та хожиж **${s.currency}${bet}** авлаа!` : `💸 Та хожигдож **${s.currency}${bet}** алдлаа.`}`, isWin ? '#b5ead7' : '#ffb3ba');
    }

    if (command === 'higher-lower' || command === 'hl') {
        const bet = parseInt(args[0]);
        const choice = args[1]?.toLowerCase();
        if (isNaN(bet) || !['higher', 'lower'].includes(choice)) return sendEmbed(message.channel, '❌ Заавар', 'Заавар: `!hl 100 higher` эсвэл `!hl 100 lower`', '#ffdac1');

        const n1 = Math.floor(Math.random() * 10) + 1;
        const n2 = Math.floor(Math.random() * 10) + 1;
        const win = (choice === 'higher' && n2 > n1) || (choice === 'lower' && n2 < n1);

        if (win) db.prepare('UPDATE economy SET wallet = wallet + ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);
        else db.prepare('UPDATE economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);

        return sendEmbed(message.channel, '🎲 Higher or Lower', `Эхний тоо: **${n1}** ➔ Дараагийн тоо: **${n2}**\n\n${win ? `🎉 Зөв таалаа! **+${s.currency}${bet}**` : `💸 Буруу таалаа... **-${s.currency}${bet}**`}`, win ? '#b5ead7' : '#ffb3ba');
    }

    /* ================= 🛒 STORE & ITEMS ================= */

    if (command === 'store') {
        const items = db.prepare('SELECT * FROM store WHERE guild_id = ?').all(guildId);
        const list = items.map(i => `✨ **ID: ${i.id}** | ${i.name} — **${s.currency} ${i.price}**`).join('\n') || '🛒 Дэлгүүр одоогоор хоосон байна.';
        return sendEmbed(message.channel, '🌸 Aesthetic Boutique Store', list, '#c7ceea');
    }

    if (command === 'create-item' && isAdmin) {
        const name = args[0]; const price = parseInt(args[1]); const role = message.mentions.roles.first();
        db.prepare('INSERT INTO store (guild_id, name, price, role_id) VALUES (?, ?, ?, ?)').run(guildId, name, price, role ? role.id : null);
        return sendEmbed(message.channel, '✅ Бараа Үүссэн', `Дэлгүүрт **${name}**-ийг ${s.currency} ${price} үнэтэйгээр суулгалаа.`, '#b5ead7');
    }

    /* ================= 🛡 MODERATION COMMANDS ================= */

    if ((command === 'mute' || command === 'timeout') && isAdmin) {
        const target = message.mentions.members.first();
        const time = parseTime(args[1]);
        if (!target || time === 0) return sendEmbed(message.channel, '❌ Заавар', 'Ашиглах: `!mute @user 10m` (1s/1m/1h/1d)', '#ffdac1');
        await target.timeout(time, 'Muted by Admin');
        return sendEmbed(message.channel, '🔇 Mute Applied', `**${target.user.tag}** гишүүнийг **${args[1]}** хугацаанд мутлав.`, '#e2ece9');
    }

    if (command === 'ban' && isAdmin) {
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Алдаа', 'Бандах гишүүнээ заана уу.', '#ffb3ba');
        await target.ban();
        return sendEmbed(message.channel, '🔨 Member Banned', `**${target.user.tag}** серверээс бандагдлаа.`, '#ffb3ba');
    }

    /* ================= 🎶 MUSIC COMMANDS ================= */

    if (command === 'play' || command === 'p') {
        const vc = message.member.voice.channel;
        if (!vc) return sendEmbed(message.channel, '❌ Voice Channel', 'Та эхлээд дууны сувагт орно уу!', '#ffdac1');
        const query = args.join(' ');
        if (!query) return sendEmbed(message.channel, '❌ Заавар', 'Заавар: `!play <дууны нэр/линк>`', '#ffdac1');

        const connection = joinVoiceChannel({ channelId: vc.id, guildId: message.guild.id, adapterCreator: message.guild.voiceAdapterCreator });
        const player = createAudioPlayer();
        const res = await play.search(query, { limit: 1 });

        if (!res.length) return sendEmbed(message.channel, '❌ Олдсонгүй', 'Дуу олдсонгүй.', '#ffb3ba');

        const stream = await play.stream(res[0].url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });

        player.play(resource);
        connection.subscribe(player);

        return sendEmbed(message.channel, '🎶 Now Playing', `🎵 **${res[0].title}**\n✨ Суваг: <#${vc.id}>`, '#e2ece9');
    }

    if (command === 'leave' || command === 'l' || command === 'stop') {
        const { getVoiceConnection } = require('@discordjs/voice');
        const conn = getVoiceConnection(message.guild.id);
        if (conn) {
            conn.destroy();
            return sendEmbed(message.channel, '👋 Voice Left', 'Дууны сувгаас гарлаа.', '#f7d6e0');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
