import { TRPCError } from "@trpc/server";
import type { SocialPost } from "../../drizzle/schema";
import {
  publishInstagramCarouselWithAgent,
  publishInstagramReelsPost,
  type InstagramPostingInput,
  type InstagramPostingSlide,
} from "./instagramPostingAgent";

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const VIDEO_URL_RE = /\.(mp4|mov|webm|avi)(\?|$)/i;

type ScheduledInstagramCarouselPayload = {
  kind: "instagram_carousel";
  topic: string;
  hook?: string;
  caption?: string;
  finalCta?: string;
  slides: InstagramPostingSlide[];
};

function parseScheduledCarouselPayload(metadata?: string | null) {
  if (!metadata?.trim()) return undefined;

  try {
    const parsed = JSON.parse(metadata) as ScheduledInstagramCarouselPayload;
    if (
      parsed.kind === "instagram_carousel" &&
      Array.isArray(parsed.slides) &&
      parsed.slides.length > 0
    ) {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function publishInstagramSocialPost(post: SocialPost) {
  if (post.channel !== "instagram") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Este publicador so aceita posts do Instagram.",
    });
  }

  const carouselPayload = parseScheduledCarouselPayload(post.metadata);

  // Carousel post from the Carousel tab
  if (carouselPayload) {
    const publishingInput: InstagramPostingInput = {
      userId: post.userId,
      topic: carouselPayload.topic || post.title || "Carrossel Instagram",
      hook: carouselPayload.hook,
      caption: carouselPayload.caption || post.content,
      finalCta: carouselPayload.finalCta,
      slides: carouselPayload.slides,
    };
    const result = await publishInstagramCarouselWithAgent(publishingInput);
    return { result, publicImageUrl: result.slideUrls[0] };
  }

  const imageUrl = post.imageUrl?.trim();
  if (!imageUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Para publicar no Instagram, adicione uma imagem ao post.",
    });
  }

  // Video post → publish as Instagram Reels
  if (VIDEO_URL_RE.test(imageUrl)) {
    const caption = compactText(post.content || post.title || "").slice(0, 2200);
    const result = await publishInstagramReelsPost({
      userId: post.userId,
      videoUrl: imageUrl,
      caption,
    });
    return { result, publicImageUrl: undefined };
  }

  // Single image post
  const title = compactText(post.title || post.content).slice(0, 120) || "Post Instagram";
  const publishingInput: InstagramPostingInput = {
    userId: post.userId,
    topic: title,
    caption: post.content,
    slides: [
      {
        title,
        body: post.content,
        ...(imageUrl.startsWith("data:image/") ? { imageDataUrl: imageUrl } : { imageUrl }),
      },
    ],
  };
  const result = await publishInstagramCarouselWithAgent(publishingInput);
  return { result, publicImageUrl: result.slideUrls[0] };
}

export function buildScheduledInstagramCarouselMetadata(input: Omit<InstagramPostingInput, "userId">) {
  return JSON.stringify({
    kind: "instagram_carousel",
    topic: input.topic,
    hook: input.hook,
    caption: input.caption,
    finalCta: input.finalCta,
    slides: input.slides,
  } satisfies ScheduledInstagramCarouselPayload);
}
