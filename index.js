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
        if (!args[0] || isNaN(args[0]) || !args[1]) {
            return message.reply('❌ Naudojimas: `%set [namo numeris] [savininkas] [dienos]`');
        }

        const houseNumber = args[0];
        const owner = args[1];
        const days = args[2] ? parseInt(args[2]) : null;

        if (!wateringData[userId][houseNumber]) {
            return message.reply(`❌ Namas ${houseNumber} nerastas.`);
        }

        wateringData[userId][houseNumber].owner = owner;
        if (days !== null && !isNaN(days)) {
            wateringData[userId][houseNumber].plantDays = days;
        }

        saveWateringData(wateringData);
        return message.reply(`✅ Namo ${houseNumber} informacija atnaujinta: Savininkas - **${owner}**, Augalo laikas - **${days !== null ? days + ' dienos' : 'nekeista'}**.`);
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

// Automatinis palaistymo procentų mažinimas kas 30 minučių
setInterval(() => {
    const now = Date.now();
    for (const userId in wateringData) {
        for (const houseNumber in wateringData[userId]) {
            const data = wateringData[userId][houseNumber];
            const hoursPassed = (now - data.lastUpdate) / (1000 * 60 * 60);
            const lostWater = Math.floor(hoursPassed * 5);

            data.percent = Math.max(0, Math.min(150, data.percent - lostWater));
            data.lastUpdate = now;
        }
    }
    saveWateringData(wateringData);
}, 30 * 60 * 1000);

// Automatinis %check kas 25 min
setInterval(async () => {
    updatePlantDays();

    const channel = await client.channels.fetch(CHECK_CHANNEL_ID);
    if (!channel) return console.log("❌ Nerastas kanalas!");

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
            console.error("Klaida atnaujinant žinutę:", err);
            lastCheckMessage = null;
        });
    } else {
        channel.send({ embeds: [embed] }).then(msg => {
            lastCheckMessage = msg;
        });
    }
}, 25 * 60 * 1000);

client.login(TOKEN);
