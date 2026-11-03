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
const { Player, useHistory } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei');

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
const YOUTUBE_SEARCH_ENGINE = `ext:${YoutubeiExtractor.identifier}`;
const announceSongs = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube song or search for a track')
    .addStringOption(option => option.setName('query').setDescription('YouTube URL or song name').setRequired(true)),
  new SlashCommandBuilder().setName('join').setDescription('Join your voice channel'),
  new SlashCommandBuilder().setName('leave').setDescription('Leave the voice channel'),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  new SlashCommandBuilder().setName('back').setDescription('Play the previous track'),
  new SlashCommandBuilder().setName('grab').setDescription('Send the current track to your DMs'),
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search YouTube for tracks')
    .addStringOption(option => option.setName('query').setDescription('Song name or keywords').setRequired(true)),
  new SlashCommandBuilder()
    .setName('playnext')
    .setDescription('Add a YouTube track to the front of the queue')
    .addStringOption(option => option.setName('query').setDescription('YouTube URL or song name').setRequired(true)),
  new SlashCommandBuilder().setName('removedupes').setDescription('Remove duplicate tracks from the queue').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('announcesongs').setDescription('Toggle now-playing announcements').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('replay').setDescription('Restart the current song'),
  new SlashCommandBuilder().setName('clear').setDescription('Clear upcoming songs'),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle upcoming songs'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue')
    .addIntegerOption(option => option.setName('position').setDescription('Position in the upcoming queue').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Jump to a timestamp in the current song')
    .addStringOption(option => option.setName('time').setDescription('Timestamp, for example 1:25').setRequired(true)),
  new SlashCommandBuilder()
    .setName('forward')
    .setDescription('Move forward in the current song')
    .addIntegerOption(option => option.setName('seconds').setDescription('Seconds to move forward').setMinValue(1).setMaxValue(600).setRequired(true)),
  new SlashCommandBuilder()
    .setName('rewind')
    .setDescription('Move backward in the current song')
    .addIntegerOption(option => option.setName('seconds').setDescription('Seconds to move backward').setMinValue(1).setMaxValue(600).setRequired(true)),
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

function parseTimestamp(value) {
  const parts = value.split(':').map(Number);
  if (!parts.length || parts.some(part => !Number.isInteger(part) || part < 0) || parts.length > 3) {
    throw new Error('Use a timestamp like 1:25 or 1:02:30.');
  }
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds * 1000;
}

function getQueue(guildId) {
  return player.nodes.get(guildId);
}

function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(url.hostname);
  } catch {
    return false;
  }
}

function normalizeYouTubeUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith('youtube.com') && url.pathname.startsWith('/shorts/')) {
      const videoId = url.pathname.split('/')[2];
      if (videoId) {
        url.pathname = '/watch';
        url.search = '';
        url.searchParams.set('v', videoId);
      }
    }
    return url.toString();
  } catch {
    return value;
  }
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
        if (/^https?:\/\//i.test(input) && !isYouTubeUrl(input)) {
          return interaction.editReply('This bot supports YouTube links only. Use a YouTube URL or search by song name.');
        }
        const playInput = isYouTubeUrl(input) ? normalizeYouTubeUrl(input) : input;
        const result = await player.search(playInput, {
          searchEngine: YOUTUBE_SEARCH_ENGINE,
          requestedBy: interaction.user,
        });
        if (!result.hasTracks()) throw new Error('No YouTube results found. Try another song or link.');
        const { track } = await player.play(voiceChannel, result, {
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

      case 'join': {
        if (!voiceChannel) return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
        const activeQueue = queue || player.nodes.create(interaction.guild, {
          metadata: { channel: interaction.channel },
          selfDeaf: true,
        });
        if (!activeQueue.connection) await activeQueue.connect(voiceChannel);
        return interaction.reply('🔊 Joined your voice channel.');
      }
      case 'leave': {
        if (!queue) return interaction.reply({ content: 'I am not in a voice channel.', ephemeral: true });
        queue.delete();
        return interaction.reply('👋 Left the voice channel.');
      }
      case 'back': {
        const history = useHistory(interaction.guildId);
        if (!history?.previousTrack) return interaction.reply({ content: 'There is no previous track to play.', ephemeral: true });
        await history.previous();
        return interaction.reply('⏮️ Playing the previous track.');
      }
      case 'grab': {
        if (!queue?.currentTrack) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        const track = queue.currentTrack;
        await interaction.user.send({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Saved track')
            .setDescription(`[${track.title}](${track.url})`)
            .setThumbnail(track.thumbnail || null)],
        });
        return interaction.reply({ content: '📩 Sent the current track to your DMs.', ephemeral: true });
      }
      case 'search': {
        await interaction.deferReply({ ephemeral: true });
        const query = interaction.options.getString('query', true);
        const result = await player.search(query, {
          searchEngine: YOUTUBE_SEARCH_ENGINE,
          requestedBy: interaction.user,
        });
        const tracks = result.tracks.slice(0, 5);
        if (!tracks.length) return interaction.editReply('No YouTube results found. Try a more specific search.');
        const lines = tracks.map((track, index) => `**${index + 1}.** [${track.title}](${track.url}) · ${track.duration}`);
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('YouTube search results')
            .setDescription(lines.join('\\n'))
            .setFooter({ text: 'Use /play with the title or link you want.' })],
        });
      }
      case 'playnext': {
        if (!voiceChannel) return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
        if (!queue?.currentTrack) return interaction.reply({ content: 'Start a song first with /play, then use /playnext.', ephemeral: true });
        await interaction.deferReply();
        const query = interaction.options.getString('query', true);
        if (/^https?:\/\//i.test(query) && !isYouTubeUrl(query)) {
          return interaction.editReply('This bot supports YouTube links only.');
        }
        const searchInput = isYouTubeUrl(query) ? normalizeYouTubeUrl(query) : query;
        const result = await player.search(searchInput, {
          searchEngine: YOUTUBE_SEARCH_ENGINE,
          requestedBy: interaction.user,
        });
        const track = result.tracks[0];
        if (!track) return interaction.editReply('No YouTube results found.');
        queue.insertTrack(track, 0);
        return interaction.editReply(`⏭️ Added **[${track.title}](${track.url})** to play next.`);
      }
      case 'removedupes': {
        if (!queue || queue.tracks.size < 2) return interaction.reply('There are no duplicate upcoming tracks.');
        const seen = new Set();
        let removed = 0;
        for (const track of queue.tracks.toArray()) {
          const key = track.title.trim().toLowerCase();
          if (seen.has(key)) {
            queue.removeTrack(track);
            removed++;
          } else {
            seen.add(key);
          }
        }
        return interaction.reply(`🧹 Removed **${removed}** duplicate track(s).`);
      }
      case 'announcesongs': {
        const enabled = !(announceSongs.get(interaction.guildId) ?? true);
        announceSongs.set(interaction.guildId, enabled);
        return interaction.reply(`🔔 Song announcements are now **${enabled ? 'ON' : 'OFF'}**.`);
      }
      case 'skip': {
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        queue.node.skip();
        return interaction.reply('⏭️ Skipped.');
      }
      case 'replay': {
        if (!queue?.currentTrack) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        await queue.node.seek(0);
        return interaction.reply('⏮️ Restarted the current song.');
      }
      case 'clear': {
        if (!queue) return interaction.reply({ content: 'There is no active queue.', ephemeral: true });
        const count = queue.tracks.size;
        queue.tracks.clear();
        return interaction.reply(`🧹 Cleared **${count}** upcoming song(s).`);
      }
      case 'shuffle': {
        if (!queue || queue.tracks.size < 2) return interaction.reply({ content: 'Add at least two upcoming songs first.', ephemeral: true });
        queue.tracks.shuffle();
        return interaction.reply('🔀 Shuffled the queue.');
      }
      case 'remove': {
        if (!queue) return interaction.reply({ content: 'There is no active queue.', ephemeral: true });
        const position = interaction.options.getInteger('position', true);
        const track = queue.tracks.at(position - 1);
        if (!track) return interaction.reply({ content: 'That queue position does not exist.', ephemeral: true });
        queue.removeTrack(track);
        return interaction.reply(`🗑️ Removed **${track.title}** from the queue.`);
      }
      case 'seek': {
        if (!queue?.currentTrack) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        const time = interaction.options.getString('time', true);
        const milliseconds = parseTimestamp(time);
        if (queue.currentTrack.durationMS && milliseconds >= queue.currentTrack.durationMS) {
          return interaction.reply({ content: 'That timestamp is beyond the song length.', ephemeral: true });
        }
        await queue.node.seek(milliseconds);
        return interaction.reply(`⏩ Jumped to **${time}**.`);
      }
      case 'forward':
      case 'rewind': {
        if (!queue?.currentTrack) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        const seconds = interaction.options.getInteger('seconds', true);
        const delta = seconds * 1000 * (interaction.commandName === 'forward' ? 1 : -1);
        const current = queue.node.getTimestamp()?.current ?? 0;
        const target = Math.max(0, current + delta);
        if (queue.currentTrack.durationMS && target >= queue.currentTrack.durationMS) {
          return interaction.reply({ content: 'That would go beyond the end of the song.', ephemeral: true });
        }
        await queue.node.seek(target);
        return interaction.reply(interaction.commandName === 'forward' ? `⏩ Forwarded **${seconds} seconds**.` : `⏪ Rewound **${seconds} seconds**.`);
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
          .setDescription(`**Now playing:** [${queue.currentTrack.title}](${queue.currentTrack.url})\\n\\n${lines.length ? lines.join('\\n') : 'No upcoming tracks.'}`)
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
  if (channel && announceSongs.get(queue.guild.id) !== false) {
    channel.send(`🎶 Now playing: **[${track.title}](${track.url})**`).catch(() => {});
  }
});
player.events.on('error', (queue, error) => console.error(`Player error in ${queue.guild.id}:`, error));
player.events.on('playerError', (queue, error) => console.error(`Track error in ${queue.guild.id}:`, error));

(async () => {
  try {
    // Register only the YouTube extractor. Loading discord-player's default
    // pack also loads unrelated providers (including Spotify) and the legacy
    // ytdl extractor, which this YouTube-only bot does not use.
    await player.extractors.register(YoutubeiExtractor, {});
    console.log('YouTubei extractor registered (regular YouTube search mode).');
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Bot startup failed:', error);
    process.exit(1);
  }
})();
