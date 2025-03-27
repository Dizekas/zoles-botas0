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

function loadWateringData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE));
      console.log("✅ watering.json sėkmingai nuskaitytas");
      return data;
    }
    console.warn("⚠️ watering.json failas nerastas.");
  } catch (err) {
    console.error("❌ Klaida skaitant watering.json:", err.message);
  }
  return {};
}

let wateringData = loadWateringData();

client.once('ready', async () => {
  console.log(`✅ Botas prisijungė kaip ${client.user.tag}`);

  const channel = await client.channels.fetch(CHECK_CHANNEL_ID).catch(err => {
    console.error("❌ Neradau kanalo:", err.message);
  });
  if (!channel) return;

  setInterval(() => {
    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle("🌿 Žolės lentelė")
      .setTimestamp()
      .setFooter({ text: "Automatinis atnaujinimas" });

    const grouped = {};
    let houseCount = 0;

    for (const userId in wateringData) {
      if (["lastUpdate", "lastMessageId", "lastDecreaseTime", "customSections"].includes(userId)) continue;

      const userData = wateringData[userId];
      for (const houseNumber in userData) {
        const house = userData[houseNumber];
        if (!house?.owner) continue;

        if (!grouped[house.owner]) grouped[house.owner] = [];
        grouped[house.owner].push(`📌 Namas ${houseNumber}nr - 🌿 **${house.percent}%** | 🕒 **${house.plantDays} dienos**`);
        houseCount++;
      }
    }

    for (const owner in grouped) {
      embed.addFields({
        name: `🏡 ${owner} namai:`,
        value: grouped[owner].join("\n"),
        inline: false
      });
    }

    console.log(`📊 Atnaujinama embed: naudotojų: ${Object.keys(grouped).length}, namų: ${houseCount}`);

    channel.send({ embeds: [embed] }).catch(console.error);
  }, 60 * 1000); // kas 1 minutę
});

client.login(TOKEN);
