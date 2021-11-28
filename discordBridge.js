module.exports = function(IS_DEV) {


const Discord = require('discord.js');
const client = new Discord.Client();
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const SUBSCRIBE_REACT = '🔔'; //'👀';
const UNSUBSCRIBE_REACT = '🔕'; //'😴';



// invite link
// https://discord.com/oauth2/authorize?client_id=760107519971950643&permissions=268443648&redirect_uri=&scope=bot


let connected = false;
let lastGames = [];


function isSuitableChannel(channel) {
	if (channel.type != "text" || channel.deleted)
		return false;
	if (!channel.guild.me.permissionsIn(channel).has(Discord.Permissions.FLAGS.VIEW_CHANNEL | Discord.Permissions.FLAGS.SEND_MESSAGES | Discord.Permissions.FLAGS.ADD_REACTIONS | Discord.Permissions.FLAGS.MANAGE_CHANNELS))
		return false;
	return true;
}

function getInviteRole(guild) {
	const role = guild.me.roles.cache.find(role => role.editable && role.name.toLowerCase().includes("invite"));
	if (!role)
		console.error(`could not find invite role in guild '${guild.name}'!`);
	return role;
}

async function initializeGuild(guild) {
	const guid = guild.id;
	if (IS_DEV && guid != "763763925140635659")
		return;
	try {
		if (!guild.me.hasPermission(Discord.Permissions.FLAGS.MANAGE_ROLES))
			return console.error(`No MANAGE_ROLES permission in guild '${guild.name}'!`);
		if (!getInviteRole(guild))
			return;

		for (const [cuid, channel] of guild.channels.cache) {
			if (!isSuitableChannel(channel))
				continue;

			const messages = await channel.messages.fetch({ limit: 50 }).catch(console.error);

			const lastSelfMessage = messages.find(m => m.author && m.author.id == client.user.id);
			if (lastSelfMessage)
				existingMessages[guid] = new Promise(resolve => resolve(lastSelfMessage));

			console.log(`found channel '${channel.name}' in guild '${guild.name}'.`);
			broadcastToGuild(guild, true);

			return;
		}
		console.log(`could not find channel in guild '${guild.name}' with required permissions!`);
		existingMessages[guid] = undefined;
	} catch (ex) {
		console.error(ex);
	}
}

client.on("roleUpdate", (_, role) => {
    if (role.members.get(role.guild.me.id))
		initializeGuild(role.guild);
});

client.on("channelUpdate", (_, channel) => {
    initializeGuild(channel.guild);
});

client.on("guildMemberUpdate", (_, member) => {
	console.log(member.id);
    if (member.id == member.guild.me.id)
		initializeGuild(member.guild);
});

client.on("ready", async _ => {
	connected = true;
		
	await Promise.all(client.guilds.cache.map(initializeGuild));
});

client.login(TOKEN);

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


function createMessage(ping, roleId) {
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
		if (!game.started)
			descriptions.push(`**[join](https://multiversechess.com/${game.shortCode})** - **${game.mode}** - **${timeStr}** - vs ${game.opponent.name}`);
		else
			descriptions.push(`**[spectate](https://multiversechess.com/${game.shortCode})** - **${game.mode}** - **${timeStr}** - ${game.players[1].name} vs ${game.players[0].name}`);
	}
	if (lastGames.length == 0)
		embed.setDescription("No games :(");
	else
		embed.setDescription(descriptions.join('\n'));
	// embed.setTimestamp();
	embed.setFooter('multiversechess.com');
	return {
		content: (IS_DEV ? "THIS IS A TEST  " : "") + (ping ? `<@${IS_DEV ? '180017294657716225' : '&' + roleId}>` : ''),
		embed: embed,
	};
}

function broadcastToGuild(guild, silent, ping) {
	const guid = guild.id;
	if (existingMessages[guid]) {
		if (silent) {
			const role = getInviteRole(guild);
			existingMessages[guid].then(message => {
				message.edit(createMessage(false, role.id).embed).catch(console.error);
			});
			return;
		} else {
			existingMessages[guid].then(message => {
				message.delete().catch(console.error);
			});
		}

	}

	for (const [cuid, channel] of guild.channels.cache) {
		if (!isSuitableChannel(channel))
			continue;
		
		const role = getInviteRole(guild);
		if (role) {
			const msg = channel.send(createMessage(ping && lastGames.length, role.id)).catch(console.error);
			existingMessages[guid] = msg;
			msg.then(msg => {
				if (lastGames.length && !ping)
					msg.edit(createMessage(true, role.id)).catch(console.error);
				msg.react(SUBSCRIBE_REACT).then(_ => msg.react(UNSUBSCRIBE_REACT).catch(console.error)).catch(console.error)
			});
			break;
		}
	}
}

function broadcast(silent, ping) {
	for (const [guid, guild] of client.guilds.cache)
		broadcastToGuild(guild, silent, ping);
}


return {
	update: function(games, silent, ping) {
		lastGames = games;
		if (connected)
			broadcast(silent, ping);
	},
};

};