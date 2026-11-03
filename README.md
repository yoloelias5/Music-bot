# Music Bot

A Discord slash-command music bot with YouTube playback/search and optional Spotify link lookup.

## Features

- YouTube URLs and song searches
- Spotify track, album, and playlist links (Spotify metadata lookup, then searches YouTube for matching audio)
- Slash commands: `/play`, `/skip`, `/stop`, `/pause`, `/resume`, `/queue`, `/nowplaying`, `/volume`, and `/loop`
- Automatically leaves after the queue ends or the voice channel becomes empty

> Spotify itself does not provide streamable audio through its Web API. Spotify links identify tracks; playback is searched on YouTube.

## Requirements

- Node.js 20 or newer
- A Discord application and bot
- Optional Spotify developer app for Spotify link lookup

## Setup

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

Never upload your real `.env` file or bot token to GitHub. If a token was exposed, reset it in the Developer Portal.

## Commands

| Command | Description |
|---|---|
| `/play query:` | Play a YouTube URL/search or Spotify link |
| `/skip` | Skip the current track |
| `/stop` | Stop and clear the queue |
| `/pause` / `/resume` | Pause or resume |
| `/queue` | Show upcoming tracks |
| `/nowplaying` | Show the current track |
| `/volume amount:` | Set volume from 1–100 |
| `/loop mode:` | Repeat off, current track, or queue |
