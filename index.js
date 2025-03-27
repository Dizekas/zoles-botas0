
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
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE));
    }
    return { lastUpdate: null, lastMessageId: null, customSections: {} };
}

function saveWateringData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let wateringData = loadWateringData();

function updatePlantDays() {
    const today = new Date().toISOString().split('T')[0];
    if (wateringData.lastUpdate !== today) {
        for (const userId in wateringData) {
            if (["lastMessageId", "lastUpdate", "lastDecreaseTime", "customSections"].includes(userId)) continue;
            for (const houseNumber in wateringData[userId]) {
                wateringData[userId][houseNumber].plantDays += 1;
            }
        }
        wateringData.lastUpdate = today;
        saveWateringData(wateringData);
    }
}

function decreaseWateringLevels() {
    const now = Date.now();
    if (!wateringData.lastDecreaseTime || now - wateringData.lastDecreaseTime >= 60 * 60 * 1000) {
        wateringData.lastDecreaseTime = now;
        for (const userId in wateringData) {
            if (["lastMessageId", "lastUpdate", "lastDecreaseTime", "customSections"].includes(userId)) continue;
            for (const houseNumber in wateringData[userId]) {
                if (wateringData[userId][houseNumber].percent > 0) {
                    wateringData[userId][houseNumber].percent -= 4;
                }
            }
        }
        saveWateringData(wateringData);
    }
}

client.once('ready', async () => {
    console.log(`✅ Botas prisijungė kaip ${client.user.tag}`);

    const channel = await client.channels.fetch(CHECK_CHANNEL_ID).catch(err => console.error("❌ Neradau kanalo:", err));
    if (!channel) return;

    setInterval(async () => {
        updatePlantDays();
        decreaseWateringLevels();

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle("🌱 Žolės palaistymo lentelė")
            .setTimestamp()
            .setFooter({ text: "Automatinis atnaujinimas" });

        const grouped = {};

        for (const userId in wateringData) {
            if (["lastMessageId", "lastUpdate", "lastDecreaseTime", "customSections"].includes(userId)) continue;
            for (const houseNumber in wateringData[userId]) {
                const house = wateringData[userId][houseNumber];
                if (!house || house.percent === undefined || house.plantDays === undefined || !house.owner) continue;
                if (!grouped[house.owner]) grouped[house.owner] = [];
                grouped[house.owner].push(
                    `📌 Namas ${houseNumber}nr - 🌿 **${house.percent}%** | 🕒 **${house.plantDays} dienos**`
                );
            }
        }

        for (const owner in grouped) {
            let section = wateringData.customSections?.[owner] || "";
            embed.addFields({
                name: `🏡 ${owner} namai:`,
                value: (section ? `📝 ${section}\n` : "") + grouped[owner].join("\n"),
                inline: false
            });
        }

        try {
            if (wateringData.lastMessageId) {
                const prevMsg = await channel.messages.fetch(wateringData.lastMessageId);
                await prevMsg.edit({ embeds: [embed] });
            } else {
                const sent = await channel.send({ embeds: [embed] });
                wateringData.lastMessageId = sent.id;
                saveWateringData(wateringData);
            }
        } catch {
            const sent = await channel.send({ embeds: [embed] });
            wateringData.lastMessageId = sent.id;
            saveWateringData(wateringData);
        }
    }, 60 * 1000);
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith('%') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    if (!wateringData[userId]) {
        wateringData[userId] = {};
    }

    if (command === 'addhouse') {
        const [number, ...ownerParts] = args;
        const owner = ownerParts.join(" ");
        if (!number || !owner) return message.reply("❌ Naudojimas: `%addhouse [namo nr] [savininkas]`");
        wateringData[userId][number] = { owner, percent: 150, plantDays: 1 };
        saveWateringData(wateringData);
        return message.reply(`✅ Namas ${number} pridėtas.`);
    }

    if (command === 'set') {
        const [number, percent, owner, days] = args;
        if (!number || !percent || !owner || !days) return message.reply("❌ Naudojimas: `%set [namo nr] [laistymo %] [savininkas] [dienos]`");
        if (!wateringData[userId][number]) return message.reply("❌ Toks namas neegzistuoja.");
        wateringData[userId][number] = { owner, percent: parseInt(percent), plantDays: parseInt(days) };
        saveWateringData(wateringData);
        return message.reply(`✅ Namas ${number} atnaujintas.`);
    }

    if (command === 'delhouse') {
        const number = args[0];
        if (!number || !wateringData[userId][number]) return message.reply("❌ Toks namas neegzistuoja.");
        delete wateringData[userId][number];
        saveWateringData(wateringData);
        return message.reply(`✅ Namas ${number} ištrintas.`);
    }

    if (command === 'skiltis') {
        const [owner, ...sectionParts] = args;
        const text = sectionParts.join(" ");
        if (!owner || !text) return message.reply("❌ Naudojimas: `%skiltis [savininkas] [tekstas]`");
        if (!wateringData.customSections) wateringData.customSections = {};
        wateringData.customSections[owner] = text;
        saveWateringData(wateringData);
        return message.reply(`✅ Pridėta skiltis savininkui ${owner}.`);
    }
});

client.login(TOKEN);
