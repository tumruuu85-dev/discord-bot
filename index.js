const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const Database = require('better-sqlite3');
const express = require('express');
const play = require('play-dl');

// 🌐 Express Dashboard
const app = express();
app.get('/', (req, res) => res.send('🌸 Aesthetic Multi-Prefix & Slash Bot is Running!'));
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

// Database Setup (Server Specific Economy & Settings)
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
        welcome_channel TEXT, welcome_msg TEXT, leave_channel TEXT, leave_msg TEXT, boost_msg TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS economy (
        guild_id TEXT, 
        user_id TEXT, 
        wallet INTEGER, 
        bank INTEGER,
        last_work INTEGER DEFAULT 0, 
        last_crime INTEGER DEFAULT 0, 
        last_slut INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS store (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, price INTEGER, role_id TEXT, description TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS custom_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, type TEXT, success INTEGER, text TEXT
    )
`).run();

// --- Aesthetic Helper Embed Function ---
function sendEmbed(channel, title, description, color = '#ffd1dc', fields = []) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: '🌸 Aesthetic Bot • Multi-Server System' });
    
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

/* ==================== SLASH COMMANDS REGISTRATION ==================== */

const slashCommands = [
    new SlashCommandBuilder().setName('help').setDescription('Бүх коммандыг ангилалтайгаар харах'),
    new SlashCommandBuilder().setName('bal').setDescription('Түрэвч болон банкны баланс харах').addUserOption(o => o.setName('user').setDescription('Хэрэглэгч')),
    new SlashCommandBuilder().setName('work').setDescription('Ажил хийж мөнгө олох'),
    new SlashCommandBuilder().setName('dep').setDescription('Банкинд мөнгө тушаах').addStringOption(o => o.setName('amount').setDescription('Мөнгөний хэмжээ эсвэл all').setRequired(true)),
    new SlashCommandBuilder().setName('with').setDescription('Банкнаас мөнгө гаргах').addStringOption(o => o.setName('amount').setDescription('Мөнгөний хэмжээ эсвэл all').setRequired(true)),
    new SlashCommandBuilder().setName('store').setDescription('Дэлгүүрийн барааг харах')
];

client.on('ready', async () => {
    console.log(`✨ Bot logged in as ${client.user.tag}`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Slash (/) Commands registered successfully!');
    } catch (err) {
        console.error('Error registering slash commands:', err);
    }
});

/* ==================== SLASH COMMAND INTERACTION ==================== */

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const s = getSettings(guildId);
    const u = getUser(guildId, userId);

    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🌸 ✨ Aesthetic Bot Command Menu ✨ 🌸')
            .setDescription('**Prefixes:** `!`, `c!`, `C!` болон Slash Commands **(`/`)** дэмжигдэнэ!\nСервер бүрийн cash болон эможи тусдаа хадгалагдана.')
            .setColor('#f7d6e0')
            .addFields(
                { name: '🎀 1. Economy & Money', value: '`/bal` (`!bal`, `c!bal`) | `/dep` (`!dep`) | `/with` (`!with`)\n`!work` / `!slut` / `!crime` | `!rob` | `!give-money`' },
                { name: '🪙 2. Currency Setting', value: '`!set-currency <emoji>` - Серверийн аватар/custom эможиг (жш: `<:coin:123456789>`) эсвэл ердийн эможиг валют болгоно.' },
                { name: '🎲 3. Casino & Games', value: '`!bj` (`!blackjack`) | `!hl` | `!roulette` | `!rr` | `!slots`' },
                { name: '🛒 4. Store & Items', value: '`/store` (`!store`) | `!buy` | `!sell` | `!create-item`' },
                { name: '🎶 5. Music Bot', value: '`!play` (`!p`) | `!skip` (`!s`) | `!leave` (`!l`)' }
            );
        return interaction.reply({ embeds: [helpEmbed] });
    }

    if (interaction.commandName === 'bal') {
        const target = interaction.options.getMember('user') || interaction.member;
        const tu = getUser(guildId, target.id);
        const embed = new EmbedBuilder()
            .setTitle(`🌸 ${target.user.username}-н Хэтэвч`)
            .addFields(
                { name: '👛 Түрэвч', value: `**${s.currency} ${tu.wallet}**`, inline: true },
                { name: '🏦 Банк', value: `**${s.currency} ${tu.bank}**`, inline: true }
            ).setColor('#f7d6e0');
        return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'work') {
        const now = Date.now();
        if (now - u.last_work < 60000) return interaction.reply({ content: '⏳ Хүлээгээрэй, 1 минутын дараа дахин ажиллах боломжтой.', ephemeral: true });
        const amt = Math.floor(Math.random() * 200) + 50;
        db.prepare('UPDATE economy SET wallet = wallet + ?, last_work = ? WHERE guild_id = ? AND user_id = ?').run(amt, now, guildId, userId);
        return interaction.reply({ content: `✨ Та ажиллаад **${s.currency} ${amt}** оллоо!` });
    }

    if (interaction.commandName === 'dep') {
        const val = interaction.options.getString('amount');
        const amt = val === 'all' ? u.wallet : parseInt(val);
        if (isNaN(amt) || amt <= 0 || u.wallet < amt) return interaction.reply({ content: '❌ Буруу дүн байна.', ephemeral: true });
        db.prepare('UPDATE economy SET wallet = wallet - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ?').run(amt, amt, guildId, userId);
        return interaction.reply({ content: `🏦 Банкинд **${s.currency} ${amt}** орлогодох хийлээ.` });
    }

    if (interaction.commandName === 'with') {
        const val = interaction.options.getString('amount');
        const amt = val === 'all' ? u.bank : parseInt(val);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return interaction.reply({ content: '❌ Буруу дүн байна.', ephemeral: true });
        db.prepare('UPDATE economy SET wallet = wallet + ?, bank = bank - ? WHERE guild_id = ? AND user_id = ?').run(amt, amt, guildId, userId);
        return interaction.reply({ content: `🏪 Банкнаас **${s.currency} ${amt}** зарлагадлаа.` });
    }

    if (interaction.commandName === 'store') {
        const items = db.prepare('SELECT * FROM store WHERE guild_id = ?').all(guildId);
        const list = items.map(i => `✨ **ID: ${i.id}** | ${i.name} — **${s.currency} ${i.price}**`).join('\n') || '🛒 Дэлгүүр хоосон байна.';
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🌸 Store').setDescription(list).setColor('#c7ceea')] });
    }
});

/* ==================== PREFIX COMMAND HANDLER (!, c!, C!) ==================== */

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const s = getSettings(guildId);

    // Multi-Prefix Checking: ! эсвэл c! эсвэл C!
    const content = message.content.trim();
    let usedPrefix = null;
    const prefixes = ['!', 'c!', 'C!'];

    for (const p of prefixes) {
        if (content.toLowerCase().startsWith(p.toLowerCase())) {
            usedPrefix = p;
            break;
        }
    }

    if (!usedPrefix) return;

    const args = content.slice(usedPrefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const u = getUser(guildId, userId);

    /* ================= 📖 HELP COMMAND ================= */

    if (command === 'help' || command === 'h') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🌸 ✨ Aesthetic Bot Command Menu ✨ 🌸')
            .setDescription('**Зөвшөөрөгдөх Префиксүүд:** `!`, `c!`, `C!` болон **Slash (`/`) Commands**!\nСервер бүрийн cash болон валютын эможи тусдаа тохируулагдана.')
            .setColor('#f7d6e0')
            .addFields(
                { name: '🎀 1. Economy & Money', value: '`!bal` (`c!bal`, `/bal`) - Баланс\n`!dep` (`c!dep`, `/dep`) - Банкинд орлогодох\n`!with` (`c!with`, `/with`) - Банкнаас зарлагадах\n`!work` / `!slut` / `!crime` - Мөнгө олох\n`!rob` - Дээрэмдэх\n`!give-money` - Мөнгө өгөх' },
                { name: '🪙 2. Currency & Custom Emoji', value: '`!set-currency <emoji>` - Серверийн эможи (жш: `<:coin:123456>`) эсвэл энгийн эможиг валют болгох' },
                { name: '🎲 3. Casino Games', value: '`!bj` / `!hl` / `!roulette` / `!rr` / `!slots`' },
                { name: '🛒 4. Store & Items', value: '`!store` (`/store`) | `!buy` | `!sell` | `!create-item`' },
                { name: '🎶 5. Music Bot', value: '`!play` (`!p`) | `!skip` (`!s`) | `!leave` (`!l`)' }
            )
            .setFooter({ text: '🌸 ✨ Multi-Prefix & Slash Command Active ✨ 🌸' });

        return message.channel.send({ embeds: [helpEmbed] });
    }

    /* ================= ⚙️ SETTINGS ================= */

    if (command === 'set-currency' && isAdmin) {
        const newCurrency = args[0];
        if (!newCurrency) return sendEmbed(message.channel, '❌ Заавар', 'Валютаар тохируулах эможигоо оруулна уу (жш: `!set-currency <:coin:123456789>` эсвэл `!set-currency 💎`)', '#ffdac1');
        db.prepare('UPDATE settings SET currency = ? WHERE guild_id = ?').run(newCurrency, guildId);
        return sendEmbed(message.channel, '✅ Валют Солигдлоо', `Энэ серверийн мөнгөний бэлгэдлийг **${newCurrency}** болгож тохирууллаа!`, '#b5ead7');
    }

    /* ================= 💰 ECONOMY ================= */

    if (command === 'balance' || command === 'bal') {
        const target = message.mentions.members.first() || message.member;
        const tu = getUser(guildId, target.id);
        return sendEmbed(message.channel, `🌸 ${target.user.username}-н Хэтэвч`, '✨ Серверийн дансны мэдээлэл:', '#f7d6e0', [
            { name: '👛 Түрэвч (Wallet)', value: `**${s.currency} ${tu.wallet}**`, inline: true },
            { name: '🏦 Банк (Bank)', value: `**${s.currency} ${tu.bank}**`, inline: true },
            { name: '✨ Нийт (Total)', value: `**${s.currency} ${tu.wallet + tu.bank}**`, inline: true }
        ]);
    }

    if (command === 'deposit' || command === 'dep') {
        const amt = args[0] === 'all' ? u.wallet : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.wallet < amt) return sendEmbed(message.channel, '❌ Алдаа', 'Буруу дүн эсвэл мөнгө хүрэлцэхгүй байна.', '#ffb3ba');
        db.prepare('UPDATE economy SET wallet = wallet - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ?').run(amt, amt, guildId, userId);
        return sendEmbed(message.channel, '🏦 Банкинд Орлогодох', `Амжилттай **${s.currency} ${amt}**-ийг банк руугаа хийлээ.`, '#b5ead7');
    }

    if (command === 'withdraw' || command === 'with') {
        const amt = args[0] === 'all' ? u.bank : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return sendEmbed(message.channel, '❌ Алдаа', 'Банкны үлдэгдэл хүрэлцэхгүй байна.', '#ffb3ba');
        db.prepare('UPDATE economy SET wallet = wallet + ?, bank = bank - ? WHERE guild_id = ? AND user_id = ?').run(amt, amt, guildId, userId);
        return sendEmbed(message.channel, '🏪 Банкнаас Зарлагадах', `Амжилттай **${s.currency} ${amt}**-ийг бэлнээр авлаа.`, '#b5ead7');
    }

    if (['work', 'slut', 'crime'].includes(command)) {
        const now = Date.now();
        if (now - u[`last_${command}`] < 60000) return sendEmbed(message.channel, '⏳ Хүлээгээрэй', 'Хэсэг хугацааны дараа дахин ажиллана уу.', '#ffdac1');

        const isWin = Math.random() >= 0.3;
        const amt = Math.floor(Math.random() * 200) + 50;

        if (isWin) db.prepare(`UPDATE economy SET wallet = wallet + ?, last_${command} = ? WHERE guild_id = ? AND user_id = ?`).run(amt, now, guildId, userId);
        else db.prepare(`UPDATE economy SET wallet = MAX(0, wallet - ?), last_${command} = ? WHERE guild_id = ? AND user_id = ?`).run(amt, now, guildId, userId);

        const status = isWin ? `✨ Та амжилттай **${s.currency} ${amt}** оллоо!` : `💸 Харамсалтай нь **${s.currency} ${amt}** алдлаа.`;
        return sendEmbed(message.channel, `🌸 Command: !${command}`, status, isWin ? '#b5ead7' : '#ffb3ba');
    }

    /* ================= 🎲 CASINO & MUSIC ================= */

    if (command === 'blackjack' || command === 'bj') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || u.wallet < bet) return sendEmbed(message.channel, '❌ Алдаа', 'Мөрий өгнө үү эсвэл мөнгө хүрэлцэхгүй байна.', '#ffb3ba');

        const p = Math.floor(Math.random() * 10) + 12;
        const d = Math.floor(Math.random() * 10) + 12;
        const isWin = p <= 21 && (p > d || d > 21);

        if (isWin) db.prepare('UPDATE economy SET wallet = wallet + ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);
        else db.prepare('UPDATE economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);

        return sendEmbed(message.channel, '🃏 Blackjack Game', `**Таны оноо:** ${p}\n**Дилерийн оноо:** ${d}\n\n${isWin ? `🎉 Та хожиж **${s.currency}${bet}** авлаа!` : `💸 Та **${s.currency}${bet}** алдлаа.`}`, isWin ? '#b5ead7' : '#ffb3ba');
    }

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
});

client.login(process.env.DISCORD_TOKEN);
