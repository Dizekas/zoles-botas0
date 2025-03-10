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
const PREFIX = '%';
const DATA_FILE = './watering.json';
const CHECK_CHANNEL_ID = "1348756265219920024"; // Įrašyk kanalo ID, kur bus atnaujinama lentelė

let wateringData = {};
let lastCheckMessage = null; // Saugo paskutinę %check lentelę

// Pakrauna išsaugotus duomenis
function loadWateringData() {
    if (fs.existsSync(DATA_FILE)) {
        wateringData = JSON.parse(fs.readFileSync(DATA_FILE));
    }
}

// Išsaugo duomenis faile
function saveWateringData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(wateringData, null, 2));
}

loadWateringData();

client.on('messageCreate', async message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    if (!wateringData[userId]) {
        wateringData[userId] = {};
    }

    if (command === 'addhouse') {
        if (!args[0] || isNaN(args[0])) {
            return message.reply('❌ Naudojimas: `%addhouse [namo numeris]`');
        }

        const houseNumber = args[0];
        if (wateringData[userId][houseNumber]) {
            return message.reply(`❌ Namas su numeriu ${houseNumber} jau yra sąraše.`);
        }

        wateringData[userId][houseNumber] = { percent: 150, lastUpdate: Date.now() };
        saveWateringData();
        return message.reply(`✅ Namas ${houseNumber} pridėtas su 150% palaistymu.`);
    }

    if (command === 'set') {
        if (!args[0] || !args[1] || isNaN(args[1])) {
            return message.reply('❌ Naudojimas: `%set [namo numeris] [procentai]`');
        }

        const houseNumber = args[0];
        const amount = Math.max(0, Math.min(150, parseInt(args[1])));

        if (!wateringData[userId][houseNumber]) {
            return message.reply(`❌ Namas ${houseNumber} nerastas. Naudok \`%addhouse [namas]\`.`);
        }

        wateringData[userId][houseNumber].percent = amount;
        wateringData[userId][houseNumber].lastUpdate = Date.now();
        saveWateringData();
        return message.reply(`✅ Namo ${houseNumber} palaistymo lygis atnaujintas: ${amount}%`);
    }

    if (command === 'check') {
        if (Object.keys(wateringData[userId]).length === 0) {
            return message.reply('❌ Neturi pridėtų namų. Naudok `%addhouse [namas]`.');
        }

        let embedColor = 0x00AE86; // Žalia (jei viskas gerai)
        for (const houseNumber in wateringData[userId]) {
            const percent = wateringData[userId][houseNumber].percent;
            if (percent < 50) embedColor = 0xFF0000; // Raudona (kritinė būsena)
            else if (percent < 100) embedColor = 0xFFFF00; // Geltona (vidutinė būsena)
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle("🏠 Tavo namų palaistymo lygiai")
            .setDescription("Čia gali matyti kiekvieno savo namo palaistymo procentus.")
            .setTimestamp()
            .setFooter({ text: "Informacija atnaujinta" });

        for (const houseNumber in wateringData[userId]) {
            embed.addFields({ 
                name: `📌 Namas ${houseNumber}nr`, 
                value: `🌿 **${wateringData[userId][houseNumber].percent}%**`, 
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
            saveWateringData();
        }
    }
}, 30 * 60 * 1000); // 30 minučių

// Automatiškai kas 1 minutę atnaujina lentelę Discorde
setInterval(async () => {
    const channel = await client.channels.fetch(CHECK_CHANNEL_ID);
    if (!channel) return console.log("❌ Nerastas kanalas!");

    for (const userId in wateringData) {
        if (Object.keys(wateringData[userId]).length === 0) continue;

        let embedColor = 0x00AE86; // Žalia (jei viskas gerai)
        for (const houseNumber in wateringData[userId]) {
            const percent = wateringData[userId][houseNumber].percent;
            if (percent < 50) embedColor = 0xFF0000; // Raudona (kritinė būsena)
            else if (percent < 100) embedColor = 0xFFFF00; // Geltona (vidutinė būsena)
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle("🏠 Tavo namų palaistymo lygiai")
            .setDescription("Čia gali matyti kiekvieno savo namo palaistymo procentus.")
            .setTimestamp()
            .setFooter({ text: "Informacija atnaujinta automatiškai" });

        for (const houseNumber in wateringData[userId]) {
            embed.addFields({ 
                name: `📌 Namas ${houseNumber}nr`, 
                value: `🌿 **${wateringData[userId][houseNumber].percent}%**`, 
                inline: true
            });
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
    }
}, 60 * 1000); // 1 minutė

client.login(TOKEN);
