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
const CHECK_CHANNEL_ID = 1348756265219920024; // Patikrink, ar tikrai teisingas ID!
const DATA_FILE = './watering.json';
let lastCheckMessage = null;

// Pakrauna duomenis iš failo
function loadWateringData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE));
    }
    return {};
}

// Išsaugo duomenis faile
function saveWateringData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let wateringData = loadWateringData();

// Automatinis augalo laiko didinimas po 00:00
function updatePlantDays() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (wateringData.lastUpdate !== today) {
        for (const userId in wateringData) {
            for (const houseNumber in wateringData[userId]) {
                wateringData[userId][houseNumber].plantDays += 1;
            }
        }
        wateringData.lastUpdate = today;
        saveWateringData(wateringData);
    }
}

// Boto paleidimas ir automatinis atnaujinimas
client.once('ready', async () => {
    console.log(`✅ Botas prisijungė kaip ${client.user.tag}`);

    const channel = await client.channels.fetch(CHECK_CHANNEL_ID).catch(err => console.error("❌ Neradau kanalo:", err));
    if (!channel) return;

    setInterval(async () => {
        updatePlantDays();

        let embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle("🏠 Tavo namų palaistymo lygiai")
            .setDescription("Čia gali matyti kiekvieno savo namo palaistymo procentus ir augalo laiką.")
            .setTimestamp()
            .setFooter({ text: "Informacija atnaujinta automatiškai" });

        for (const userId in wateringData) {
            for (const houseNumber in wateringData[userId]) {
                const house = wateringData[userId][houseNumber];
                embed.addFields({ 
                    name: `📌 Namas ${houseNumber}nr - ${house.owner}`, 
                    value: `🌿 **${house.percent}%** | 🕒 **${house.plantDays} dienos**`, 
                    inline: true
                });
            }
        }

        if (lastCheckMessage) {
            lastCheckMessage.edit({ embeds: [embed] }).catch(err => {
                console.error("❌ Klaida atnaujinant žinutę:", err);
                lastCheckMessage = null;
            });
        } else {
            channel.send({ embeds: [embed] }).then(msg => {
                lastCheckMessage = msg;
            });
        }
    }, 60 * 1000); // Atnaujina kas 1 minutę
});

// Komandų apdorojimas
client.on('messageCreate', async message => {
    if (!message.content.startsWith('%') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    if (!wateringData[userId]) {
        wateringData[userId] = {};
    }

    if (command === 'addhouse') {
        if (!args[0] || isNaN(args[0]) || !args[1]) {
            return message.reply('❌ Naudojimas: `%addhouse [namo numeris] [savininkas]`');
        }

        const houseNumber = args[0];
        const owner = args.slice(1).join(" ");

        if (wateringData[userId][houseNumber]) {
            return message.reply(`❌ Namas ${houseNumber} jau egzistuoja.`);
        }

        wateringData[userId][houseNumber] = { percent: 150, plantDays: 1, lastUpdate: Date.now(), owner: owner };
        saveWateringData(wateringData);
        return message.reply(`✅ **Namas ${houseNumber} pridėtas.**\n🌿 **Laistymo lygis:** 150%\n🏠 **Savininkas:** ${owner}\n🕒 **Augalo dienos:** 1`);
    }

    if (command === 'delhouse') {
        if (!args[0] || isNaN(args[0])) {
            return message.reply('❌ Naudojimas: `%delhouse [namo numeris]`');
        }

        const houseNumber = args[0];

        if (!wateringData[userId][houseNumber]) {
            return message.reply(`❌ Namas ${houseNumber} nerastas.`);
        }

        delete wateringData[userId][houseNumber];
        saveWateringData(wateringData);

        return message.reply(`✅ **Namas ${houseNumber} sėkmingai ištrintas!**`);
    }

    if (command === 'set') {
        if (args.length < 4) {
            return message.reply('❌ Naudojimas: `%set [namo numeris] [laistymo lygis] [savininkas] [dienos]`');
        }

        const houseNumber = args[0];
        const wateringLevel = parseInt(args[1]);
        const owner = args[2];
        const days = parseInt(args[3]);

        if (!wateringData[userId][houseNumber]) {
            return message.reply(`❌ Namas ${houseNumber} nerastas.`);
        }

        wateringData[userId][houseNumber].percent = Math.max(0, Math.min(150, wateringLevel));
        wateringData[userId][houseNumber].owner = owner;
        wateringData[userId][houseNumber].plantDays = days;

        saveWateringData(wateringData);
        return message.reply(`✅ **Namo ${houseNumber} informacija atnaujinta:**\n🌿 **Laistymo lygis:** ${wateringLevel}%\n🏠 **Savininkas:** ${owner}\n🕒 **Augalo dienos:** ${days}`);
    }
});

client.login(TOKEN);
