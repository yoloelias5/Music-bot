# Music Bot

An independent Discord slash-command music bot with YouTube playback and queue controls. It is designed to run as a Node.js application on a host such as Wispbyte. It has no dashboard, Spotify integration, lyrics command, or premium command locks.

## Features

- YouTube URLs and song searches
- Queue controls: join, leave, skip, back, jump, clear, shuffle, remove, remove duplicates, play next
- Playback controls: pause, resume, seek, forward, rewind, volume, loop, replay
- Track utilities: search results and send the current track to your DMs
- Optional now-playing announcements
- Automatically leaves after the queue ends or the voice channel becomes empty

## Requirements

- Node.js 20 or newer
- A Discord application and bot

## Run locally

1. In the Discord Developer Portal, create an application and add a bot.
2. Generate an invite with the `bot` and `applications.commands` scopes. Grant **View Channels**, **Send Messages**, **Connect**, and **Speak** permissions.
3. Copy `.env.example` to `.env`.
4. Set `DISCORD_TOKEN` to the bot token and `CLIENT_ID` to the application ID.
5. Optionally set `GUILD_ID` to your test server ID. Guild commands appear faster; leave it blank for global commands.
6. Install and start:

```bash
npm install
npm start
```

## Deploy on Wispbyte

1. Create a Node.js server in your Wispbyte panel.
2. Upload the repository files or connect the GitHub repository if your panel offers that option.
3. Use Node.js 20 or newer.
4. Set the startup command to `npm start`.
5. Add `DISCORD_TOKEN` and `CLIENT_ID` in the server's private environment-variable settings. `GUILD_ID` is optional.
6. Install dependencies with `npm install` if the panel does not install them automatically, then start the server.
7. Check the console logs for the bot login and slash-command registration messages.

Do not paste tokens into chat, commit them to GitHub, or put them in source files. Keep secrets in the host's private environment-variable settings. If a token is exposed, reset it in the Discord Developer Portal.

Hosting availability, resource limits, and free-plan policies are controlled by the hosting provider. The bot can only stay online while its host process is running.

## Commands

| Command | Description |
|---|---|
| `/play query:` | Play a YouTube URL or search for a song |
| `/search query:` | Show YouTube search results |
| `/playnext query:` | Add a track to the front of the queue |
| `/join` / `/leave` | Join or leave your voice channel |
| `/skip` / `/back` | Skip forward or play the previous track |
| `/jump position:` | Skip to an upcoming queue position |
| `/grab` | Send the current track link to your DMs |
| `/queue` / `/nowplaying` | Show the queue or current track |
| `/clear` / `/shuffle` | Clear or shuffle upcoming tracks |
| `/remove position:` | Remove a track by queue position |
| `/removedupes` | Remove duplicate upcoming tracks |
| `/replay` / `/stop` | Restart or stop playback |
| `/pause` / `/resume` | Pause or resume playback |
| `/seek time:` | Jump to a timestamp such as `1:25` |
| `/forward seconds:` / `/rewind seconds:` | Move within the current track |
| `/volume amount:` | Set volume from 1–100 |
| `/loop mode:` | Repeat off, current track, or queue |
| `/announcesongs` | Toggle now-playing messages |

This project is inspired by the command style of music bots such as Green-Bot, but it is independently written and is not an official Green-Bot clone. It does not include a dashboard or paid feature gates.
