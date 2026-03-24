import type { DesignType, ProjectType } from "@prisma/client";

type Metadata = Record<string, unknown> | null | undefined;

export interface SuitePack {
  key: string;
  label: string;
  heroDesignType: DesignType;
  designTypes: DesignType[];
  designRoleLabels: Partial<Record<DesignType, string>>;
}

const WEDDING_FULL_SUITE: DesignType[] = [
  "WEDDING_INVITATION",
  "WEDDING_SAVE_THE_DATE",
  "WEDDING_RSVP_CARD",
  "WEDDING_MENU_CARD",
  "WEDDING_TABLE_NUMBER",
  "WEDDING_WELCOME_SIGN",
  "WEDDING_THANK_YOU",
  "WEDDING_INSTAGRAM_POST",
  "WEDDING_WHATSAPP_CARD",
];

const WEDDING_ENGAGEMENT_SUITE: DesignType[] = [
  "WEDDING_INVITATION",
  "WEDDING_SAVE_THE_DATE",
  "WEDDING_RSVP_CARD",
  "WEDDING_WELCOME_SIGN",
  "WEDDING_THANK_YOU",
  "WEDDING_INSTAGRAM_POST",
  "WEDDING_WHATSAPP_CARD",
];

const WEDDING_EVENT_PACK: DesignType[] = [
  "WEDDING_INVITATION",
  "WEDDING_RSVP_CARD",
  "WEDDING_MENU_CARD",
  "WEDDING_WELCOME_SIGN",
  "WEDDING_THANK_YOU",
  "WEDDING_INSTAGRAM_POST",
  "WEDDING_WHATSAPP_CARD",
];

const WEDDING_RECEPTION_PACK: DesignType[] = [
  "WEDDING_INVITATION",
  "WEDDING_RSVP_CARD",
  "WEDDING_MENU_CARD",
  "WEDDING_TABLE_NUMBER",
  "WEDDING_WELCOME_SIGN",
  "WEDDING_THANK_YOU",
  "WEDDING_INSTAGRAM_POST",
  "WEDDING_WHATSAPP_CARD",
];

const BABY_BIRTH_SET: DesignType[] = [
  "BABY_BIRTH_ANNOUNCEMENT",
  "BABY_NURSERY_ART",
  "BABY_WHATSAPP_CARD",
  "BABY_THANK_YOU",
];

const BABY_CEREMONY_SET: DesignType[] = [
  "BABY_BIRTH_ANNOUNCEMENT",
  "BABY_NURSERY_ART",
  "BABY_AQEEQAH_INVITE",
  "BABY_MILESTONE_CARD",
  "BABY_WHATSAPP_CARD",
  "BABY_THANK_YOU",
];

const BABY_BLESSING_SET: DesignType[] = [
  "BABY_BIRTH_ANNOUNCEMENT",
  "BABY_NURSERY_ART",
  "BABY_AQEEQAH_INVITE",
  "BABY_WHATSAPP_CARD",
  "BABY_THANK_YOU",
];

const WEDDING_EVENT_LABELS: Record<string, string> = {
  wedding: "Wedding",
  engagement: "Engagement",
  mehendi: "Mehendi",
  sangeet: "Sangeet",
  reception: "Reception",
};

const BABY_OCCASION_LABELS: Record<string, string> = {
  birth_announcement: "Birth",
  naming_ceremony: "Naming Ceremony",
  aqeeqah: "Aqeeqah",
  baptism: "Baptism",
  christening: "Christening",
  annaprashana: "First Rice Ceremony",
  naam_karan: "Naam Karan",
};

function buildWeddingRoleLabels(eventLabel: string): Partial<Record<DesignType, string>> {
  return {
    WEDDING_INVITATION: `${eventLabel} Invitation`,
    WEDDING_SAVE_THE_DATE: `${eventLabel} Save the Date`,
    WEDDING_RSVP_CARD: `${eventLabel} RSVP`,
    WEDDING_MENU_CARD: `${eventLabel} Details Card`,
    WEDDING_TABLE_NUMBER: "Table Numbers",
    WEDDING_WELCOME_SIGN: `${eventLabel} Welcome Sign`,
    WEDDING_THANK_YOU: `${eventLabel} Thank You`,
    WEDDING_INSTAGRAM_POST: `${eventLabel} Social Post`,
    WEDDING_WHATSAPP_CARD: `${eventLabel} WhatsApp Card`,
  };
}

function buildBabyRoleLabels(occasionLabel: string): Partial<Record<DesignType, string>> {
  return {
    BABY_BIRTH_ANNOUNCEMENT: `${occasionLabel} Announcement`,
    BABY_NURSERY_ART: "Name Art Print",
    BABY_AQEEQAH_INVITE: `${occasionLabel} Invitation`,
    BABY_MILESTONE_CARD: `${occasionLabel} Keepsake Card`,
    BABY_WHATSAPP_CARD: `${occasionLabel} WhatsApp Card`,
    BABY_THANK_YOU: `${occasionLabel} Thank You`,
  };
}

function uniqueDesignTypes(designTypes: DesignType[]): DesignType[] {
  return [...new Set(designTypes)];
}

function resolveWeddingPack(metadata?: Metadata): SuitePack {
  const tradition = String(metadata?.tradition ?? "other");
  const eventType = String(metadata?.eventType ?? "wedding");
  const eventLabel = WEDDING_EVENT_LABELS[eventType] || "Wedding";

  if (eventType === "engagement") {
    return {
      key: `${tradition}_engagement_pack`,
      label: `${eventLabel} Pack`,
      heroDesignType: "WEDDING_INVITATION",
      designTypes: WEDDING_ENGAGEMENT_SUITE,
      designRoleLabels: buildWeddingRoleLabels(eventLabel),
    };
  }

  if (eventType === "mehendi" || eventType === "sangeet") {
    return {
      key: `${tradition}_${eventType}_pack`,
      label: `${eventLabel} Celebration Pack`,
      heroDesignType: "WEDDING_INVITATION",
      designTypes: WEDDING_EVENT_PACK,
      designRoleLabels: buildWeddingRoleLabels(eventLabel),
    };
  }

  if (eventType === "reception") {
    return {
      key: `${tradition}_reception_pack`,
      label: "Reception Pack",
      heroDesignType: "WEDDING_INVITATION",
      designTypes: WEDDING_RECEPTION_PACK,
      designRoleLabels: buildWeddingRoleLabels("Reception"),
    };
  }

  if (tradition === "hindu") {
    return {
      key: "hindu_multi_event_wedding_suite",
      label: "Hindu Multi-Event Wedding Suite",
      heroDesignType: "WEDDING_INVITATION",
      designTypes: WEDDING_FULL_SUITE,
      designRoleLabels: buildWeddingRoleLabels("Wedding"),
    };
  }

  return {
    key: `${tradition}_wedding_suite`,
    label: `${eventLabel} Suite`,
    heroDesignType: "WEDDING_INVITATION",
    designTypes: WEDDING_FULL_SUITE,
    designRoleLabels: buildWeddingRoleLabels(eventLabel),
  };
}

function resolveBabyPack(metadata?: Metadata): SuitePack {
  const tradition = String(metadata?.tradition ?? "other");
  const occasionType = String(metadata?.occasionType ?? "birth_announcement");
  const occasionLabel = BABY_OCCASION_LABELS[occasionType] || "Baby";

  if (occasionType === "birth_announcement") {
    return {
      key: `${tradition}_birth_set`,
      label: "Birth Announcement Set",
      heroDesignType: "BABY_BIRTH_ANNOUNCEMENT",
      designTypes: BABY_BIRTH_SET,
      designRoleLabels: buildBabyRoleLabels("Birth"),
    };
  }

  if (occasionType === "baptism" || occasionType === "christening") {
    return {
      key: `${tradition}_${occasionType}_pack`,
      label: `${occasionLabel} Pack`,
      heroDesignType: "BABY_AQEEQAH_INVITE",
      designTypes: BABY_BLESSING_SET,
      designRoleLabels: buildBabyRoleLabels(occasionLabel),
    };
  }

  return {
    key: `${tradition}_${occasionType}_pack`,
    label: `${occasionLabel} Pack`,
    heroDesignType: occasionType === "aqeeqah" ? "BABY_AQEEQAH_INVITE" : "BABY_BIRTH_ANNOUNCEMENT",
    designTypes: uniqueDesignTypes(BABY_CEREMONY_SET),
    designRoleLabels: buildBabyRoleLabels(occasionLabel),
  };
}

export function resolveSuitePack(
  projectType: ProjectType | string,
  metadata?: Metadata,
): SuitePack {
  if (projectType === "WEDDING") {
    return resolveWeddingPack(metadata);
  }

  if (projectType === "BABY") {
    return resolveBabyPack(metadata);
  }

  return {
    key: "default_suite",
    label: "Default Suite",
    heroDesignType: "WEDDING_INVITATION",
    designTypes: [],
    designRoleLabels: {},
  };
}

export function getSuitePackDesignRole(
  projectType: ProjectType | string,
  designType: DesignType,
  metadata?: Metadata,
): string {
  const pack = resolveSuitePack(projectType, metadata);
  return pack.designRoleLabels[designType] || designType;
}
