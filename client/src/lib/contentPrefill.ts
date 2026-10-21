// Pauta repassada entre telas (SEO / Calendário → telas de criação) via
// sessionStorage, para abrir a criação já preenchida.
export type ContentPrefill = {
  topicAngleId?: number;
  topic: string;
  hook: string;
  hookType: string;
};
