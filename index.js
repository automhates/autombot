require("dotenv").config();
const mongoose = require("mongoose");
const {
  Client,
  IntentsBitField,
  ActivityType,
  EmbedBuilder,
} = require("discord.js");
const { Handler } = require("discordutility");
const cooldowns = {};
const readline = require("readline");
const ms = require("ms"); // npm install ms package
const discordToken = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildPresences,
  ],
});

client.login(discordToken);

// Connect to the database
async function connectToDatabase() {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

connectToDatabase();

// Database userSchema
const userSchema = new mongoose.Schema({
  userId: String,
  username: String,
  discriminator: String,
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  lastDailyReward: { type: Date, default: null },
  inventory: { type: Map, of: Number, default: () => new Map([["wood", 0]]) },
});

const User = mongoose.model("User", userSchema);

const miningSchema = new mongoose.Schema({
  userId: String,
  lastMining: { type: Date, default: null },
  lastChopping: { type: Date, default: null },
  totalMined: { type: Number, default: 0 },
  totalChopped: { type: Number, default: 0 },
});

const Mining = mongoose.model("Mining", miningSchema);

// Create an interface for reading from the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Event handlers
client.on("ready", (c) => {
  console.log("Autobot is ready!");

  const guildCount = client.guilds.cache.size;
  client.user.setPresence({
    activities: [
      {
        name: `autohelp > ${guildCount} server(s)`,
        type: ActivityType.WATCHING,
      },
    ],
    status: "online",
  });
});

// Experience system
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Cooldown system
  const now = Date.now();
  const cooldownTime = 60000; // 1 minute in milliseconds
  const userId = message.author.id;

  if (cooldowns[userId] && now < cooldowns[userId] + cooldownTime) {
    const timeLeft = (cooldowns[userId] + cooldownTime - now) / 1000;
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
    message.channel.send(
      `Congratulations, ${message.author}! You've leveled up to level ${level}!`
    );
  }

  await user.save();
  cooldowns[user.userId] = now;
});

// Command handler
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Convert the message content to lowercase
  const command = parseCommand(message.content);


  // Help command
  if (command === "help") {
    const helpembed = new EmbedBuilder()
      .setTitle("Autobot Commands")
      .setDescription("Every command starts with auto!")
      .setColor("#0099ff")
      .addFields(
        { name: "⚒️  Support Server", value: "https://discord.gg/ZhcrPTHPQA" },
        { name: " ", value: " " },
        { name: "🔩 Utility", value: "`ping` `status` `help`", inline: true },
        { name: " ", value: " " },
        {
          name: "🏦 Leveling",
          value: "`level` `lb` `leaderboard`",
          inline: false,
        },
        { name: " ", value: " " },
        {
          name: "💸 Economy",
          value:
            "`bal` `donate` `daily` `rich` `baltop` `automine` `autochop` ",
          inline: false,
        },
        { name: "🎒 User ", 
          value: " `sell` `bag`",
          inline: false,
        }
      );
    message.channel.send({ embeds: [helpembed] });
  }

  // Utility Commands
  if (command === "status") {
    message.channel.send("I am online and working!");
  }

  if (command === "ping") {
    message.channel.send(
      `📡 Latency is ${Date.now() - message.createdTimestamp}ms.`
    );
  }

  // Leveling Commands
  if (command === "level") {
    const user = await User.findOne({ userId: message.author.id });

    if (!user) {
      message.channel.send("You have not sent any messages yet.");
      return;
    }

    message.channel.send(`Your current level is ${user.level}`);
  }

  if (command === "leaderboard" || command === "lb") {
    const users = await User.find().sort({ level: -1, experience: -1 });

    let leaderboardMessage = `**${message.guild.name}'s Top Chatters**\n`;

    for (let i = 0; i < users.length && i < 5; i++) {
      const user = users[i];
      leaderboardMessage += `${i + 1}. ${user.username}#${
        user.discriminator
      } - Level: ${user.level} | ${user.experience} **XP** \n`;
    }

    message.channel.send(leaderboardMessage);
  }

  // Economy Commands
  if (command === "rich" || command === "baltop") {
    const users = await User.find().sort({ coins: -1 });

    let leaderboardMessage = `**${message.guild.name}'s Richest Users**\n`;

    for (let i = 0; i < users.length && i < 5; i++) {
      const user = users[i];
      leaderboardMessage += `${i + 1}. ${user.username}#${
        user.discriminator
      } - Balance: ${user.coins} 🪙 \n`;
    }

    message.channel.send(leaderboardMessage);
  }

  if (command === "bal") {
    const user = await User.findOne({ userId: message.author.id });

    if (!user) {
      message.channel.send("You have not sent any messages yet.");
      return;
    }

    message.channel.send(`Your current balance is ${user.coins} 🪙 coins.`);
  }

  if (command.startsWith("donate ")) {
    const args = message.content.slice(11).split(" "); // Slice the command prefix and split the arguments
    const amount = parseInt(args[0]);
    const targetUser = message.mentions.users.first();

    if (!amount || !targetUser) {
      message.channel.send(
        "Please provide a valid amount and mention a user to donate coins to in the format `autodonate (amount) (@user)`."
      );
      return;
    }

    const donator = await User.findOne({ userId: message.author.id });

    if (!donator) {
      message.channel.send("You have not sent any messages yet.");
      return;
    }

    if (donator.coins < amount) {
      message.channel.send("You do not have enough coins to donate.");
      return;
    }

    let receiver = await User.findOne({ userId: targetUser.id });

    if (!receiver) {
      receiver = new User({
        userId: targetUser.id,
        username: targetUser.username,
        discriminator: targetUser.discriminator,
      });
    }

    donator.coins -= amount;
    receiver.coins += amount;

    await donator.save();
    await receiver.save();

    message.channel.send(
      `You have donated ${amount} 🪙 coins to ${targetUser}.`
    );
  }

  if (command === "daily") {
    try {
      let user = await User.findOne({ userId: message.author.id });

      if (!user) {
        message.channel.send("You have not sent any messages yet.");
        return;
      }

      // Check if the user has already claimed their daily reward in the last 24 hours
      let currentTime = new Date();
      let lastDailyRewardTime = user.lastDailyReward
        ? new Date(user.lastDailyReward)
        : null;

      if (
        lastDailyRewardTime &&
        currentTime.getTime() - lastDailyRewardTime.getTime() <
          24 * 60 * 60 * 1000
      ) {
        let timeLeft =
          (24 * 60 * 60 * 1000 -
            (currentTime.getTime() - lastDailyRewardTime.getTime())) /
          1000;
        let hoursLeft = Math.floor(timeLeft / 3600);
        let minutesLeft = Math.floor((timeLeft % 3600) / 60);
        message.channel.send(
          `🕞 **Damn!** Try again in **${hoursLeft}** hour(s) and **${minutesLeft}** min.`
        );
        return;
      }

      // Give the user their daily reward
      user.coins += 50;
      user.experience += 100;
      user.lastDailyReward = currentTime;

      await user.save();

      message.channel.send(
        `Congratulations, ${message.author}! You've claimed your daily reward of 50 🪙 coins and 100 XP!`
      );
    } catch (error) {
      console.error("Error claiming daily reward:", error);
      message.channel.send(
        "An error occurred while claiming your daily reward. Please try again later."
      );
    }
  }

  if (command === "mine") {
    try {
      const mining = await Mining.findOneAndUpdate(
        { userId: message.author.id },
        {},
        { upsert: true, new: true }
      );

      const now = Date.now();
      const cooldownTime = 2 * 60 * 1000; // 2 minutes in milliseconds

      if (
        mining.lastMining &&
        now < mining.lastMining.getTime() + cooldownTime
      ) {
        const timeLeft =
          (mining.lastMining.getTime() + cooldownTime - now) / 1000;
        message.channel.send(
          `You can mine again in ${timeLeft.toFixed(1)} seconds.`
        );
        return;
      }

      // Mine coins and XP
      const coinsMined = Math.floor(Math.random() * 10) + 1; // Random amount between 1 and 10
      const experienceGained = Math.floor(Math.random() * 5) + 1; // Random amount between 1 and 5

      const user = await User.findOneAndUpdate(
        { userId: message.author.id },
        {
          $inc: { coins: coinsMined, experience: experienceGained },
        },
        { new: true }
      );

      mining.lastMining = new Date();
      await mining.save();

      message.channel.send(
        `⛏️ You mined ${coinsMined} 🪙 coins and gained ${experienceGained} XP! `
      );
    } catch (error) {
      console.error("Error mining:", error);
      message.channel.send(
        "An error occurred while mining. Please try again later."
      );
    }
  }

  if (command === "chop") {
    try {
      const mining = await Mining.findOneAndUpdate(
        { userId: message.author.id },
        {},
        { upsert: true, new: true }
      );

      const now = Date.now();
      const choppingCooldownTime = 5 * 60 * 1000; // 5 minutes in milliseconds

      if (
        mining.lastChopping &&
        now < mining.lastChopping.getTime() + choppingCooldownTime
      ) {
        const timeLeft =
          (mining.lastChopping.getTime() + choppingCooldownTime - now) / 1000;
        message.channel.send(
          `You can chop again in ${timeLeft.toFixed(1)} seconds.`
        );
        return;
      }

      // Chop wood and XP
      const woodChopped = Math.floor(Math.random() * 4) + 1; // Random amount between 1 and 4
      const experienceGained = Math.floor(Math.random() * 3) + 1; // Random amount between 1 and 3

      let user = await User.findOneAndUpdate(
        { userId: message.author.id },
        {
          $inc: { coins: woodChopped, experience: experienceGained },
        },
        { new: true }
      );

      if (!user) {
        user = new User({
          userId: message.author.id,
          username: message.author.username,
          discriminator: message.author.discriminator,
        });
      }

      user.inventory.set("wood", user.inventory.get("wood") + woodChopped);

      await user.save();

      mining.lastChopping = new Date();
      await mining.save();

      message.channel.send(
        `🌳 You chopped ${woodChopped} piece(s) of wood and gained ${experienceGained} XP! You can sell your wood with \`autosell wood\`.`
      );
    } catch (error) {
      console.error("Error chopping:", error);
      message.channel.send(
        "An error occurred while chopping. Please try again later."
      );
    }
  }

  if (command === "sell wood") {
    const user = await User.findOne({ userId: message.author.id });

    if (!user) {
      message.channel.send("You have not sent any messages yet.");
      return;
    }

    const woodAmount = user.inventory.get("wood");

    if (woodAmount <= 0) {
      message.channel.send("You do not have any wood to sell.");
      return;
    }

    // Assuming each piece of wood is sold for 10 coins
    const coinsEarned = woodAmount * 10;

    user.inventory.set("wood", 0);
    user.coins += coinsEarned;

    await user.save();

    message.channel.send(
      `You have sold ${woodAmount} pieces of wood for ${coinsEarned} 🪙 coins.`
    );
  }

  if (command === "bag") {
    const user = await User.findOne({ userId: message.author.id });
  
    if (!user) {
      message.channel.send("You have not sent any messages yet.");
      return;
    }
  
    const inventoryItems = Array.from(user.inventory.entries());
    let inventoryMessage = `**🎒 ${message.author.username}'s Backpack:**\n`;
  
    if (inventoryItems.length === 0) {
      inventoryMessage += "Your inventory is empty.\n";
    } else {
      inventoryMessage += "\n";
      inventoryItems.forEach(([item, quantity]) => {
        if (item === "wood") {
          inventoryMessage += `🌳 Wood : ${quantity}\n`;
        } else {
          inventoryMessage += `${item}: ${quantity}\n`;
        }
      });
    }
  
    message.channel.send(inventoryMessage);
  }

});

// Function to parse and normalize the command
function parseCommand(messageContent) {
  const command = messageContent.toLowerCase().replace("auto", "");
  return command;
}
