const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const CHECK_CHANNEL_ID = "1348756265219920024";
const DATA_FILE = './watering.json';

// Nuskaito duomenis iš failo
function loadWateringData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  }
  return {};
}

let wateringData = loadWateringData();

client.once('ready', async () => {
  console.log(`✅ Botas prisijungė kaip ${client.user.tag}`);

  const channel = await client.channels.fetch(CHECK_CHANNEL_ID).catch(err => console.error("❌ Neradau kanalo:", err));
  if (!channel) return;

  setInterval(() => {
    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle("🌿 Žolės lentelė")
      .setTimestamp()
      .setFooter({ text: "Automatinis atnaujinimas" });

    const grouped = {};

for (const userId in wateringData) {
  if (["lastUpdate", "lastMessageId", "lastDecreaseTime", "customSections"].includes(userId)) continue;
  for (const houseNumber in wateringData[userId]) {
    const house = wateringData[userId][houseNumber];
    if (!house || !house.owner) continue;
        if (!house?.owner) continue;
        if (!grouped[house.owner]) grouped[house.owner] = [];
        grouped[house.owner].push(`📌 Namas ${houseNumber}nr - 🌿 **${house.percent}%** | 🕒 **${house.plantDays} dienos**`);
      }
    }

    for (const owner in grouped) {
      embed.addFields({
        name: `🏡 ${owner} namai:`,
        value: grouped[owner].join("\n"),
        inline: false
      });
    }

    channel.send({ embeds: [embed] }).catch(console.error);
  }, 60 * 1000); // kas 1 minutę
});

client.on('messageCreate', message => {
  if (!message.content.startsWith('%') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;

  if (!wateringData[userId]) wateringData[userId] = {};

  if (command === 'addhouse') {
    const [number, ...ownerParts] = args;
    const owner = ownerParts.join(" ");
    if (!number || !owner) return message.reply("❌ Naudojimas: `%addhouse [namo nr] [savininkas]`");

    wateringData[userId][number] = { owner, percent: 150, plantDays: 1 };
    return message.reply(`✅ Namas ${number} pridėtas.`);
  }

  if (command === 'set') {
    const [number, percent, owner, days] = args;
    if (!number || !percent || !owner || !days) return message.reply("❌ Naudojimas: `%set [namo nr] [laistymo %] [savininkas] [dienos]`");

    wateringData[userId][number] = {
      owner,
      percent: parseInt(percent),
      plantDays: parseInt(days)
    };
    return message.reply(`✅ Namas ${number} atnaujintas.`);
  }

  if (command === 'check') {
    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle("🏠 Tavo namai")
      .setTimestamp()
      .setFooter({ text: "Tik tavo duomenys" });

    for (const houseNumber in wateringData[userId]) {
      const house = wateringData[userId][houseNumber];
      embed.addFields({
        name: `📌 ${house.owner}`,
        value: `🏠 Namas ${houseNumber}nr\n🌿 ${house.percent}% | 🕒 ${house.plantDays} dienos`,
        inline: false
      });
    }

    return message.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
