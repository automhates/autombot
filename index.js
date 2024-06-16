require('dotenv').config();
const { Client, IntentsBitField, GatewayIntentBits, ActivityType, EmbedBuilder} = require('discord.js');

const cooldowns = {};
const mongoose = require('mongoose');

const readline = require('readline');

// Create an interface for reading from the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Ask for the token
rl.question('Enter your bot token: ', (token) => {
  // Login with the provided token
  client.login(token);

  // Close the readline interface
  rl.close();
});

// Database connections

const userSchema = new mongoose.Schema({
    userId: String,
    username: String,
    discriminator: String,
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
  });
  
  const User = mongoose.model('User', userSchema);



const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildPresences,
    ],
});

// Start the bot

client.on('ready', (c) => { 
    console.log('Autobot is ready!')

   // const ping = client.ws.ping;
    const guildCount = client.guilds.cache.size;
    client.user.setPresence({
        activities: [{ name: `autohelp > ${guildCount} server(s)`, type: ActivityType.Custom }],
        status: 'online',
      });
});

// Experience system

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
  

    // Cooldown system

    const now = Date.now();
    const cooldownTime = 60000; // 1 minute in milliseconds
    const userId = message.author.id;

    if (cooldowns[userId] && now < cooldowns[userId] + cooldownTime) {
        const timeLeft = (cooldowns[userId] + cooldownTime - now) / 1000;
      //  message.channel.send(`You can get more experience points in ${timeLeft.toFixed(1)} seconds.`);
        return;
    }

    // Get experience

    const user = await User.findOneAndUpdate(
      { userId: message.author.id },
      {
        username: message.author.username,
        discriminator: message.author.discriminator,
      },
      { upsert: true, new: true }
    );
  
    const experienceToAdd = 20;
    user.experience += experienceToAdd;
  
    const level = Math.floor(0.1 * Math.sqrt(user.experience));
    if (level > user.level) {
      user.level = level;
      message.channel.send(`Congratulations, ${message.author}! You've leveled up to level ${level}!`);
    }
  
    await user.save();


    cooldowns [user.userId] = now;

    });



// Command handler

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

    if (message.content === 'autohelp') {
        const helpembed = new EmbedBuilder()
        .setTitle('Autobot Commands')
        .setDescription('Here is the list of commands!')
        .setColor('#0099ff')
        .addFields(
            { name: '⚒️  Support Server', value: 'https://discord.gg/ZhcrPTHPQA' },
            { name: ' ', value: ' ' },
            { name: '🔩 Utility', value: '`ping` `status` `help`', inline: true },
            { name: '🏦 Leveling', value: '`level` `lb` `leaderboard`', inline: false },
        );
        message.channel.send({ embeds: [helpembed] });
    }

    if (message.content === 'autostatus') {
        message.channel.send('I am online and working!');
    }

    if (message.content === 'autoping') {
        message.channel.send(`📡 Latency is ${Date.now() - message.createdTimestamp}ms.`);
    }

    if (message.content === 'autolevel') {
      const user = await User.findOne({ userId: message.author.id });
  
      if (!user) {
        message.channel.send('You have not sent any messages yet.');
        return;
      }
  
      message.channel.send(`Your current level is ${user.level}`);
    }

    if (message.content === 'autoleaderboard' || message.content === 'autolb') {
      const users = await User.find().sort({ level: -1, experience: -1 });
  
      let leaderboardMessage = `**${message.guild.name}'s Top Chatters**\n`;

      for (let i = 0; i < users.length && i < 5; i++) {
        const user = users[i];
        leaderboardMessage += `${i + 1}. ${user.username}#${user.discriminator} - Level: ${user.level} | ${user.experience} **XP** \n`;
      }
  
      message.channel.send(leaderboardMessage);
    }

});

function eventHandler(client) {
}


// Connect to the database
(async () => {
    try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('Connected to MongoDB!');
        
            eventHandler(client);
    } catch (error) {
        console.log(`Error: ${error}`);
    }
    })();