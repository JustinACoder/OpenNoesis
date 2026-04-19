const DEFAULT_DISCORD_INVITE_URL = "https://discord.gg/cMwUJkdTJ4";

export function getDiscordInviteUrl(): string {
  return process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || DEFAULT_DISCORD_INVITE_URL;
}
