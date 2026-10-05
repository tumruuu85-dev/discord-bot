const { 
    Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, 
    REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const express = require('express');

// 🌐 Keep Alive for Render
const app = express();
app.get('/', (req, res) => res.send('🌸 Bot is Running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server active on port ${PORT}`));

// 🤖 Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const EMBED_COLOR = '#fcccff';

// 🖼️ CHELP COMMAND IMAGE LINK
const CHELP_IMAGE_URL = "https://cdn.discordapp.com/attachments/1555527991436517448/1556583009061441617/IMG_3894.jpg?backend=b2&ex=6ac4b065&is=6ac35ee5&hm=7bee263a7e5802dc769eeeeb13d251344f2416f95f1026e6577fb61eb38643f4&";

// 💾 In-Memory Database Structure
const db = {
    settings: {},      
    economy: {},       
    warnings: {},      
    store: {},         
    inventory: {},     
    autoResponders: {},
    customReplies: {}, 
    counting: {},      
    roleIncome: {},    
    tempRoles: []      
};

function getSettings(guildId) {
    if (!db.settings[guildId]) {
        db.settings[guildId] = {
            currency: '🌸',
            start_balance: 100,
            bet_limit: { min: 10, max: 10000 },
            blackjack_decks: 1,
            game_cooldown: 5000,
            chat_money: { min: 1, max: 10, cooldown: 60000 },
            money_audit_log: null,
            cooldowns: { work: 60000, crime: 120000, slut: 120000 }
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
            lastCrime: 0,
            lastSlut: 0,
            lastChatMoney: 0
        };
    }
    return db.economy[guildId][userId];
}

// 🌸 Custom Embed Function with Image Support
function sendEmbed(channel, title, description, fields = [], imageUrl = null) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description || null)
        .setColor(EMBED_COLOR)
        .setTimestamp();
    
    if (fields.length > 0) embed.addFields(fields);
    if (imageUrl) embed.setImage(imageUrl);

    return channel.send({ embeds: [embed] });
}

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
    new SlashCommandBuilder().setName('chelp').setDescription('Show command list and help menu'),
    new SlashCommandBuilder().setName('bal').setDescription('Check Wallet and Bank balance').addUserOption(o => o.setName('user').setDescription('Target user')),
    new SlashCommandBuilder().setName('work').setDescription('Work to earn cash'),
    new SlashCommandBuilder().setName('dep').setDescription('Deposit cash to Bank').addStringOption(o => o.setName('amount').setDescription('Amount or all').setRequired(true)),
    new SlashCommandBuilder().setName('with').setDescription('Withdraw cash from Bank').addStringOption(o => o.setName('amount').setDescription('Amount or all').setRequired(true)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('View server info'),
    new SlashCommandBuilder().setName('info').setDescription('View user account info').addUserOption(o => o.setName('user').setDescription('Target user'))
];

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Slash Commands registered successfully!');
    } catch (e) {
        console.error('Slash registration error:', e);
    }
});

/* ==================== MESSAGE & COMMAND HANDLER ==================== */

const PREFIXES = ['!', 'c!', 'c&!', '&!', 'cbal', 'c&bal', '&bal'];

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const s = getSettings(guildId);
    const u = getUser(guildId, userId);

    // 1. Counting Channel Logic
    if (db.counting[guildId] && db.counting[guildId].channelId === message.channel.id) {
        const inputNum = parseInt(message.content.trim());
        const expected = db.counting[guildId].current + 1;
        if (!isNaN(inputNum) && inputNum === expected) {
            db.counting[guildId].current = expected;
            message.react('✅');
        } else {
            message.react('❌');
            message.channel.send(`❌ Wrong number! Counting reset back to 0. Next number is 1.`);
            db.counting[guildId].current = 0;
        }
        return;
    }

    // 2. Chat Money System
    const now = Date.now();
    if (now - u.lastChatMoney > s.chat_money.cooldown) {
        const reward = Math.floor(Math.random() * (s.chat_money.max - s.chat_money.min + 1)) + s.chat_money.min;
        u.wallet += reward;
        u.lastChatMoney = now;
    }

    // 3. Autoresponder Check
    if (db.autoResponders[guildId] && db.autoResponders[guildId][message.content.toLowerCase()]) {
        return message.channel.send(db.autoResponders[guildId][message.content.toLowerCase()]);
    }

    // 4. Prefix Matching
    const content = message.content.trim();
    let usedPrefix = null;

    for (const p of PREFIXES) {
        if (content.toLowerCase().startsWith(p.toLowerCase())) {
            usedPrefix = p;
            break;
        }
    }

    let command = '';
    let args = [];

    if (usedPrefix) {
        if (['cbal', 'c&bal', '&bal'].includes(usedPrefix.toLowerCase())) {
            command = 'bal';
            args = content.slice(usedPrefix.length).trim().split(/ +/).filter(x => x);
        } else {
            args = content.slice(usedPrefix.length).trim().split(/ +/);
            command = args.shift().toLowerCase();
        }
    } else {
        return;
    }

    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.guild.ownerId === userId;

    /* ================= 📖 CHELP COMMAND (WITH IMAGE) ================= */

    if (command === 'chelp' || command === 'help') {
        const fields = [
            {
                name: '👑 Administrator',
                value: '`!set-currency <symbol>` - Set currency symbol\n`!set-start-balance <amt>` - Set initial bank balance\n`!set-bet-limit <min> <max>` - Set min/max betting limits\n`!set-blackjak-decks <num>` - Set Blackjack card decks\n`!set-game-cooldown <ms>` - Set game cooldown\n`!set-cooldown <type> <ms>` - Set work/crime/slut cooldowns\n`!role-income add/remove <@role> <amt>` - Role salary setup\n`!Money-audit-log <#channel>` - Money log channel\n`!chat-money-amount <min> <max>` - Set chat earnings\n`!chat-money-cooldown <ms>` - Chat earnings delay\n`!add-money <@user> <amt>` - Add cash to user\n`!remove-money <@user> <amt>` - Remove cash from user\n`!add-money-role <@role> <amt>` - Add cash to role\n`!remove-money-role <@role> <amt>` - Remove cash from role\n`!reset-money` / `!reset-economy` - Reset server economy'
            },
            {
                name: '🛡 Moderation & Security',
                value: '`!ban <@user>` - Ban a member from server\n`!kick <@user>` - Kick a member from server\n`!timeout <@user> <time>` - Mute member (e.g. 1h, 1d)\n`!temp-role <@user> <@role> <time>` - Give temporary role\n`!lock` - Lock current channel\n`!unlock` - Unlock current channel\n`!reaction-role <#channel> <msgID> <emoji> <@role>` - Create reaction role'
            },
            {
                name: '💰 Economy & Banking',
                value: '`!balance` (`!bal`, `Cbal`, `&bal`) - View Wallet and Bank\n`!deposit` (`!dep`) `<amt/all>` - Deposit cash to Bank\n`!withdraw` (`!with`) `<amt/all>` - Withdraw cash from Bank\n`!work` - Earn money working\n`!slut` - Earn quick cash\n`!rob <@user>` - Attempt robbery\n`!give-money <@user> <amt>` - Transfer cash\n`!Collect-income` - Collect role salary'
            },
            {
                name: '🎲 Casino & Gaming',
                value: '`!blackjack` - Play Blackjack card game\n`!higher-lower` - Guess higher or lower\n`!roulette <color> <amt>` - Play Roulette\n`!russian-roulette` - High-risk survival game\n`!slot-machine <amt>` - Spin slot machine\n`!counting <#channel>` - Setup counting channel'
            },
            {
                name: '🛒 Store & Items',
                value: '`!store` - View server shop\n`!create-item <name> <price>` - Create shop item\n`!edit-item <name> <price>` - Edit shop item price\n`!delete-item <name>` - Delete shop item\n`!item-info <name>` - View item details\n`!buy-item <name>` - Purchase item\n`!sell-item <name>` - Sell item from inventory\n`!give-item <@user> <name>` - Gift item to user'
            },
            {
                name: '📢 Customization & Replies',
                value: '`!add-reply <work/crime/slut> <text>` - Add win message\n`!add-fail-reply <work/crime/slut> <text>` - Add fail message\n`!list-custom-replies` - View custom responses\n`!delete-reply <type> <index>` - Delete response\n`!autoresponder add <trigger> | <response>` - Set auto-reply'
            },
            {
                name: 'ℹ️ Server & User Info',
                value: '`!info <@user>` - User account & role info\n`!serverinfo` - View server statistics'
            }
        ];

        return sendEmbed(
            message.channel, 
            '✨ Command List & Guide ✨', 
            'Supported Prefixes: `!`, `c!`, `c&!`, `&!`, `Cbal`, `&bal` and `/` Slash Commands', 
            fields, 
            CHELP_IMAGE_URL // <--- Зураг давхар Embed-д харагдана
        );
    }

    /* ================= 👑 ADMIN COMMANDS ================= */

    if (command === 'set-currency' && isAdmin) {
        if (!args[0]) return sendEmbed(message.channel, '❌ Error', 'Usage: `!set-currency <symbol>`');
        s.currency = args[0];
        return sendEmbed(message.channel, '✅ Currency Set', `Currency symbol updated to **${s.currency}**`);
    }

    if (command === 'set-start-balance' && isAdmin) {
        const amt = parseInt(args[0]);
        if (isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Invalid amount.');
        s.start_balance = amt;
        return sendEmbed(message.channel, '✅ Balance Updated', `Starting bank balance set to **${s.currency} ${amt}**`);
    }

    if (command === 'set-bet-limit' && isAdmin) {
        const min = parseInt(args[0]); const max = parseInt(args[1]);
        if (isNaN(min) || isNaN(max)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!set-bet-limit <min> <max>`');
        s.bet_limit = { min, max };
        return sendEmbed(message.channel, '✅ Bet Limits Updated', `Betting limits set to Min: **${min}** | Max: **${max}**`);
    }

    if (command === 'set-blackjak-decks' && isAdmin) {
        const decks = parseInt(args[0]);
        if (isNaN(decks)) return sendEmbed(message.channel, '❌ Error', 'Specify deck count.');
        s.blackjack_decks = decks;
        return sendEmbed(message.channel, '✅ Decks Updated', `Blackjack deck count set to **${decks}**`);
    }

    if (command === 'set-game-cooldown' && isAdmin) {
        const ms = parseInt(args[0]);
        if (isNaN(ms)) return sendEmbed(message.channel, '❌ Error', 'Specify time in milliseconds.');
        s.game_cooldown = ms;
        return sendEmbed(message.channel, '✅ Cooldown Set', `Game cooldown set to **${ms}ms**`);
    }

    if (command === 'set-cooldown' && isAdmin) {
        const type = args[0]?.toLowerCase(); const ms = parseInt(args[1]);
        if (!['work', 'crime', 'slut'].includes(type) || isNaN(ms)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!set-cooldown <work/crime/slut> <ms>`');
        s.cooldowns[type] = ms;
        return sendEmbed(message.channel, '✅ Cooldown Updated', `${type.toUpperCase()} cooldown set to **${ms}ms**`);
    }

    if (command === 'role-income' && isAdmin) {
        const action = args[0]; const role = message.mentions.roles.first(); const amt = parseInt(args[2]);
        if (!['add', 'remove'].includes(action) || !role || isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!role-income <add/remove> <@role> <amount>`');
        if (!db.roleIncome[guildId]) db.roleIncome[guildId] = {};
        if (action === 'add') db.roleIncome[guildId][role.id] = amt;
        else delete db.roleIncome[guildId][role.id];
        return sendEmbed(message.channel, '✅ Role Income Updated', `Role **${role.name}** income set to **${s.currency} ${amt}**`);
    }

    if (command === 'money-audit-log' && isAdmin) {
        const channel = message.mentions.channels.first();
        if (!channel) return sendEmbed(message.channel, '❌ Error', 'Please mention a channel.');
        s.money_audit_log = channel.id;
        return sendEmbed(message.channel, '✅ Audit Log Channel Set', `Money audit logs will be sent to ${channel}`);
    }

    if (command === 'chat-money-amount' && isAdmin) {
        const min = parseInt(args[0]); const max = parseInt(args[1]);
        if (isNaN(min) || isNaN(max)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!chat-money-amount <min> <max>`');
        s.chat_money.min = min; s.chat_money.max = max;
        return sendEmbed(message.channel, '✅ Chat Earnings Updated', `Chat earnings range: **${min} - ${max}**`);
    }

    if (command === 'chat-money-cooldown' && isAdmin) {
        const ms = parseInt(args[0]);
        if (isNaN(ms)) return sendEmbed(message.channel, '❌ Error', 'Specify milliseconds.');
        s.chat_money.cooldown = ms;
        return sendEmbed(message.channel, '✅ Chat Cooldown Updated', `Chat earnings cooldown set to **${ms}ms**`);
    }

    if (command === 'add-money' && isAdmin) {
        const target = message.mentions.members.first(); const amt = parseInt(args[1]);
        if (!target || isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!add-money <@user> <amount>`');
        const tu = getUser(guildId, target.id); tu.wallet += amt;
        return sendEmbed(message.channel, '✅ Money Added', `Added **${s.currency} ${amt}** to ${target.user.tag}'s Wallet.`);
    }

    if (command === 'remove-money' && isAdmin) {
        const target = message.mentions.members.first(); const amt = parseInt(args[1]);
        if (!target || isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!remove-money <@user> <amount>`');
        const tu = getUser(guildId, target.id); tu.wallet = Math.max(0, tu.wallet - amt);
        return sendEmbed(message.channel, '✅ Money Removed', `Removed **${s.currency} ${amt}** from ${target.user.tag}'s Wallet.`);
    }

    if (command === 'add-money-role' && isAdmin) {
        const role = message.mentions.roles.first(); const amt = parseInt(args[1]);
        if (!role || isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!add-money-role <@role> <amount>`');
        role.members.forEach(m => { const tu = getUser(guildId, m.id); tu.wallet += amt; });
        return sendEmbed(message.channel, '✅ Mass Cash Added', `Added **${s.currency} ${amt}** to all members with role **${role.name}**.`);
    }

    if (command === 'remove-money-role' && isAdmin) {
        const role = message.mentions.roles.first(); const amt = parseInt(args[1]);
        if (!role || isNaN(amt)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!remove-money-role <@role> <amount>`');
        role.members.forEach(m => { const tu = getUser(guildId, m.id); tu.wallet = Math.max(0, tu.wallet - amt); });
        return sendEmbed(message.channel, '✅ Mass Cash Removed', `Removed **${s.currency} ${amt}** from all members with role **${role.name}**.`);
    }

    if ((command === 'reset-money' || command === 'reset-economy') && isAdmin) {
        db.economy[guildId] = {};
        return sendEmbed(message.channel, '🔄 Economy Reset', 'Server economy has been completely reset.');
    }

    /* ================= 💰 ECONOMY & BANKING ================= */

    if (command === 'balance' || command === 'bal') {
        const target = message.mentions.members.first() || message.member;
        const tu = getUser(guildId, target.id);
        return sendEmbed(message.channel, `Balance — ${target.user.username}`, null, [
            { name: 'Wallet', value: `**${s.currency} ${tu.wallet}**`, inline: true },
            { name: 'Bank', value: `**${s.currency} ${tu.bank}**`, inline: true },
            { name: 'Total', value: `**${s.currency} ${tu.wallet + tu.bank}**`, inline: true }
        ]);
    }

    if (command === 'deposit' || command === 'dep') {
        const amt = args[0] === 'all' ? u.wallet : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.wallet < amt) return sendEmbed(message.channel, '❌ Error', 'Invalid amount or insufficient Wallet funds.');
        u.wallet -= amt; u.bank += amt;
        return sendEmbed(message.channel, '🏦 Bank Deposit', `Deposited **${s.currency} ${amt}** into your Bank.`);
    }

    if (command === 'withdraw' || command === 'with') {
        const amt = args[0] === 'all' ? u.bank : parseInt(args[0]);
        if (isNaN(amt) || amt <= 0 || u.bank < amt) return sendEmbed(message.channel, '❌ Error', 'Invalid amount or insufficient Bank funds.');
        u.wallet += amt; u.bank -= amt;
        return sendEmbed(message.channel, '🏪 Bank Withdraw', `Withdrew **${s.currency} ${amt}** from your Bank.`);
    }

    if (command === 'work') {
        if (now - u.lastWork < s.cooldowns.work) return sendEmbed(message.channel, '⏳ Cooldown', 'Please wait before working again.');
        const earned = Math.floor(Math.random() * 100) + 50;
        u.wallet += earned; u.lastWork = now;
        return sendEmbed(message.channel, '💼 Work Completed', `You worked hard and earned **${s.currency} ${earned}**!`);
    }

    if (command === 'slut') {
        if (now - u.lastSlut < s.cooldowns.slut) return sendEmbed(message.channel, '⏳ Cooldown', 'Please wait before trying again.');
        const earned = Math.floor(Math.random() * 150) + 30;
        u.wallet += earned; u.lastSlut = now;
        return sendEmbed(message.channel, '💋 Quick Cash', `You earned **${s.currency} ${earned}**!`);
    }

    if (command === 'rob') {
        const target = message.mentions.members.first();
        if (!target || target.id === userId) return sendEmbed(message.channel, '❌ Error', 'Mention a valid user to rob.');
        const tu = getUser(guildId, target.id);
        if (tu.wallet < 50) return sendEmbed(message.channel, '❌ Rob Failed', 'Target does not have enough cash in Wallet!');
        const success = Math.random() > 0.5;
        if (success) {
            const stolen = Math.floor(tu.wallet * 0.3); tu.wallet -= stolen; u.wallet += stolen;
            return sendEmbed(message.channel, '🥷 Rob Successful', `You robbed **${s.currency} ${stolen}** from ${target.user.tag}!`);
        } else {
            const fine = 50; u.wallet = Math.max(0, u.wallet - fine);
            return sendEmbed(message.channel, '🚨 Caught!', `You were caught and fined **${s.currency} ${fine}**!`);
        }
    }

    if (command === 'give-money') {
        const target = message.mentions.members.first(); const amt = parseInt(args[1]);
        if (!target || isNaN(amt) || amt <= 0 || u.wallet < amt) return sendEmbed(message.channel, '❌ Error', 'Invalid amount or insufficient funds.');
        const tu = getUser(guildId, target.id); u.wallet -= amt; tu.wallet += amt;
        return sendEmbed(message.channel, '💸 Transfer Completed', `Transferred **${s.currency} ${amt}** to ${target.user.tag}.`);
    }

    if (command === 'collect-income') {
        if (!db.roleIncome[guildId]) return sendEmbed(message.channel, '❌ Info', 'No role income setup on this server.');
        let totalEarned = 0;
        for (const [roleId, income] of Object.entries(db.roleIncome[guildId])) {
            if (message.member.roles.cache.has(roleId)) totalEarned += income;
        }
        if (totalEarned === 0) return sendEmbed(message.channel, '❌ Info', 'You do not have any roles with fixed income.');
        u.wallet += totalEarned;
        return sendEmbed(message.channel, '💵 Salary Collected', `Collected **${s.currency} ${totalEarned}** from your role salaries!`);
    }

    /* ================= 🎲 CASINO & GAMES ================= */

    if (command === 'slot-machine') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < s.bet_limit.min || bet > s.bet_limit.max || u.wallet < bet) return sendEmbed(message.channel, '❌ Error', `Bet between **${s.bet_limit.min}** and **${s.bet_limit.max}**.`);
        const items = ['🌸', '💖', '💎', '🍓', '👑'];
        const c1 = items[Math.floor(Math.random() * items.length)];
        const c2 = items[Math.floor(Math.random() * items.length)];
        const c3 = items[Math.floor(Math.random() * items.length)];
        if (c1 === c2 && c2 === c3) {
            const win = bet * 5; u.wallet += win;
            return sendEmbed(message.channel, '🎰 Jackpot!', `[ ${c1} | ${c2} | ${c3} ]\n\n🎉 You won **${s.currency} ${win}**!`);
        } else {
            u.wallet -= bet;
            return sendEmbed(message.channel, '🎰 Slots Result', `[ ${c1} | ${c2} | ${c3} ]\n\n❌ You lost **${s.currency} ${bet}**.`);
        }
    }

    if (command === 'roulette') {
        const color = args[0]?.toLowerCase(); const bet = parseInt(args[1]);
        if (!['red', 'black'].includes(color) || isNaN(bet) || u.wallet < bet) return sendEmbed(message.channel, '❌ Error', 'Usage: `!roulette <red/black> <amount>`');
        const outcome = Math.random() > 0.5 ? 'red' : 'black';
        if (color === outcome) {
            u.wallet += bet;
            return sendEmbed(message.channel, '🎡 Roulette Win!', `Wheel landed on **${outcome.toUpperCase()}**! You won **${s.currency} ${bet}**!`);
        } else {
            u.wallet -= bet;
            return sendEmbed(message.channel, '🎡 Roulette Loss', `Wheel landed on **${outcome.toUpperCase()}**! You lost **${s.currency} ${bet}**.`);
        }
    }

    if (command === 'counting' && isAdmin) {
        const channel = message.mentions.channels.first();
        if (!channel) return sendEmbed(message.channel, '❌ Error', 'Mention a channel for counting.');
        db.counting[guildId] = { channelId: channel.id, current: 0 };
        return sendEmbed(message.channel, '🔢 Counting Channel Setup', `Counting channel set to ${channel}. Start with 1!`);
    }

    /* ================= 🛒 STORE & ITEMS ================= */

    if (command === 'create-item' && isAdmin) {
        const name = args[0]; const price = parseInt(args[1]);
        if (!name || isNaN(price)) return sendEmbed(message.channel, '❌ Error', 'Usage: `!create-item <name> <price>`');
        if (!db.store[guildId]) db.store[guildId] = [];
        db.store[guildId].push({ name, price });
        return sendEmbed(message.channel, '🛒 Item Created', `Created **${name}** for **${s.currency} ${price}**`);
    }

    if (command === 'store') {
        const items = db.store[guildId] || [];
        if (items.length === 0) return sendEmbed(message.channel, '🛒 Server Shop', 'The shop is currently empty.');
        const list = items.map((it, i) => `**#${i + 1} ${it.name}** — ${s.currency} ${it.price}`).join('\n');
        return sendEmbed(message.channel, '🛒 Server Shop', list);
    }

    if (command === 'buy-item') {
        const name = args[0]; const items = db.store[guildId] || [];
        const item = items.find(it => it.name.toLowerCase() === name?.toLowerCase());
        if (!item) return sendEmbed(message.channel, '❌ Error', 'Item not found in store.');
        if (u.wallet < item.price) return sendEmbed(message.channel, '❌ Error', 'Insufficient wallet cash.');
        u.wallet -= item.price;
        if (!db.inventory[guildId]) db.inventory[guildId] = {};
        if (!db.inventory[guildId][userId]) db.inventory[guildId][userId] = [];
        db.inventory[guildId][userId].push(item.name);
        return sendEmbed(message.channel, '🛍 Purchased', `Bought **${item.name}** for **${s.currency} ${item.price}**!`);
    }

    /* ================= 🛡 MODERATION & SECURITY ================= */

    if (command === 'ban' && isAdmin) {
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Mention a member.');
        await target.ban({ reason: args.slice(1).join(' ') });
        return sendEmbed(message.channel, '🔨 Banned', `Banned **${target.user.tag}**.`);
    }

    if (command === 'kick' && isAdmin) {
        const target = message.mentions.members.first();
        if (!target) return sendEmbed(message.channel, '❌ Error', 'Mention a member.');
        await target.kick(args.slice(1).join(' '));
        return sendEmbed(message.channel, '🥾 Kicked', `Kicked **${target.user.tag}**.`);
    }

    if (command === 'timeout' && isAdmin) {
        const target = message.mentions.members.first(); const duration = parseDuration(args[1]);
        if (!target || !duration) return sendEmbed(message.channel, '❌ Error', 'Usage: `!timeout <@user> <time>` (e.g. 1h, 1d)');
        await target.timeout(duration);
        return sendEmbed(message.channel, '⏳ Timeout', `Timed out **${target.user.tag}** for ${args[1]}.`);
    }

    if (command === 'temp-role' && isAdmin) {
        const target = message.mentions.members.first(); const role = message.mentions.roles.first(); const duration = parseDuration(args[2]);
        if (!target || !role || !duration) return sendEmbed(message.channel, '❌ Error', 'Usage: `!temp-role <@user> <@role> <time>` (e.g. 30d)');
        await target.roles.add(role);
        setTimeout(async () => { await target.roles.remove(role).catch(() => {}); }, duration);
        return sendEmbed(message.channel, '🎭 Temporary Role', `Assigned **${role.name}** to **${target.user.tag}** for ${args[2]}.`);
    }

    if (command === 'lock' && isAdmin) {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return sendEmbed(message.channel, '🔒 Channel Locked', 'Members can no longer send messages in this channel.');
    }

    if (command === 'unlock' && isAdmin) {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
        return sendEmbed(message.channel, '🔓 Channel Unlocked', 'Members can now send messages in this channel.');
    }

    /* ================= ℹ️ INFO COMMANDS ================= */

    if (command === 'info') {
        const target = message.mentions.members.first() || message.member;
        const roles = target.roles.cache.map(r => r.name).filter(r => r !== '@everyone').join(', ') || 'None';
        return sendEmbed(message.channel, `User Info — ${target.user.tag}`, null, [
            { name: 'Account Created', value: target.user.createdAt.toDateString(), inline: true },
            { name: 'Joined Server', value: target.joinedAt.toDateString(), inline: true },
            { name: 'Roles', value: roles, inline: false }
        ]);
    }

    if (command === 'serverinfo') {
        return sendEmbed(message.channel, `Server Info — ${message.guild.name}`, null, [
            { name: 'Total Members', value: `${message.guild.memberCount}`, inline: true },
            { name: 'Created On', value: message.guild.createdAt.toDateString(), inline: true },
            { name: 'Owner', value: `<@${message.guild.ownerId}>`, inline: true }
        ]);
    }
});

client.login(process.env.DISCORD_TOKEN);
