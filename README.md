# Music Bot

A Discord slash-command music bot with YouTube playback/search and optional Spotify link lookup. It is designed to run as a Node.js application on a host such as Wispbyte. It has no dashboard and no premium command locks.

## Features

- YouTube URLs and song searches
- Spotify track, album, and playlist links (Spotify metadata lookup, then searches YouTube for matching audio)
- Queue controls: join, leave, skip, replay, clear, shuffle, remove
- Playback controls: pause, resume, seek, forward, rewind, volume, loop
- Queue and now-playing displays
- Automatically leaves after the queue ends or the voice channel becomes empty

> Spotify itself does not provide streamable audio through its Web API. Spotify links identify tracks; playback is searched on YouTube. Spotify lookup requires optional Spotify API credentials.

## Requirements

- Node.js 20 or newer
- A Discord application and bot
- Optional Spotify developer app for Spotify link lookup

## Run locally

1. In the Discord Developer Portal, create an application and add a bot.
2. Generate an invite with the `bot` and `applications.commands` scopes. Grant **View Channels**, **Send Messages**, **Connect**, and **Speak** permissions.
3. Copy `.env.example` to `.env`.
4. Set `DISCORD_TOKEN` to the bot token and `CLIENT_ID` to the application ID.
5. Optionally set `GUILD_ID` to your test server ID. Guild commands appear faster; leave it blank for global commands.
6. For Spotify link lookup, create an app in the Spotify Developer Dashboard and set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
7. Install and start:

```bash
npm install
npm start
```

## Deploy on Wispbyte

1. Create a Node.js server in your Wispbyte panel.
2. Upload the repository files or connect the GitHub repository if your panel offers that option.
3. Use Node.js 20 or newer.
4. Set the startup command to `npm start` (the repository already defines this script).
5. Add these environment variables in the server's environment/startup settings:
   - `DISCORD_TOKEN` — your Discord bot token
   - `CLIENT_ID` — your Discord application ID
   - `GUILD_ID` — optional test server ID
   - `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` — optional Spotify lookup credentials
6. Install dependencies with `npm install` if the panel does not install them automatically, then start the server.
7. Check the console logs. A successful start prints the bot login and slash-command registration messages.

Do not paste tokens into chat, commit them to GitHub, or put them in source files. Keep secrets in the host's private environment-variable settings. If a token is exposed, reset it in the Discord Developer Portal.

Hosting availability, resource limits, and free-plan policies are controlled by the hosting provider. The bot can only stay online while its host process is running.

## Commands

| Command | Description |
|---|---|
| `/play query:` | Play a YouTube URL/search or Spotify link |
| `/join` | Join your current voice channel |
| `/leave` | Leave the voice channel |
| `/skip` | Skip the current track |
| `/replay` | Restart the current track |
| `/stop` | Stop and clear the queue |
| `/pause` / `/resume` | Pause or resume |
| `/queue` | Show upcoming tracks |
| `/nowplaying` | Show the current track |
| `/clear` | Clear upcoming tracks |
| `/shuffle` | Shuffle upcoming tracks |
| `/remove position:` | Remove a track by its queue position |
| `/seek time:` | Jump to a timestamp such as `1:25` |
| `/forward seconds:` | Move forward in the current track |
| `/rewind seconds:` | Move backward in the current track |
| `/volume amount:` | Set volume from 1–100 |
| `/loop mode:` | Repeat off, current track, or queue |

This is an independent community bot, not an official Green-Bot clone. It does not include a dashboard or paid feature gates.
