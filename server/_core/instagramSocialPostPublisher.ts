import { TRPCError } from "@trpc/server";
import type { SocialPost } from "../../drizzle/schema";
import {
  publishInstagramCarouselWithAgent,
  type InstagramPostingInput,
  type InstagramPostingSlide,
} from "./instagramPostingAgent";

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

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
  let publishingInput: InstagramPostingInput;

  if (carouselPayload) {
    publishingInput = {
      userId: post.userId,
      topic: carouselPayload.topic || post.title || "Carrossel Instagram",
      hook: carouselPayload.hook,
      caption: carouselPayload.caption || post.content,
      finalCta: carouselPayload.finalCta,
      slides: carouselPayload.slides,
    };
  } else {
    const imageUrl = post.imageUrl?.trim();
    if (!imageUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Para publicar no Instagram, adicione uma imagem ao post.",
      });
    }

    const title = compactText(post.title || post.content).slice(0, 120) || "Post Instagram";
    publishingInput = {
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
  }

  const result = await publishInstagramCarouselWithAgent(publishingInput);

  return {
    result,
    publicImageUrl: result.slideUrls[0],
  };
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
