import type { SocialNetwork } from "./types";

/**
 * People's own social links. Each must be an https address on that
 * network's own site, so a signature can't be pointed somewhere else.
 */

export const SOCIAL_HOSTS: Record<SocialNetwork, string[]> = {
  linkedin: ["linkedin.com"],
  x: ["x.com", "twitter.com"],
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  github: ["github.com"],
  whatsapp: ["wa.me", "whatsapp.com"],
  threads: ["threads.net", "threads.com"],
};

export const SOCIAL_NAME: Record<SocialNetwork, string> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  github: "GitHub",
  whatsapp: "WhatsApp",
  threads: "Threads",
};

export const SOCIAL_EXAMPLE: Record<SocialNetwork, string> = {
  linkedin: "https://www.linkedin.com/in/your-name",
  x: "https://x.com/yourname",
  facebook: "https://www.facebook.com/yourname",
  instagram: "https://www.instagram.com/yourname",
  youtube: "https://www.youtube.com/@yourname",
  tiktok: "https://www.tiktok.com/@yourname",
  github: "https://github.com/yourname",
  whatsapp: "https://wa.me/26771234567",
  threads: "https://www.threads.net/@yourname",
};

/** The cleaned link, "" to clear it, or an error message. */
export function cleanSocialUrl(network: SocialNetwork, input: string): { url: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { url: "" };
  if (raw.length > 300) return { error: `That ${SOCIAL_NAME[network]} link is too long.` };
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { error: `Enter a ${SOCIAL_NAME[network]} link, like ${SOCIAL_EXAMPLE[network]}.` };
  }
  const host = url.hostname.toLowerCase();
  const onNetwork = SOCIAL_HOSTS[network].some((h) => host === h || host.endsWith(`.${h}`));
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: `Enter a ${SOCIAL_NAME[network]} link, like ${SOCIAL_EXAMPLE[network]}.` };
  if (!onNetwork || url.username || url.password || url.port) return { error: `That isn't a ${SOCIAL_NAME[network]} link. It should look like ${SOCIAL_EXAMPLE[network]}.` };
  if (url.pathname === "/" || url.pathname === "") return { error: `Add your profile to the ${SOCIAL_NAME[network]} link, like ${SOCIAL_EXAMPLE[network]}.` };
  url.protocol = "https:";
  return { url: url.toString() };
}
