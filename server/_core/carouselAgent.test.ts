import { describe, it, expect } from "vitest";
import { adjustSlideCount } from "./carouselAgent";

type Slide = Parameters<typeof adjustSlideCount>[0][number];

function makeSlide(type: "hook" | "development" | "cta", index: number): Slide {
  return {
    title: `Slide ${index}`,
    body: `Body ${index}`,
    imageSearchQuery: "",
    slideType: type,
    highlightWords: [],
  };
}

function makeSlides(...types: Array<"hook" | "development" | "cta">): Slide[] {
  return types.map((t, i) => makeSlide(t, i + 1));
}

describe("adjustSlideCount", () => {
  it("nao altera quando já tem o número correto", () => {
    const slides = makeSlides("hook", "development", "development", "cta");
    adjustSlideCount(slides, 4);
    expect(slides).toHaveLength(4);
  });

  it("remove slides do meio quando tem slides a mais", () => {
    const slides = makeSlides("hook", "development", "development", "development", "cta");
    adjustSlideCount(slides, 3);
    expect(slides).toHaveLength(3);
    expect(slides[0].slideType).toBe("hook");
    expect(slides[slides.length - 1].slideType).toBe("cta");
  });

  it("preenche com slide de desenvolvimento quando falta 1", () => {
    const slides = makeSlides("hook", "development", "cta");
    adjustSlideCount(slides, 4);
    expect(slides).toHaveLength(4);
    expect(slides[0].slideType).toBe("hook");
    expect(slides[slides.length - 1].slideType).toBe("cta");
  });

  it("preenche quando faltam 2 slides", () => {
    const slides = makeSlides("hook", "development", "cta");
    adjustSlideCount(slides, 5);
    expect(slides).toHaveLength(5);
  });

  it("preenche quando faltam 3 slides", () => {
    const slides = makeSlides("hook", "development", "cta");
    adjustSlideCount(slides, 6);
    expect(slides).toHaveLength(6);
    expect(slides[0].slideType).toBe("hook");
    expect(slides[slides.length - 1].slideType).toBe("cta");
  });

  it("lança erro quando faltam mais de 3 slides", () => {
    const slides = makeSlides("hook", "development", "cta");
    expect(() => adjustSlideCount(slides, 8)).toThrow(/Tente novamente/);
  });

  it("funciona para 10 slides com 9 retornados", () => {
    const slides = makeSlides("hook", "development", "development", "development", "development", "development", "development", "development", "cta");
    expect(slides).toHaveLength(9);
    adjustSlideCount(slides, 10);
    expect(slides).toHaveLength(10);
    expect(slides[0].slideType).toBe("hook");
    expect(slides[9].slideType).toBe("cta");
  });

  it("funciona para 10 slides com 11 retornados (remove excesso)", () => {
    const slides = makeSlides("hook", "development", "development", "development", "development", "development", "development", "development", "development", "development", "cta");
    expect(slides).toHaveLength(11);
    adjustSlideCount(slides, 10);
    expect(slides).toHaveLength(10);
    expect(slides[0].slideType).toBe("hook");
    expect(slides[9].slideType).toBe("cta");
  });

  it("nao altera quando target === slides.length (sem chamadas desnecessárias)", () => {
    const slides = makeSlides("hook", "development", "development", "development", "development", "development", "development", "development", "development", "cta");
    adjustSlideCount(slides, 10);
    expect(slides).toHaveLength(10);
  });
});
