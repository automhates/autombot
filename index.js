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

// Define the user schema
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: String,
  discriminator: String,
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  inventory: {
    wood: { type: Number, default: 0 },
    apple: { type: Number, default: 0 },
    diamond: { type: Number, default: 0 },
    fish: { type: Number, default: 0 },
    puffer: { type: Number, default: 0 },
  },
  lastDailyReward: Date,
});

const miningSchema = new mongoose.Schema({
  userId: String,
  lastMining: { type: Date, default: null },
  lastChopping: { type: Date, default: null },
  lastFishing: { type: Date, default: null },
  totalMined: { type: Number, default: 0 },
  totalChopped: { type: Number, default: 0 },
  totalFished: { type: Number, default: 0},
});

const User = mongoose.model("User", userSchema);
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
  if (!message.content.startsWith("auto")) return;

  const args = message.content.slice(4).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Help command
  if (command === "help") {
    const helpembed = new EmbedBuilder()
      .setTitle("Autobot Commands")
      .setDescription("Every command starts with auto!")
      .setColor("#0099ff")
      .addFields(
        { name: "⚒️  Support Server", value: "https://discord.gg/ZhcrPTHPQA" },
        { name: " ", value: " " },
        { name: "🔩 Utility", value: "`ping`  `status`  `help`", inline: true },
        { name: " ", value: " " },
        {
          name: "🏦 Leveling",
          value: "`level`  `lb`  `leaderboard`",
          inline: false,
        },
        { name: " ", value: " " },
        {
          name: "💸 Economy",
          value:
            "`bal`  `donate`  `daily`  `rich`  `baltop`  `prices`",
          inline: false,
        },
        { name: " ", value: " " },
        { name: "🎒 User", 
          value: " `sell`  `bag`",
          inline: false,
        },
        { name: " ", value: " " },
        {
          name: "🏢 Jobs",
          value:
            " `mine`  `chop`  `fish`",
          inline: false,
        },
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

    message.channel.send(`${message.author}, Your current level is ${user.level}`);
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

    message.channel.send(`${message.author}, Your current balance is ${user.coins} 🪙 coins.`);
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
      `${message.author}, You have donated ${amount} 🪙 coins to ${targetUser}.`
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
          `${message.author}, You can claim your daily reward in ${hoursLeft} hour(s) and ${minutesLeft} min.`
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
      const cooldownTime = 1 * 60 * 1000; // 1 minute in milliseconds

      if (
        mining.lastMining &&
        now < mining.lastMining.getTime() + cooldownTime
      ) {
        const timeLeft =
          (mining.lastMining.getTime() + cooldownTime - now) / 1000;
        message.channel.send(
          `${message.author}, You can mine again in ${timeLeft.toFixed(1)} seconds.`
        );
        return;
      }

      // Mine coins and XP
      const coinsMined = Math.floor(Math.random() * 10) + 1; // Random amount between 1 and 10
      const experienceGained = Math.floor(Math.random() * 5) + 1; // Random amount between 1 and 5

      let user = await User.findOneAndUpdate(
        { userId: message.author.id },
        {
          $inc: { coins: coinsMined, experience: experienceGained },
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

      // Add drop chance for a diamond
      const dropChance = Math.random();
      if (dropChance < 0.1) {
        const diamondsDropped = Math.floor(Math.random() * 1) + 1; // Random amount between 1 and 1
        user.inventory.diamond += diamondsDropped;
        message.channel.send(
          `💎 ${message.author}, You found ${diamondsDropped} diamond(s) while mining!`
        );
      }

      await user.save();

      mining.lastMining = new Date();
      await mining.save();

      message.channel.send(
        `⛏️ ${message.author}, You mined ${coinsMined} coins and gained ${experienceGained} XP!.`
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
      const cooldownTime = 1 * 60 * 1000; // 1 minute in milliseconds

      if (
        mining.lastChopping &&
        now < mining.lastChopping.getTime() + cooldownTime
      ) {
        const timeLeft =
          (mining.lastChopping.getTime() + cooldownTime - now) / 1000;
        message.channel.send(
          `${message.author}, You can chop again in ${timeLeft.toFixed(1)} seconds.`
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

      // Add drop chance for an apple
      const dropChance = Math.random();
      if (dropChance < 0.2) {
        const applesDropped = Math.floor(Math.random() * 2) + 1; // Random amount between 1 and 2
        user.inventory.apple += applesDropped;
        message.channel.send(
          `🍎 ${message.author}, You found ${applesDropped} apple(s) while chopping!`
        );
      }

      user.inventory.wood += woodChopped;

      await user.save();

      mining.lastChopping = new Date();
      await mining.save();

      message.channel.send(
        `🌳${message.author}, You chopped ${woodChopped} piece(s) of wood and gained ${experienceGained} XP! You can sell your wood with \`autosell wood\`.`
      );
    } catch (error) {
      console.error("Error chopping:", error);
      message.channel.send(
        "An error occurred while chopping. Please try again later."
      );
    }
  }

  if (command === "fish") {
    try {
      const mining = await Mining.findOneAndUpdate(
        { userId: message.author.id },
        {},
        { upsert: true, new: true }
      );

      const now = Date.now();
      const cooldownTime = 1 * 60 * 1000; // 1 minute in milliseconds

      if (
        mining.lastFishing &&
        now < mining.lastFishing.getTime() + cooldownTime
      ) {
        const timeLeft =
          (mining.lastFishing.getTime() + cooldownTime - now) / 1000;
        message.channel.send(
          `${message.author}, You can fish again in ${timeLeft.toFixed(1)} seconds.`
        );
        return;
      }

      // Catch Fish and XP
      const fishCatched = Math.floor(Math.random() * 4) + 1; // Random amount between 1 and 3
      const experienceGained = Math.floor(Math.random() * 3) + 1; // Random amount between 5 and 30

      let user = await User.findOneAndUpdate(
        { userId: message.author.id },
        {
          $inc: { fish: fishCatched, experience: experienceGained },
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

      // Add drop chance for puffers and shark (soon)
      const dropChance = Math.random();
      if (dropChance < 0.2) {
        const puffersDropped = Math.floor(Math.random() * 2) + 1; // Random amount between 1 and 2
        user.inventory.puffer += puffersDropped;
        message.channel.send(
          `🐡 ${message.author}, You found ${puffersDropped} puffer(s) while fishing!`
        );
      }

      user.inventory.fish += fishCatched;

      await user.save();

      mining.lastFishing = new Date();
      await mining.save();

      message.channel.send(
        `🐟 ${message.author}, You fished ${fishCatched} fish and gained ${experienceGained} XP! You can sell your fish with \`autosell fish\`.`
      );
    } catch (error) {
      console.error("Error chopping:", error);
      message.channel.send(
        "An error occurred while chopping. Please try again later."
      );
    }
  }

  if (command === "bag") {
    const user = await User.findOne({ userId: message.author.id });

    if (!user) {
      message.channel.send("You have not sent any messages yet.");
      return;
    }

    const itemTypes = {
      "wood": "🌳 Wood",
      "apple": "🍎 Apple",
      "diamond": "💎 Diamond",
      "fish": "🐟 Fish",
      "puffer": " 🐡 Puffer",
    };

    let inventoryMessage = `**${message.author}'s Inventory**\n`;

    for (const [item, amount] of Object.entries(user.inventory)) {
      if (amount > 0) {
        inventoryMessage += `${itemTypes[item] ? itemTypes[item] : item} - ${amount}\n`;
      }
    }

    if (inventoryMessage === `**${message.author}'s Inventory**\n`) {
      inventoryMessage += `${message.author}, Your inventory is empty.`;
    }

    message.channel.send(inventoryMessage);
  }

  if (command === "prices") {
    const itemPrices = {
      "🌳 Wood": 5,
      "🍎 Apple": 20,
      "💎 Diamond": 150,
      "🐟 Fish": 10,
      "🐡 Puffer": 100,
    };

    let pricesMessage = "**Item Prices**\n";

    for (const [item, price] of Object.entries(itemPrices)) {
      pricesMessage += `${item}: ${price} 🪙\n`;
    }

    message.channel.send(pricesMessage);
  }

  if (command.startsWith("sell")) {
    const args = message.content.slice(9).trim().split(/ +/); // Adjust slice index to correctly handle the command
    const itemToSell = args[0];
    let amountToSell = args[1];
  
    //// console.log(`Command args:`, args); // Debugging: log the parsed arguments
  
    if (!itemToSell) {
      message.channel.send(
        `${message.author}, Please provide an item to sell. For example: \`autosell wood 5\`.`
      );
      return;
    }
  
    const user = await User.findOne({ userId: message.author.id });
  
    if (!user) {
      message.channel.send("You have not sent any messages yet.");
      return;
    }
  
    let itemAmount = user.inventory[itemToSell];
    // // console.log(`User inventory:`, user.inventory); // Debugging: log the user's inventory
    let itemPrice = 0;
    let itemMessage = "";
  
    if (itemToSell === "wood") {
      itemPrice = 5; // Assuming each piece of wood is sold for 5 coins
      itemMessage = "🌳 Wood";
    } else if (itemToSell === "apple") {
      itemPrice = 20; // Assuming each apple is sold for 20 coins
      itemMessage = "🍎 Apple";
    } else if (itemToSell === "diamond") {
      itemPrice = 120; // Assuming each diamond is sold for 120 coins
      itemMessage = "💎 Diamond";
    } else if (itemToSell === "fish") {
      itemPrice = 10; // Assuming each apple is sold for 20 coins
      itemMessage = "🐟 Fish";
    } else if (itemToSell === "puffer") {
      itemPrice = 100; // Assuming each apple is sold for 20 coins
      itemMessage = "🐡 Puffer";
    } else {
      message.channel.send(
        `${message.author}, Please provide a valid item to sell.`
      );
      return;
    }
  
    if (!itemAmount || itemAmount <= 0) {
      message.channel.send(`${message.author}, You do not have any ${itemMessage} to sell.`);
      return;
    }
  
    if (amountToSell === 'all') {
      amountToSell = itemAmount;
    } else {
      amountToSell = parseInt(amountToSell);
      if (!amountToSell || isNaN(amountToSell) || amountToSell <= 0 || amountToSell > itemAmount) {
        message.channel.send(
          `${message.author}, Please provide a valid amount of ${itemMessage} to sell.`
        );
        return;
      }
    }
  
    const coinsEarned = amountToSell * itemPrice;
  
    user.inventory[itemToSell] -= amountToSell;
    user.coins += coinsEarned;
  
    await user.save();
  
    message.channel.send(
      `${message.author} has sold ${amountToSell} ${itemMessage}(s) for ${coinsEarned} 🪙 coins.`
    );
  }

});
