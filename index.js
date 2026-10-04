const { 
    Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, 
    REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const express = require('express');
const play = require('play-dl');

// 🌐 Web Dashboard (Keep Alive for Render)
const app = express();
app.get('/', (req, res) => res.send('🌸 Soft Pink Aesthetic Bot is Live!'));
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

// 💾 Complete In-Memory Database
const db = {
    settings: {},      // guildId -> settings
    economy: {},       // guildId -> userId -> {wallet, bank, lastWork, lastSlut, lastCrime}
    warnings: {},      // guildId -> userId -> []
    store: {},         // guildId -> items []
    inventory: {},     // guildId -> userId -> items []
    autoResponders: {},// guildId -> trigger -> response
    customReplies: {}, // guildId -> type -> []
    cooldowns: {}      // guildId -> type -> ms
};

const SOFT_PINK = '#FFB6C1';

function sendEmbed(channel, title, description, fields = [], color = SOFT_PINK) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: '🌸 Aesthetic Bot • Soft Pink Edition' });
    
    if (fields.length > 0) embed.addFields(fields);
    return channel.send({ embeds: [embed] });
}

function getSettings(guildId) {
    if (!db.settings[guildId]) {
        db.settings[guildId] = {
            currency: '🌸',
            start_balance: 100,
            mod_role: null,
            bet_limit: { min: 10, max: 10000 },
            blackjack_decks: 1,
            logs: {},
            welcome_msg: null,
            leave_msg: null,
            boost_msg: null
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
            lastWork: 0,
            lastSlut: 0,
            lastCrime: 0
        };
    }
    return db.economy[guildId][userId];
}

function getWarnings(guildId, userId) {
    if (!db.warnings[guildId]) db.warnings[guildId] = {};
    if (!db.warnings[guildId][userId]) db.warnings[guildId][userId] = [];
    return db.warnings[guildId][userId];
}

// ⏳ Duration Parser (1m, 1h, 1d, 1w, 1mo)
function parseDuration(str) {
    if (!str) return 0;
    const match = str.match(/^(\d+)([a-z]+)$/i);
    if (!match) return 0;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'm': return num * 60 * 1000;
        case 'h': return num * 3600 * 1000;
        case 'd': return num * 86400 * 1000;
        case 'w': return num * 7 * 86400 * 1000;
        case 'mo': return num * 30 * 86400 * 1000;
        default: return 0;
    }
}

/* ==================== SLASH COMMANDS REGISTER ==================== */

const slashCommands = [
    new SlashCommandBuilder().setName('chelp').setDescription('Show command list with short descriptions'),
    new SlashCommandBuilder().setName('bal').setDescription('Check user wallet and bank balance').addUserOption(o => o.setName('user').setDescription('Target member')),
    new SlashCommandBuilder().setName('work').setDescription('Earn quick cash'),
    new SlashCommandBuilder().setName('dep').setDescription('Deposit money to bank').addStringOption(o => o.setName('amount').setDescription('Amount or all').setRequired(true)),
    new SlashCommandBuilder().setName('with').setDescription('Withdraw money from bank').addStringOption(o => o.setName('amount').setDescription('Amount or all').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Warn a user').addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for warn')),
    new SlashCommandBuilder().setName('warnings').setDescription('Check user warnings').addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true)),
    new SlashCommandBuilder().setName('hug').setDescription('Hug someone with an anime reaction').addUserOption(o => o.setName('user').setDescription('Member to hug').setRequired(true))
];

client.on('ready', async () => {
    console.log(`🌸 Logged in as ${client.user.tag}`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Slash Commands registered!');
    } catch (e) {
        console.error('Slash Error:', e);
    }
});

/* ==================== MESSAGE & COMMAND HANDLER ==================== */

const PREFIXES = ['!', 'c!', 'C!', '&!', 'c&!', 'C&!'];

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const s = getSettings(guildId);

    // Autoresponder Check
    if (db.autoResponders[guildId] && db.autoResponders[guildId][message.content.toLowerCase()]) {
        return message.channel.send(db.autoResponders[guildId][message.content.toLowerCase()]);
    }

    // Multi-Prefix Check
    const content = message.content.trim();
    let usedPrefix = null;
    for (const p of PREFIXES) {
        if (content.toLowerCase().startsWith(p.toLowerCase())) {
            usedPrefix = p;
            break;
        }
    }

    if (!usedPrefix) return;

    const args = content.slice(usedPrefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isOwnerOrAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.guild.ownerId === userId;
    const hasModRole = s.mod_role ? message.member.roles.cache.has(s.mod_role) : isOwnerOrAdmin;

    /* ================= 📖 CHELP ================= */

    if (command === 'chelp' || command === 'help') {
        const fields = [
            {
                name: '👑 Administrator Management',
                value: '`!add-modrole @role` - Assign mod role\n`!set-currency <symbol>` - Set currency emoji\n`!set-start-balance <amt>` - Set default bank\n`!set-bet-limit <min> <max>` - Set bet limits\n`!set-blackjak-decks <num>` - Set BJ decks\n`!add-money @user <amt>` - Add cash\n`!remove-money @user <amt>` - Remove cash\n`!reset-money` / `!reset-economy` - Reset cash'
            },
            {
                name: '🛡 Moderation & Warnings',
                value: '`!warn @user [reason]` - Issue warning\n`!warnings @user` - View warnings\n`!clearwarns @user` - Clear warnings\n`!ban @user` - Ban user\n`!kick @user` - Kick user\n`!timeout @user <time>` - Mute member\n`!temp-role @user @role <time>` - Give temp role'
            },
            {
                name: '💰 Economy & Cash',
                value: '`!bal` / `!balance` - View Wallet and Bank\n`!dep <amt>` / `!with <amt>` - Bank deposit/withdraw\n`!work` / `!slut` - Earn fast cash\n`!rob @user` - Attempt robbery\n`!give-money @user <amt>` - Transfer cash'
            },
            {
                name: '🎲 Casino & Games',
                value: '`!blackjack` (`!bj`) - Play Blackjack\n`!higher-lower` (`!hl`) - Guess higher/lower\n`!roulette <color> <amt>` - Play Roulette\n`!russian-roulette` - High risk game\n`!slot-machine <amt>` - Play Slots'
            },
            {
                name: '🛒 Store & Items',
                value: '`!store` - View items\n`!buy-item <name>` - Buy item\n`!sell-item <name>` - Sell item\n`!create-item <name> <price>` - Create item\n`!delete-item <name>` - Delete item\n`!give-item @user <item>` - Gift item'
            },
            {
                name: '📢 Welcome, Messages & Autoresponder',
                value: '`!greet-message <msg>` - Set welcome message\n`!leave-message <msg>` - Set leave message\n`!boost-message <msg>` - Set boost message\n`!autoresponder add <trigger> | <response>` - Set auto-reply'
            },
            {
                name: '🌸 Anime Reactions (OwO/Mimu)',
                value: '`!hug @user` - Hug GIF\n`!kiss @user` - Kiss GIF\n`!pat @user` - Headpat GIF\n`!slap @user` - Slap GIF'
            },
            {
                name: '🎶 Music Commands',
                value: '`!play <query>` - Play song\n`!skip` - Skip song\n`!volume <1-100>` - Set volume\n`!leave` - Disconnect'
            }
        ];

        return sendEmbed(message.channel, '🌸 ✨ Aesthetic Bot Command List ✨ 🌸', 'Supported Prefixes: `!`, `c!`, `C!`, `&!`, `c&!`, `C&!` and `/` Slash Commands', fields);
    }

    /* ================= 👑 ADMIN & CONFIG COMMANDS ================= */

    if (command === 'add-modrole' && isOwnerOrAdmin) {
        const role = message.mentions.roles.first();
        if (!role) return sendEmbed(message.channel, '❌ Error', 'Please mention a valid role.');
        s.mod_role = role.id;
        return sendEmbed(message.channel, '✅ Mod Role Set', `Moderator commands assigned to **${role.name}**.`);
    }

    if (command === 'set-currency' && isOwnerOrAdmin) {
        const sym = args[0];
        if (!sym) return sendEmbed(message.channel, '❌ Error', 'Please specify a symbol/emoji.');
        s.currency = sym;
        return sendEmbed(message.channel, '✅ Currency Set', `Server currency set to **${sym}**`);
    }

    if (command === 'set-start-balance' && isOwnerOrAdmin) {
        const amt = parseInt(args[0]);
        if (isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Invalid amount.');
        s.start_balance = amt;
        return sendEmbed(message.channel, '✅ Start Balance Set', `Starting bank balance set to **${s.currency} ${amt}**`);
    }

    if (command === 'add-money' && isOwnerOrAdmin) {
        const target = message.mentions.members.first();
        const amt = parseInt(args[1]);
        if (!target || isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!add-money @user <amount>`');
        const tu = getUser(guildId, target.id);
        tu.wallet += amt;
        return sendEmbed(message.channel, '✅ Cash Added', `Added **${s.currency} ${amt}** to ${target.user.tag}'s Wallet.`);
    }

    if (command === 'remove-money' && isOwnerOrAdmin) {
        const target = message.mentions.members.first();
        const amt = parseInt(args[1]);
        if (!target || isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!remove-money @user <amount>`');
        const tu = getUser(guildId, target.id);
        tu.wallet = Math.max(0, tu.wallet - amt);
        return sendEmbed(message.channel, '✅ Cash Removed', `Removed **${s.currency} ${amt}** from ${target.user.tag}'s Wallet.`);
    }

    if ((command === 'reset-money' || command === 'reset-economy') && isOwnerOrAdmin) {
        db.economy[guildId] = {};
        return sendEmbed(message.channel, '🔄 Economy Reset', 'All user balances have been reset to default.');
    }

    /* ================= 💰 ECONOMY & CASH ================= */

    const u = getUser(guildId, userId);

    if (command === 'balance' || command === 'bal') {
        const target = message.mentions.members.first() || message.member;
        const tu = getUser(guildId, target.id);
        return sendEmbed(message.channel, `🌸 Balance — ${target.user.username}`, '', [
            { name: '👛 Wallet', value: `**${s.currency} ${tu.wallet}**`, inline: true },
            { name: '🏦 Bank', value: `**${s.currency} ${tu.bank}**`, inline: true },
            { name: '✨ Total', value: `**${s.currency} ${tu.wallet + tu.bank}**`, inline: true }
        ]);
    }

    if (command === 'deposit' || command === 'dep') {
        const amt = args[0] === 'all' ? u.wallet : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.wallet < amt) return sendEmbed(message.channel, '❌ Error', 'Invalid amount or insufficient wallet cash.');
        u.wallet -= amt; u.bank += amt;
        return sendEmbed(message.channel, '🏦 Bank Deposit', `Deposited **${s.currency} ${amt}** into your Bank.`);
    }

    if (command === 'withdraw' || command === 'with') {
        const amt = args[0] === 'all' ? u.bank : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return sendEmbed(message.channel, '❌ Error', 'Invalid amount or insufficient bank cash.');
        u.wallet += amt; u.bank -= amt;
        return sendEmbed(message.channel, '🏪 Bank Withdraw', `Withdrew **${s.currency} ${amt}** from your Bank.`);
    }

    if (command === 'work') {
        const now = Date.now();
        if (now - u.lastWork < 60000) return sendEmbed(message.channel, '⏳ Cooldown', 'Please wait 1 minute before working again.');
        const earned = Math.floor(Math.random() * 100) + 50;
        u.wallet += earned; u.lastWork = now;
        return sendEmbed(message.channel, '💼 Work Completed', `You worked hard and earned **${s.currency} ${earned}**!`);
    }

    if (command === 'slut') {
        const now = Date.now();
        if (now - u.lastSlut < 120000) return sendEmbed(message.channel, '⏳ Cooldown', 'Please wait 2 minutes.');
        const earned = Math.floor(Math.random() * 150) + 30;
        u.wallet += earned; u.lastSlut = now;
        return sendEmbed(message.channel, '💋 Quick Cash', `You earned **${s.currency} ${earned}**!`);
    }

    if (command === 'rob') {
        const target = message.mentions.members.first();
        if (!target || target.id === userId) return sendEmbed(message.channel, '❌ Error', 'Mention a valid member to rob.');
        const tu = getUser(guildId, target.id);
        if (tu.wallet < 50) return sendEmbed(message.channel, '❌ Rob Failed', 'Target does not have enough cash in their Wallet!');
        
        const success = Math.random() > 0.5;
        if (success) {
            const stolen = Math.floor(tu.wallet * 0.3);
            tu.wallet -= stolen; u.wallet += stolen;
            return sendEmbed(message.channel, '🥷 Rob Successful', `You robbed **${s.currency} ${stolen}** from ${target.user.tag}!`);
        } else {
            const fine = 50;
            u.wallet = Math.max(0, u.wallet - fine);
            return sendEmbed(message.channel, '🚨 Caught!', `You were caught and fined **${s.currency} ${fine}**!`);
        }
    }

    if (command === 'give-money') {
        const target = message.mentions.members.first();
        const amt = parseInt(args[1]);
        if (!target || isNaN(amt) || amt <= 0 || u.wallet < amt) return sendEmbed(message.channel, '❌ Error', 'Invalid user or insufficient funds.');
        const tu = getUser(guildId, target.id);
        u.wallet -= amt; tu.wallet += amt;
        return sendEmbed(message.channel, '💸 Money Sent', `Transferred **${s.currency} ${amt}** to ${target.user.tag}.`);
    }

    /* ================= 🎲 CASINO & GAMES ================= */

    if (command === 'slot-machine' || command === 'slots') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || u.wallet < bet) return sendEmbed(message.channel, '❌ Error', 'Invalid bet amount.');
        
        const items = ['🌸', '💖', '💎', '🍓', '👑'];
        const c1 = items[Math.floor(Math.random() * items.length)];
        const c2 = items[Math.floor(Math.random() * items.length)];
        const c3 = items[Math.floor(Math.random() * items.length)];

        if (c1 === c2 && c2 === c3) {
            const win = bet * 5;
            u.wallet += win;
            return sendEmbed(message.channel, '🎰 Slots Jackpot!', `[ ${c1} | ${c2} | ${c3} ]\n\n🎉 You won **${s.currency} ${win}**!`);
        } else {
            u.wallet -= bet;
            return sendEmbed(message.channel, '🎰 Slots Result', `[ ${c1} | ${c2} | ${c3} ]\n\n❌ You lost **${s.currency} ${bet}**.`);
        }
    }

    /* ================= 🛡 MODERATION & WARN ================= */

    if (command === 'warn') {
        if (!hasModRole) return sendEmbed(message.channel, '❌ Denied', 'Moderator permission required.');
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Please mention a member.');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        const userWarns = getWarnings(guildId, target.id);
        userWarns.push({ reason, moderator: message.author.tag, date: new Date().toLocaleDateString() });
        return sendEmbed(message.channel, '⚠️ Member Warned', `**Member:** ${target.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${userWarns.length}`);
    }

    if (command === 'warnings' || command === 'warns') {
        const target = message.mentions.members.first() || message.member;
        const userWarns = getWarnings(guildId, target.id);
        if (userWarns.length === 0) return sendEmbed(message.channel, '🌸 Warnings', `**${target.user.tag}** has 0 warnings! ✨`);
        const list = userWarns.map((w, i) => `**#${i + 1}** | ${w.reason} *(By: ${w.moderator} on ${w.date})*`).join('\n');
        return sendEmbed(message.channel, `⚠️ Warnings — ${target.user.tag}`, list);
    }

    if (command === 'clearwarns') {
        if (!hasModRole) return sendEmbed(message.channel, '❌ Denied', 'Moderator permission required.');
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Please mention a member.');
        db.warnings[guildId][target.id] = [];
        return sendEmbed(message.channel, '✅ Warnings Cleared', `Cleared all warnings for **${target.user.tag}**.`);
    }

    if (command === 'ban') {
        if (!hasModRole) return sendEmbed(message.channel, '❌ Denied', 'Moderator permission required.');
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Please mention a member.');
        await target.ban({ reason: args.slice(1).join(' ') });
        return sendEmbed(message.channel, '🔨 Member Banned', `Successfully banned **${target.user.tag}**.`);
    }

    if (command === 'kick') {
        if (!hasModRole) return sendEmbed(message.channel, '❌ Denied', 'Moderator permission required.');
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Please mention a member.');
        await target.kick(args.slice(1).join(' '));
        return sendEmbed(message.channel, '🥾 Member Kicked', `Successfully kicked **${target.user.tag}**.`);
    }

    if (command === 'timeout') {
        if (!hasModRole) return sendEmbed(message.channel, '❌ Denied', 'Moderator permission required.');
        const target = message.mentions.members.first();
        const duration = parseDuration(args[1]);
        if (!target || !duration) return sendEmbed(message.channel, '❌ Error', 'Usage: `!timeout @user 1h` (1m, 1h, 1d, 1w, 1mo)');
        await target.timeout(duration);
        return sendEmbed(message.channel, '⏳ Timeout Applied', `Timed out **${target.user.tag}** for ${args[1]}.`);
    }

    /* ================= 🌸 ANIME REACTIONS ================= */

    if (['hug', 'kiss', 'pat', 'slap'].includes(command)) {
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Please mention a member!');

        const gifs = {
            hug: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z2eHk4NWptbjZ5dm55ZWExYm9idmR3dGFseXQ4NWVucThzcXpsMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/lrr925ELNknBW/giphy.gif',
            kiss: 'https://media.giphy.com/media/G3va39rn8E4A8/giphy.gif',
            pat: 'https://media.giphy.com/media/5tmRHw19bcmVG/giphy.gif',
            slap: 'https://media.giphy.com/media/m6aZERsqxQI12/giphy.gif'
        };

        const embed = new EmbedBuilder()
            .setTitle(`🌸 Anime Reaction — ${command.toUpperCase()}`)
            .setDescription(`**${message.author.username}** ${command}s **${target.user.username}**! ✨`)
            .setImage(gifs[command])
            .setColor(SOFT_PINK);

        return message.channel.send({ embeds: [embed] });
    }

    /* ================= 📢 AUTORESPONDER & MESSAGES ================= */

    if (command === 'autoresponder' && args[0] === 'add') {
        const full = args.slice(1).join(' ').split('|');
        if (full.length < 2) return sendEmbed(message.channel, '❌ Error', 'Usage: `!autoresponder add trigger | response`');
        if (!db.autoResponders[guildId]) db.autoResponders[guildId] = {};
        db.autoResponders[guildId][full[0].trim().toLowerCase()] = full[1].trim();
        return sendEmbed(message.channel, '✅ Autoresponder Added', `Trigger: **"${full[0].trim()}"**`);
    }
});

client.login(process.env.DISCORD_TOKEN);
