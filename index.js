const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");

// ==============================
// CONFIG
// ==============================

const TOKEN = "YOUR_BOT_TOKEN";
const CLIENT_ID = "YOUR_CLIENT_ID";

// Soft Pink
const PINK = 0xF7A8C4;

// Prefixes
const PREFIXES = ["C", "C&", "&"];

// ==============================
// DATABASE
// ==============================

const DB_FILE = "./database.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      {
        users: {},
        guilds: {}
      },
      null,
      2
    )
  );
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(db, guildId, userId) {
  if (!db.users[guildId]) {
    db.users[guildId] = {};
  }

  if (!db.users[guildId][userId]) {
    db.users[guildId][userId] = {
      cash: 0,
      bank: 0,
      inventory: []
    };
  }

  return db.users[guildId][userId];
}

// ==============================
// CLIENT
// ==============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// ==============================
// EMBED
// ==============================

function economyEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(PINK)
    .setTitle(`♡ ${title}`)
    .setDescription(description)
    .setFooter({
      text: "Aesthetic Economy • Soft Pink"
    })
    .setTimestamp();
}

// ==============================
// SLASH COMMAND
// ==============================

const balanceCommand = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("View your wallet and bank balance."),

  async execute(interaction) {
    const db = loadDB();

    const user = getUser(
      db,
      interaction.guild.id,
      interaction.user.id
    );

    saveDB(db);

    const currency =
      db.guilds[interaction.guild.id]?.currency || "$";

    const embed = economyEmbed(
      "Balance",
      `**${interaction.user.username}**'s economy balance.\n\n` +
      `💵 Wallet: **${currency}${user.cash}**\n` +
      `🏦 Bank: **${currency}${user.bank}**\n\n` +
      `💰 Total: **${currency}${user.cash + user.bank}**`
    );

    await interaction.reply({
      embeds: [embed]
    });
  }
};

// ==============================
// REGISTER COMMAND
// ==============================

client.commands.set(
  balanceCommand.data.name,
  balanceCommand
);

// ==============================
// PREFIX COMMANDS
// ==============================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  let prefix = null;

  // Cbal
  if (message.content.startsWith("C")) {
    prefix = "C";
  }

  // C&bal
  if (message.content.startsWith("C&")) {
    prefix = "C&";
  }

  // &bal
  if (message.content.startsWith("&")) {
    prefix = "&";
  }

  if (!prefix) return;

  const commandName = message.content
    .slice(prefix.length)
    .trim()
    .toLowerCase();

  // ============================
  // BALANCE
  // ============================

  if (["bal", "balance"].includes(commandName)) {
    const db = loadDB();

    const user = getUser(
      db,
      message.guild.id,
      message.author.id
    );

    saveDB(db);

    const currency =
      db.guilds[message.guild.id]?.currency || "$";

    const embed = economyEmbed(
      "Balance",
      `**${message.author.username}**'s economy balance.\n\n` +
      `💵 Wallet: **${currency}${user.cash}**\n` +
      `🏦 Bank: **${currency}${user.bank}**\n\n` +
      `💰 Total: **${currency}${user.cash + user.bank}**`
    );

    return message.reply({
      embeds: [embed]
    });
  }
});

// ==============================
// READY
// ==============================

client.once("ready", async () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🩷 Logged in as ${client.user.tag}`);
  console.log(`🌸 Servers: ${client.guilds.cache.size}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const rest = new REST({ version: "10" })
    .setToken(TOKEN);

  try {
    for (const guild of client.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(
          CLIENT_ID,
          guild.id
        ),
        {
          body: [
            balanceCommand.data.toJSON()
          ]
        }
      );
    }

    console.log("🩷 Slash commands registered.");
  } catch (error) {
    console.error(error);
  }
});

// ==============================
// ERROR HANDLING
// ==============================

client.on("error", console.error);

process.on("unhandledRejection", console.error);

// ==============================
// LOGIN
// ==============================

client.login(TOKEN);
