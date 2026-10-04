const { 
    Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, 
    REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const express = require('express');

// 🌐 Express Dashboard (Keep Alive for Render)
const app = express();
app.get('/', (req, res) => res.send('🌸 Soft Pink Aesthetic Bot is Running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web Dashboard online on port ${PORT}`));

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

// 💾 In-Memory Database Structure
const db = {
    settings: {}, // guildId -> config
    economy: {},  // guildId -> userId -> data
    warnings: {}, // guildId -> userId -> array of warnings
    store: {},    
    customReplies: {},
    autoResponders: {}
};

const SOFT_PINK = '#FFB6C1';

// Helper: Embed Creator
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
            logs: {}
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

function getWarnings(guildId, userId) {
    if (!db.warnings[guildId]) db.warnings[guildId] = {};
    if (!db.warnings[guildId][userId]) db.warnings[guildId][userId] = [];
    return db.warnings[guildId][userId];
}

/* ==================== SLASH COMMANDS ==================== */

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

/* ==================== COMMAND HANDLER ==================== */

const PREFIXES = ['!', 'c!', 'C!', '&!', 'c&!', 'C&!'];

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const s = getSettings(guildId);

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

    /* ================= 📖 CHELP COMMAND ================= */

    if (command === 'chelp' || command === 'help') {
        const fields = [
            {
                name: '👑 Administrator Management',
                value: '`!add-modrole @role` - Assign moderation role\n`!set-currency <symbol>` - Set server cash emoji\n`!set-start-balance <amount>` - Default starting bank\n`!add-money @user <amt>` - Add cash to user\n`!remove-money @user <amt>` - Remove cash\n`!reset-economy` - Reset all server balances'
            },
            {
                name: '🛡 Moderation & Warning System',
                value: '`!warn @user [reason]` - Issue a warning to a member\n`!warnings @user` - View member warning history\n`!clearwarns @user` - Clear all warnings of a user\n`!ban @user` - Ban a member\n`!kick @user` - Kick a member\n`!timeout @user <time>` - Mute member (e.g. 1h, 1d)\n`!temp-role @user @role <time>` - Give temporary role'
            },
            {
                name: '💰 Economy & Cash',
                value: '`!bal` / `!balance` - View Wallet and Bank cash\n`!dep <amt>` / `!with <amt>` - Bank deposit or withdraw\n`!work` / `!slut` / `!crime` - Earn cash\n`!rob @user` - Attempt to steal money\n`!give-money @user <amt>` - Transfer cash'
            },
            {
                name: '🎲 Casino & Gaming',
                value: '`!blackjack` (`!bj`) - Play Blackjack card game\n`!higher-lower` (`!hl`) - Guess higher or lower\n`!roulette` - Bet on red or black\n`!russian-roulette` - High risk cash game\n`!slot-machine` (`!slots`) - Spin the slot machine'
            },
            {
                name: '🌸 Anime Reactions (OwO/Mimu)',
                value: '`!hug @user` - Send an anime hug GIF\n`!kiss @user` - Send a kiss reaction\n`!pat @user` - Headpat a member\n`!slap @user` - Slap someone gently'
            }
        ];

        return sendEmbed(message.channel, '🌸 ✨ Aesthetic Bot Command List ✨ 🌸', 'Supported Prefixes: `!`, `c!`, `C!`, `&!`, `c&!`, `C&!` and `/` Slash Commands', fields);
    }

    /* ================= 🛡 MODERATION & WARN SYSTEM ================= */

    if (command === 'warn') {
        if (!hasModRole) return sendEmbed(message.channel, '❌ Permission Denied', 'You need Moderator permissions to use this command.');
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Please mention a member to warn.');
        
        const reason = args.slice(1).join(' ') || 'No reason provided';
        const userWarns = getWarnings(guildId, target.id);
        
        userWarns.push({
            reason: reason,
            moderator: message.author.tag,
            date: new Date().toLocaleDateString()
        });

        return sendEmbed(message.channel, '⚠️ Member Warned', `**Member:** ${target.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${userWarns.length}`);
    }

    if (command === 'warnings' || command === 'warns') {
        const target = message.mentions.members.first() || message.member;
        const userWarns = getWarnings(guildId, target.id);

        if (userWarns.length === 0) {
            return sendEmbed(message.channel, '🌸 Warning History', `**${target.user.tag}** has no warnings! ✨`);
        }

        const warningList = userWarns.map((w, index) => `**#${index + 1}** | **Reason:** ${w.reason} *(By: ${w.moderator} on ${w.date})*`).join('\n');
        return sendEmbed(message.channel, `⚠️ Warnings for ${target.user.tag}`, warningList);
    }

    if (command === 'clearwarns' || command === 'clearwarnings') {
        if (!hasModRole) return sendEmbed(message.channel, '❌ Permission Denied', 'You need Moderator permissions to clear warnings.');
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Please mention a member to clear warnings.');

        db.warnings[guildId][target.id] = [];
        return sendEmbed(message.channel, '✅ Warnings Cleared', `Successfully cleared all warnings for **${target.user.tag}**.`);
    }

    /* ================= 👑 ADMIN COMMANDS ================= */

    if (command === 'add-modrole' && isOwnerOrAdmin) {
        const role = message.mentions.roles.first();
        if (!role) return sendEmbed(message.channel, '❌ Error', 'Please mention a valid role.');
        s.mod_role = role.id;
        return sendEmbed(message.channel, '✅ Mod Role Set', `Moderator commands can now be used by **${role.name}**.`);
    }

    /* ================= 💰 ECONOMY COMMANDS ================= */

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
        return sendEmbed(message.channel, '🏦 Bank Deposit', `Successfully deposited **${s.currency} ${amt}** into your Bank.`);
    }

    if (command === 'withdraw' || command === 'with') {
        const amt = args[0] === 'all' ? u.bank : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return sendEmbed(message.channel, '❌ Error', 'Invalid amount or insufficient bank cash.');
        u.wallet += amt; u.bank -= amt;
        return sendEmbed(message.channel, '🏪 Bank Withdraw', `Successfully withdrew **${s.currency} ${amt}** from your Bank.`);
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
});

client.login(process.env.DISCORD_TOKEN);
