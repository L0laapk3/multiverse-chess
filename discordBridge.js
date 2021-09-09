const Discord = require('discord.js');
const client = new Discord.Client();
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const SUBSCRIBE_REACT = '🔔'; //'👀';
const UNSUBSCRIBE_REACT = '🔕'; //'😴';



// invite link
// https://discord.com/api/oauth2/authorize?client_id=760107519971950643&permissions=268443648&redirect_uri=https%3A%2F%2Flocalhost%3A5000%2Flogin%2Fdiscord&scope=bot


let connected = false;
let lastGames = [];

client.on("ready", async _ => {
	connected = true;
		
	await Promise.all(client.guilds.cache.map(async (guild, guid) => {
		for (const [cuid, channel] of guild.channels.cache) {
			if (channel.type != "text" || channel.deleted || !channel.topic || !channel.topic.toLowerCase().includes("https://multiversechess.com"))
				continue;

			const messages = await channel.messages.fetch({ limit: 50 }).catch(console.error);
			const lastSelfMessage = messages.find(m => m.author && m.author.id == client.user.id);
			if (lastSelfMessage)
				existingMessages[guid] = new Promise(resolve => resolve(lastSelfMessage));

			break;
		}
	}));
	
	broadcast(true);
});

client.login(TOKEN);

function getInviteRole(guild) {
	return guild.roles.cache.find(role => role.name.toLowerCase().includes("invite"));
}

function handleReact(reaction, user, added) {
	if (reaction.message.member && reaction.message.member.id == client.user.id && !reaction.me) {		
		const role = getInviteRole(reaction.message.guild);
		if (role) {
			const member = reaction.message.guild.members.cache.find(member => member.id === user.id);
			if (member) {
				if (reaction.emoji.name == SUBSCRIBE_REACT) {
					member.roles.add(role).catch(console.warn);
					reaction.message.reactions.cache.get(UNSUBSCRIBE_REACT).users.remove(user.id).catch(console.warn);
				} else if (reaction.emoji.name == UNSUBSCRIBE_REACT) {
					member.roles.remove(role).catch(console.warn);
					reaction.message.reactions.cache.get(SUBSCRIBE_REACT).users.remove(user.id).catch(console.warn);
				}
			}
		}
	}
}

client.on("messageReactionAdd", (reaction, user) => handleReact(reaction, user, true));
// client.on("messageReactionRemove", (reaction, user) => handleReact(reaction, user, false));

let existingMessages = {};


function createEmbed() {
	const embed = new Discord.MessageEmbed();
	// embed.setColor('#000000');
	embed.setTitle('Public Games');
	// embed.setAuthor('Some name', 'https://i.imgur.com/wSTFkRM.png', 'https://discord.js.org')
	//.setDescription('Some description here')
	// embed.setThumbnail('https://i.imgur.com/wSTFkRM.png')
	const descriptions = [];
	for (const game of lastGames) {
		let timeStr = "";
		if (game.time.start[0] == -1)
			timeStr = "unlimited time";
		else {
			const formatF = x => x < 1000 ? "." + x/100 : x / 1000 % 60 == 0 ? x/60000 + "m" : x/1000;
			const andSign = "+";
			const scaleSign = "N";
			if (game.time.incr)
				timeStr += andSign + formatF(game.time.incr);
			if (game.time.incrScale)
				timeStr += andSign + formatF(game.time.incrScale) + scaleSign;
			if (game.time.grace || game.time.graceScale) {
				if (game.time.grace && game.time.graceScale)
					timeStr += andSign + "(" + formatF(game.time.grace) + andSign + formatF(game.time.graceScale) + scaleSign + ")";
				else
					timeStr += andSign + "(" + formatF(game.time.grace || game.time.graceScale) + (game.time.graceScale ? scaleSign : "") + ")";
			}
			if (!timeStr.length)
				timeStr = andSign + "0";
			timeStr = (game.time.start[0] / 60000 % 60 == 0 ? game.time.start[0]/60/60/1000 + "h" : game.time.start[0] / 1000 % 60 == 0 ? game.time.start[0]/60/1000 : game.time.start[0]/1000 + "s") + timeStr; 
		}
		descriptions.push(`**[join](https://multiversechess.com/${game.shortCode})** - **${game.mode}** - **${timeStr}** - vs ${game.opponent.name}`);
	}
	if (lastGames.length == 0)
		embed.setDescription("No games :(");
	else
		embed.setDescription(descriptions.join('\n'));
	// embed.setTimestamp();
	embed.setFooter('multiversechess.com');
	return embed;
}

function broadcast(silent) {
	for (const [guid, guild] of client.guilds.cache) {
		if (existingMessages[guid]) {
			if (silent) {
				existingMessages[guid].then(message => {
					message.edit(createEmbed()).catch(console.error);
				});
				continue;
			} else {
				existingMessages[guid].then(message => {
					message.delete().catch(console.error);
				});
			}

		}

		for (const [cuid, channel] of guild.channels.cache) {
			if (channel.type != "text" || channel.deleted || !channel.topic || !channel.topic.toLowerCase().includes("https://multiversechess.com"))
				continue;
			
			const role = getInviteRole(guild);
			const msg = channel.send(lastGames.length ? `<@&${role.id}>` : '', { embed: createEmbed() }).catch(console.error);
			existingMessages[guid] = msg;
			msg.then(msg => msg.react(SUBSCRIBE_REACT).then(_ => msg.react(UNSUBSCRIBE_REACT).catch(console.error))).catch(console.error);
			break;
		}
	}
}


module.exports = {
	update: function(games, added) {
		lastGames = games;
		if (connected)
			broadcast(!added);
	},
};