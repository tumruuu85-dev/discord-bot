const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Дата хадгалах
const db = {};

function getUser(userId) {
    if (!db[userId]) db[userId] = { wallet: 500, bank: 0 };
    return db[userId];
}

/* 1. DISCORD BOT COMMANDS */
const PREFIX = '!';

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const user = getUser(message.author.id);

    // !bal
    if (command === 'bal' || command === 'balance') {
        const embed = new EmbedBuilder()
            .setTitle(`💰 ${message.author.username}-н баланс`)
            .addFields(
                { name: 'Түрэвч', value: `$${user.wallet}`, inline: true },
                { name: 'Банк', value: `$${user.bank}`, inline: true }
            )
            .setColor('#f1c40f');
        return message.channel.send({ embeds: [embed] });
    }

    // !work
    if (command === 'work') {
        const earned = Math.floor(Math.random() * 150) + 50;
        user.wallet += earned;
        return message.reply(`🛠 Та ажиллаад **$${earned}** оллоо!`);
    }

    // !gamble
    if (command === 'gamble') {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) {
            return message.reply("❌ Буруу дүн байна.");
        }
        if (Math.random() >= 0.5) {
            user.wallet += bet;
            return message.reply(`🎉 Хожлоо! +$${bet}`);
        } else {
            user.wallet -= bet;
            return message.reply(`💸 Алдлаа! -$${bet}`);
        }
    }
});

/* 2. WEBSITE DASHBOARD */
app.get('/', (req, res) => {
    let rows = Object.keys(db).map(id => {
        return `<tr><td>${id}</td><td>$${db[id].wallet}</td><td>$${db[id].bank}</td></tr>`;
    }).join('');

    res.send(`
        <body style="background:#121212; color:white; font-family:sans-serif; padding:20px;">
            <h2>📱 Mobile Bot Dashboard</h2>
            <table border="1" cellpadding="10" style="border-collapse:collapse; width:100%;">
                <tr><th>User ID</th><th>Wallet</th><th>Bank</th></tr>
                ${rows || '<tr><td colspan="3">Одоогоор дата алга. Бот дээр !bal гэж бичнэ үү.</td></tr>'}
            </table>
        </body>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
