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
const CHECK_CHANNEL_ID = process.env.CHANNEL_ID;
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

// Komandų apdorojimas
client.on('messageCreate', async message => {
    if (!message.content.startsWith('%') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    if (!wateringData[userId]) {
        wateringData[userId] = {};
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

        wateringData[userId][houseNumber].percent = wateringLevel;
        wateringData[userId][houseNumber].owner = owner;
        wateringData[userId][houseNumber].plantDays = days;

        saveWateringData(wateringData);
        return message.reply(`✅ **Namo ${houseNumber} informacija atnaujinta:**\n🌿 **Laistymo lygis:** ${wateringLevel}%\n🏠 **Savininkas:** ${owner}\n🕒 **Augalo dienos:** ${days}`);
    }

    if (command === 'check') {
        updatePlantDays();

        if (Object.keys(wateringData[userId]).length === 0) {
            return message.reply('❌ Neturi pridėtų namų. Naudok `%addhouse [namas] [savininkas]`.');
        }

        let embedColor = 0x00AE86;
        for (const houseNumber in wateringData[userId]) {
            const percent = wateringData[userId][houseNumber].percent;
            if (percent < 50) embedColor = 0xFF0000;
            else if (percent < 100) embedColor = 0xFFFF00;
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle("🏠 Tavo namų palaistymo lygiai")
            .setDescription("Čia gali matyti kiekvieno savo namo palaistymo procentus ir augalo laiką.")
            .setTimestamp()
            .setFooter({ text: "Informacija atnaujinta" });

        for (const houseNumber in wateringData[userId]) {
            const house = wateringData[userId][houseNumber];
            embed.addFields({ 
                name: `📌 Namas ${houseNumber}nr - ${house.owner}`, 
                value: `🌿 **${house.percent}%** | 🕒 **${house.plantDays} dienos**`, 
                inline: true
            });
        }

        return message.channel.send({ embeds: [embed] });
    }
});

client.login(TOKEN);
