const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const express = require('express');
const play = require('play-dl');

// 🌐 Express Dashboard App
const app = express();
app.get('/', (req, res) => res.send('🌸 Aesthetic Discord Bot Online!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// 🤖 Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// 💾 Memory Database (Server Specific Economy & Settings)
const db = {
    settings: {}, // { guildId: { currency: '🌸', start_balance: 100, ... } }
    economy: {},  // { guildId: { userId: { wallet: 100, bank: 0, last_work: 0 } } }
    store: {},    // { guildId: [ { id: 1, name: 'VIP', price: 500 } ] }
};

function getSettings(guildId) {
    if (!db.settings[guildId]) {
        db.settings[guildId] = {
            currency: '🌸',
            start_balance: 100,
            auto_mod_mentions: 5
        };
    }
    return db.settings[guildId];
}

function getUser(guildId, userId) {
    const s = getSettings(guildId);
    if (!db.economy[guildId]) db.economy[guildId] = {};
    if (!db.economy[guildId][userId]) {
        db.economy[guildId][userId] = {
            wallet: s.start_balance,
            bank: 0,
            last_work: 0
        };
    }
    return db.economy[guildId][userId];
}

function sendEmbed(channel, title, description, color = '#ffd1dc', fields = []) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: '🌸 Aesthetic Bot System' });
    
    if (fields.length > 0) embed.addFields(fields);
    return channel.send({ embeds: [embed] });
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

/* ==================== SLASH INTERACTION ==================== */

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const s = getSettings(guildId);
    const u = getUser(guildId, userId);

    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🌸 ✨ Aesthetic Bot Command Menu ✨ 🌸')
            .setDescription('**Prefixes:** `!`, `c!`, `C!` болон **Slash Commands (`/`)** дэмжигдэнэ!\nСервер бүрийн cash болон эможи тусдаа хадгалагдана.')
            .setColor('#f7d6e0')
            .addFields(
                { name: '🎀 1. Economy & Money', value: '`/bal` (`!bal`, `c!bal`) | `/dep` (`!dep`) | `/with` (`!with`)\n`!work` / `!slut` / `!crime` | `!rob` | `!give-money`' },
                { name: '🪙 2. Currency Setting', value: '`!set-currency <emoji>` - Серверийн тусгай эможиг (жш: `<:coin:123456789>`) валют болгоно.' },
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
        if (now - u.last_work < 60000) return interaction.reply({ content: '⏳ Хүлээгээрэй, 1 минутын дараа дахин ажиллана уу.', ephemeral: true });
        const amt = Math.floor(Math.random() * 200) + 50;
        u.wallet += amt;
        u.last_work = now;
        return interaction.reply({ content: `✨ Та ажиллаад **${s.currency} ${amt}** оллоо!` });
    }

    if (interaction.commandName === 'dep') {
        const val = interaction.options.getString('amount');
        const amt = val === 'all' ? u.wallet : parseInt(val);
        if (isNaN(amt) || amt <= 0 || u.wallet < amt) return interaction.reply({ content: '❌ Буруу дүн байна.', ephemeral: true });
        u.wallet -= amt; u.bank += amt;
        return interaction.reply({ content: `🏦 Банкинд **${s.currency} ${amt}** орлогодох хийлээ.` });
    }

    if (interaction.commandName === 'with') {
        const val = interaction.options.getString('amount');
        const amt = val === 'all' ? u.bank : parseInt(val);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return interaction.reply({ content: '❌ Буруу дүн байна.', ephemeral: true });
        u.wallet += amt; u.bank -= amt;
        return interaction.reply({ content: `🏪 Банкнаас **${s.currency} ${amt}** зарлагадлаа.` });
    }
});

/* ==================== MULTI-PREFIX HANDLER (!, c!, C!) ==================== */

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const s = getSettings(guildId);

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

    if (command === 'help' || command === 'h') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🌸 ✨ Aesthetic Bot Command Menu ✨ 🌸')
            .setDescription('**Префиксүүд:** `!`, `c!`, `C!` болон **Slash (`/`)**\nСервер бүрийн cash болон эможи тусдаа хадгалагдана.')
            .setColor('#f7d6e0')
            .addFields(
                { name: '🎀 1. Economy & Money', value: '`!bal` (`c!bal`, `/bal`) - Баланс\n`!dep` (`c!dep`, `/dep`) - Банкинд орлогодох\n`!with` (`c!with`, `/with`) - Банкнаас зарлагадах\n`!work` / `!slut` / `!crime` - Мөнгө олох\n`!rob` - Дээрэмдэх' },
                { name: '🪙 2. Currency Setting', value: '`!set-currency <emoji>` - Серверийн эможиг (жш: `<:coin:123456>`) валют болгох' },
                { name: '🎲 3. Casino Games', value: '`!bj` / `!hl` / `!roulette` / `!rr` / `!slots`' },
                { name: '🛒 4. Store & Items', value: '`!store` (`/store`) | `!buy` | `!sell` | `!create-item`' },
                { name: '🎶 5. Music Bot', value: '`!play` (`!p`) | `!skip` (`!s`) | `!leave` (`!l`)' }
            );

        return message.channel.send({ embeds: [helpEmbed] });
    }

    if (command === 'set-currency' && isAdmin) {
        const newCurrency = args[0];
        if (!newCurrency) return sendEmbed(message.channel, '❌ Заавар', 'Эможигоо оруулна уу (жш: `!set-currency 💎`)', '#ffdac1');
        s.currency = newCurrency;
        return sendEmbed(message.channel, '✅ Валют Солигдлоо', `Серверийн мөнгөний бэлгэдлийг **${newCurrency}** болгож тохирууллаа!`, '#b5ead7');
    }

    if (command === 'balance' || command === 'bal') {
        const target = message.mentions.members.first() || message.member;
        const tu = getUser(guildId, target.id);
        return sendEmbed(message.channel, `🌸 ${target.user.username}-н Хэтэвч`, '✨ Серверийн дансны мэдээлэл:', '#f7d6e0', [
            { name: '👛 Түрэвч', value: `**${s.currency} ${tu.wallet}**`, inline: true },
            { name: '🏦 Банк', value: `**${s.currency} ${tu.bank}**`, inline: true }
        ]);
    }

    if (command === 'deposit' || command === 'dep') {
        const amt = args[0] === 'all' ? u.wallet : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.wallet < amt) return sendEmbed(message.channel, '❌ Алдаа', 'Буруу дүн эсвэл мөнгө хүрэлцэхгүй байна.', '#ffb3ba');
        u.wallet -= amt; u.bank += amt;
        return sendEmbed(message.channel, '🏦 Банкинд Орлогодох', `Амжилттай **${s.currency} ${amt}**-ийг банк руугаа хийлээ.`, '#b5ead7');
    }

    if (command === 'withdraw' || command === 'with') {
        const amt = args[0] === 'all' ? u.bank : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return sendEmbed(message.channel, '❌ Алдаа', 'Банкны үлдэгдэл хүрэлцэхгүй байна.', '#ffb3ba');
        u.wallet += amt; u.bank -= amt;
        return sendEmbed(message.channel, '🏪 Банкнаас Зарлагадах', `Амжилттай **${s.currency} ${amt}**-ийг бэлнээр авлаа.`, '#b5ead7');
    }

    if (['work', 'slut', 'crime'].includes(command)) {
        const now = Date.now();
        if (now - u.last_work < 60000) return sendEmbed(message.channel, '⏳ Хүлээгээрэй', 'Хэсэг хугацааны дараа дахин ажиллана уу.', '#ffdac1');

        const isWin = Math.random() >= 0.3;
        const amt = Math.floor(Math.random() * 200) + 50;

        if (isWin) u.wallet += amt; else u.wallet = Math.max(0, u.wallet - amt);
        u.last_work = now;

        const status = isWin ? `✨ Та амжилттай **${s.currency} ${amt}** оллоо!` : `💸 Харамсалтай нь **${s.currency} ${amt}** алдлаа.`;
        return sendEmbed(message.channel, `🌸 Command: !${command}`, status, isWin ? '#b5ead7' : '#ffb3ba');
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
