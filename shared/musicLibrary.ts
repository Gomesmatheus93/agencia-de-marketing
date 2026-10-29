/**
 * Biblioteca de trilhas para a edição de Reels. Todas do Mixkit, na "Mixkit Stock Music
 * Free License": uso comercial liberado (redes sociais, anúncios, vídeos de marca) e sem
 * exigir crédito. Não pode revender a música sozinha nem registrá-la como nossa.
 * Licença: https://mixkit.co/license/#musicFree (conferida em 29/10/2026).
 */
export type MusicMood = "animada" | "corporativa" | "motivacional" | "tranquila" | "hiphop" | "eletronica";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  mood: MusicMood;
  seconds: number;
  url: string;
};

export const MUSIC_MOODS: Record<MusicMood, string> = {
  animada: "Animada e feliz",
  corporativa: "Corporativa e confiante",
  motivacional: "Motivacional (academia)",
  tranquila: "Tranquila / lo-fi",
  hiphop: "Hip-hop / trap",
  eletronica: "Eletrônica / tecnologia",
};

export const MUSIC_LIBRARY: MusicTrack[] = [
  { id: "mixkit-801", title: "Happy Home", artist: "Michael Ramir C.", mood: "animada", seconds: 110, url: "https://assets.mixkit.co/music/801/801.mp3" },
  { id: "mixkit-5", title: "Feeling Happy", artist: "Ahjay Stelino", mood: "animada", seconds: 148, url: "https://assets.mixkit.co/music/5/5.mp3" },
  { id: "mixkit-158", title: "Happy Times", artist: "Alejandro Magaña (A. M.)", mood: "animada", seconds: 100, url: "https://assets.mixkit.co/music/158/158.mp3" },
  { id: "mixkit-837", title: "Life is a Dream", artist: "Michael Ramir C.", mood: "animada", seconds: 99, url: "https://assets.mixkit.co/music/837/837.mp3" },
  { id: "mixkit-33", title: "Motivating Mornings", artist: "Ahjay Stelino", mood: "corporativa", seconds: 96, url: "https://assets.mixkit.co/music/33/33.mp3" },
  { id: "mixkit-1167", title: "Close Up", artist: "Michael Ramir C.", mood: "corporativa", seconds: 95, url: "https://assets.mixkit.co/music/1167/1167.mp3" },
  { id: "mixkit-834", title: "It's Love", artist: "Michael Ramir C.", mood: "corporativa", seconds: 97, url: "https://assets.mixkit.co/music/834/834.mp3" },
  { id: "mixkit-102", title: "Stylz", artist: "Ahjay Stelino", mood: "corporativa", seconds: 100, url: "https://assets.mixkit.co/music/102/102.mp3" },
  { id: "mixkit-474", title: "What About Action?", artist: "Diego Nava", mood: "motivacional", seconds: 117, url: "https://assets.mixkit.co/music/474/474.mp3" },
  { id: "mixkit-1068", title: "K.O.", artist: "Michael Ramir C.", mood: "motivacional", seconds: 101, url: "https://assets.mixkit.co/music/1068/1068.mp3" },
  { id: "mixkit-51", title: "Sports Highlights", artist: "Ahjay Stelino", mood: "motivacional", seconds: 96, url: "https://assets.mixkit.co/music/51/51.mp3" },
  { id: "mixkit-349", title: "Basketball Training", artist: "Arulo", mood: "motivacional", seconds: 112, url: "https://assets.mixkit.co/music/349/349.mp3" },
  { id: "mixkit-175", title: "Digital Clouds", artist: "Alejandro Magaña (A. M.)", mood: "tranquila", seconds: 101, url: "https://assets.mixkit.co/music/175/175.mp3" },
  { id: "mixkit-480", title: "Curiosity", artist: "Diego Nava", mood: "tranquila", seconds: 100, url: "https://assets.mixkit.co/music/480/480.mp3" },
  { id: "mixkit-766", title: "Lo-Fi 04", artist: "Lily J", mood: "tranquila", seconds: 164, url: "https://assets.mixkit.co/music/766/766.mp3" },
  { id: "mixkit-988", title: "Day Dreamin' with U", artist: "Michael Ramir C.", mood: "tranquila", seconds: 118, url: "https://assets.mixkit.co/music/988/988.mp3" },
  { id: "mixkit-738", title: "Hip Hop 02", artist: "Lily J", mood: "hiphop", seconds: 115, url: "https://assets.mixkit.co/music/738/738.mp3" },
  { id: "mixkit-282", title: "Sweet September", artist: "Arulo", mood: "hiphop", seconds: 99, url: "https://assets.mixkit.co/music/282/282.mp3" },
  { id: "mixkit-400", title: "C.B.P.D", artist: "Arulo", mood: "hiphop", seconds: 99, url: "https://assets.mixkit.co/music/400/400.mp3" },
  { id: "mixkit-318", title: "Thunder", artist: "Arulo", mood: "hiphop", seconds: 101, url: "https://assets.mixkit.co/music/318/318.mp3" },
  { id: "mixkit-726", title: "Uplifting Bass", artist: "Lily J", mood: "eletronica", seconds: 96, url: "https://assets.mixkit.co/music/726/726.mp3" },
  { id: "mixkit-440", title: "Infinity", artist: "Arulo", mood: "eletronica", seconds: 103, url: "https://assets.mixkit.co/music/440/440.mp3" },
  { id: "mixkit-729", title: "Pop Track 03", artist: "Lily J", mood: "eletronica", seconds: 97, url: "https://assets.mixkit.co/music/729/729.mp3" },
  { id: "mixkit-126", title: "Trap Electro Vibes", artist: "Alejandro Magaña (A. M.)", mood: "eletronica", seconds: 116, url: "https://assets.mixkit.co/music/126/126.mp3" },
];

export const MUSIC_LICENSE_NOTE = "Mixkit Stock Music Free License: uso comercial em redes sociais e anúncios, sem crédito obrigatório.";

export function musicById(id: string | null | undefined): MusicTrack | undefined {
  return id ? MUSIC_LIBRARY.find((m) => m.id === id) : undefined;
}
