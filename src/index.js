require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const player = new Player(client);

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube song or search for a track (Spotify links supported)')
    .addStringOption(option => option.setName('query').setDescription('Song name or URL').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
  new SlashCommandBuilder().setName('queue').setDescription('Show the upcoming songs'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current song'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set playback volume')
    .addIntegerOption(option => option.setName('amount').setDescription('Volume from 1 to 100').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the repeat mode')
    .addStringOption(option => option.setName('mode').setDescription('Repeat mode').setRequired(true)
      .addChoices(
        { name: 'Off', value: 'off' },
        { name: 'Track', value: 'track' },
        { name: 'Queue', value: 'queue' },
      )),
].map(command => command.toJSON());

async function spotifyToSearch(query) {
  const match = query.match(/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]+)/i);
  if (!match) return query;

  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) {
    throw new Error('Spotify links need SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env. You can still play YouTube links and searches.');
  }

  const credentials = Buffer.from(`${id}:${secret}`).toString('base64');
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!tokenResponse.ok) throw new Error('Could not authenticate with Spotify. Check your Spotify API credentials.');
  const tokenData = await tokenResponse.json();

  const [, type, spotifyId] = match;
  const endpoint = type === 'track'
    ? `tracks/${spotifyId}`
    : `${type}s/${spotifyId}`;
  const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!response.ok) throw new Error('Could not read that Spotify link. Check that it is public and try again.');
  const data = await response.json();

  if (type === 'track') {
    return `${data.name} ${data.artists.map(artist => artist.name).join(' ')}`;
  }
  const tracks = type === 'album' ? data.tracks?.items : data.tracks?.items;
  const firstTrack = tracks?.[0];
  if (!firstTrack) throw new Error('No playable tracks were found in that Spotify link.');
  return `${firstTrack.name} ${firstTrack.artists.map(artist => artist.name).join(' ')}`;
}

function getQueue(guildId) {
  return player.nodes.get(guildId);
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Could not register slash commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const voiceChannel = interaction.member?.voice?.channel;
  const queue = getQueue(interaction.guildId);

  try {
    switch (interaction.commandName) {
      case 'play': {
        if (!voiceChannel) {
          return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
        }
        const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
          return interaction.reply({ content: 'I need permission to **Connect** and **Speak** in your voice channel.', ephemeral: true });
        }

        await interaction.deferReply();
        const input = interaction.options.getString('query', true);
        const searchQuery = await spotifyToSearch(input);
        const { track } = await player.play(voiceChannel, searchQuery, {
          nodeOptions: {
            metadata: { channel: interaction.channel },
            volume: 70,
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 60_000,
            leaveOnEnd: true,
            leaveOnEndCooldown: 15_000,
            leaveOnStop: true,
            selfDeaf: true,
          },
        });
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Added to queue')
          .setDescription(`[${track.title}](${track.url})`)
          .setThumbnail(track.thumbnail || null)
          .addFields({ name: 'Duration', value: track.duration || 'Live', inline: true })
          .setFooter({ text: `Requested by ${interaction.user.username}` });
        return interaction.editReply({ embeds: [embed] });
      }

      case 'skip': {
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        queue.node.skip();
        return interaction.reply('⏭️ Skipped.');
      }
      case 'stop': {
        if (!queue) return interaction.reply({ content: 'There is no active queue.', ephemeral: true });
        queue.delete();
        return interaction.reply('⏹️ Playback stopped and the queue was cleared.');
      }
      case 'pause': {
        if (!queue?.isPlaying()) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        queue.node.pause();
        return interaction.reply('⏸️ Paused.');
      }
      case 'resume': {
        if (!queue) return interaction.reply({ content: 'There is no active queue.', ephemeral: true });
        queue.node.resume();
        return interaction.reply('▶️ Resumed.');
      }
      case 'queue': {
        if (!queue?.currentTrack) return interaction.reply('The queue is empty.');
        const upcoming = queue.tracks.toArray().slice(0, 10);
        const lines = upcoming.map((track, index) => `**${index + 1}.** [${track.title}](${track.url}) · ${track.duration}`);
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Music queue')
          .setDescription(`**Now playing:** [${queue.currentTrack.title}](${queue.currentTrack.url})\n\n${lines.length ? lines.join('\n') : 'No upcoming tracks.'}`)
          .setFooter({ text: `${queue.tracks.size} upcoming track(s)` });
        return interaction.reply({ embeds: [embed] });
      }
      case 'nowplaying': {
        if (!queue?.currentTrack) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        const track = queue.currentTrack;
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Now playing')
          .setDescription(`[${track.title}](${track.url})`)
          .setThumbnail(track.thumbnail || null)
          .addFields({ name: 'Duration', value: track.duration || 'Live', inline: true });
        return interaction.reply({ embeds: [embed] });
      }
      case 'volume': {
        if (!queue) return interaction.reply({ content: 'There is no active queue.', ephemeral: true });
        const amount = interaction.options.getInteger('amount', true);
        queue.node.setVolume(amount);
        return interaction.reply(`🔊 Volume set to **${amount}%**.`);
      }
      case 'loop': {
        if (!queue) return interaction.reply({ content: 'There is no active queue.', ephemeral: true });
        const mode = interaction.options.getString('mode', true);
        const repeatMode = { off: 0, track: 1, queue: 2 }[mode];
        queue.setRepeatMode(repeatMode);
        return interaction.reply(`🔁 Repeat mode: **${mode}**.`);
      }
    }
  } catch (error) {
    console.error('Command error:', error);
    const message = error.message?.includes('No results')
      ? 'No results found. Try another song or link.'
      : (error.message || 'Something went wrong while handling that command.');
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: message, embeds: [] }).catch(() => {});
    }
    return interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
});

player.events.on('playerStart', (queue, track) => {
  const channel = queue.metadata?.channel;
  if (channel) {
    channel.send(`🎶 Now playing: **[${track.title}](${track.url})**`).catch(() => {});
  }
});
player.events.on('error', (queue, error) => console.error(`Player error in ${queue.guild.id}:`, error));
player.events.on('playerError', (queue, error) => console.error(`Track error in ${queue.guild.id}:`, error));

(async () => {
  try {
    await player.extractors.loadMulti(DefaultExtractors);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Bot startup failed:', error);
    process.exit(1);
  }
})();
