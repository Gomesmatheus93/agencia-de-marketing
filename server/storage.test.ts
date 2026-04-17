import { describe, expect, it } from "vitest";
import { buildAwsPublicUrl, extractCatboxPublicUrl } from "./storage";

describe("extractCatboxPublicUrl", () => {
  it("returns the direct URL when Catbox responds with plain text", () => {
    expect(
      extractCatboxPublicUrl({
        bodyText: "https://files.catbox.moe/video.mp4",
      })
    ).toBe("https://files.catbox.moe/video.mp4");
  });

  it("extracts the URL when Catbox returns extra text around it", () => {
    expect(
      extractCatboxPublicUrl({
        bodyText: "Upload complete: https://files.catbox.moe/avatar.png",
      })
    ).toBe("https://files.catbox.moe/avatar.png");
  });

  it("falls back to the location header when the body is empty", () => {
    const headers = new Headers({
      location: "https://files.catbox.moe/final.webm",
    });

    expect(
      extractCatboxPublicUrl({
        bodyText: "",
        headers,
      })
    ).toBe("https://files.catbox.moe/final.webm");
  });

  it("falls back to the redirected response URL when needed", () => {
    expect(
      extractCatboxPublicUrl({
        bodyText: "",
        responseUrl: "https://files.catbox.moe/rendered.png",
      })
    ).toBe("https://files.catbox.moe/rendered.png");
  });
});

describe("buildAwsPublicUrl", () => {
  it("builds a public S3 URL from bucket, region and key", () => {
    expect(
      buildAwsPublicUrl(
        { bucket: "meu-bucket", region: "sa-east-1" },
        "generated-images/imagem 1.png"
      )
    ).toBe("https://meu-bucket.s3.sa-east-1.amazonaws.com/generated-images/imagem%201.png");
  });

  it("uses a custom public base URL when configured", () => {
    expect(
      buildAwsPublicUrl(
        {
          bucket: "meu-bucket",
          publicBaseUrl: "https://cdn.example.com/assets/",
          region: "sa-east-1",
        },
        "/instagram/carousels/slide.png"
      )
    ).toBe("https://cdn.example.com/assets/instagram/carousels/slide.png");
  });
});
