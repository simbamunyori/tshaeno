/**
 * The signature document: what the studio edits and the renderer turns
 * into email-safe HTML. Plain data, safe to store as JSON and to share
 * between the server and the browser.
 */

export const DOC_VERSION = 1 as const;

/** A colour from the brand kit, or a fixed hex colour. */
export type ColourRef = "primary" | "secondary" | "text" | "muted" | `#${string}`;

export type TextSize = "xs" | "sm" | "md" | "lg" | "xl";
export type Align = "left" | "center" | "right";

interface BlockBase {
  id: string;
}

export interface TextBlock extends BlockBase {
  type: "text";
  /** Plain text with {{field}} tokens. New lines become line breaks. */
  text: string;
  size: TextSize;
  bold: boolean;
  italic: boolean;
  colour: ColourRef;
  align: Align;
  /** Letter case for short labels such as a job title. */
  uppercase?: boolean;
}

export type ImageSource = "logo" | "photo" | "asset";
export type ImageShape = "square" | "rounded" | "circle";

export interface ImageBlock extends BlockBase {
  type: "image";
  source: ImageSource;
  /** For source "asset": an uploaded image. */
  assetId?: string;
  width: number;
  shape: ImageShape;
  /** Where clicking the image goes. Tokens allowed, for example {{website}}. */
  link: string;
  align: Align;
}

export type ContactKind = "phone" | "mobile" | "email" | "website" | "address";
export type ContactLabels = "icons" | "letters" | "none";

export interface ContactsBlock extends BlockBase {
  type: "contacts";
  items: ContactKind[];
  layout: "stacked" | "inline";
  labels: ContactLabels;
  size: TextSize;
  colour: ColourRef;
  /** Colour for icons and letter labels. */
  accent: ColourRef;
  align: Align;
}

export interface SocialsBlock extends BlockBase {
  type: "socials";
  size: 16 | 20 | 24 | 28;
  colour: ColourRef;
  align: Align;
}

export interface DividerBlock extends BlockBase {
  type: "divider";
  colour: ColourRef;
  thickness: 1 | 2 | 3 | 4;
  /** Percentage of the signature's width. */
  width: number;
  align: Align;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  label: string;
  url: string;
  colour: ColourRef;
  textColour: ColourRef;
  rounded: boolean;
  align: Align;
}

export interface BannerBlock extends BlockBase {
  type: "banner";
  assetId?: string;
  width: number;
  link: string;
  alt: string;
  align: Align;
}

export interface DisclaimerBlock extends BlockBase {
  type: "disclaimer";
  size: TextSize;
  colour: ColourRef;
  align: Align;
}

export interface ColumnsBlock extends BlockBase {
  type: "columns";
  left: Block[];
  right: Block[];
  /** Width of the left column in pixels; the right takes the rest. */
  leftWidth: number;
  gap: number;
  /** A thin vertical rule between the columns. */
  rule: boolean;
  ruleColour: ColourRef;
  valign: "top" | "middle";
}

export type LeafBlock =
  | TextBlock
  | ImageBlock
  | ContactsBlock
  | SocialsBlock
  | DividerBlock
  | SpacerBlock
  | ButtonBlock
  | BannerBlock
  | DisclaimerBlock;

export type Block = LeafBlock | ColumnsBlock;
export type BlockType = Block["type"];

export interface SignatureDoc {
  version: typeof DOC_VERSION;
  /** Widest the signature gets, in pixels. It shrinks on phones. */
  width: number;
  /** Base text size in pixels; block sizes scale from it. */
  baseSize: number;
  blocks: Block[];
}

/** A template is either built in the studio or written as HTML. */
export type TemplateContent = { kind: "VISUAL"; doc: SignatureDoc } | { kind: "HTML"; html: string };

export type FontKey = "arial" | "helvetica" | "verdana" | "tahoma" | "trebuchet" | "georgia" | "times" | "segoe" | "courier";

export type SocialNetwork = "linkedin" | "x" | "facebook" | "instagram" | "youtube" | "tiktok" | "github" | "whatsapp" | "threads";

export interface SocialLink {
  network: SocialNetwork;
  url: string;
}

/** An image ready to put in an email: an absolute URL and its real size. */
export interface ImageRef {
  url: string;
  width: number;
  height: number;
}

export interface BrandColours {
  primary: string;
  secondary: string;
  text: string;
  muted: string;
}

/** What a brand kit gives the renderer. */
export interface BrandData {
  colours: BrandColours;
  font: FontKey;
  company: string;
  website: string;
  address: string;
  disclaimer: string;
  socials: SocialLink[];
  logo: ImageRef | null;
}

/** One person's details, from the directory. */
export interface PersonData {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  department: string;
  /** The office or city. Older callers may leave it out. */
  location?: string;
  phone: string;
  mobile: string;
  photo: ImageRef | null;
  custom: Record<string, string>;
  /** Their own social links, used in place of the company's for the same network. */
  socials?: Partial<Record<SocialNetwork, string>>;
}

export interface RenderContext {
  brand: BrandData;
  person: PersonData;
  /** Uploaded images the document refers to, by asset id. */
  assets: Record<string, ImageRef>;
  /** Absolute origin for generated icons, for example https://app.tshaeno.com. */
  origin: string;
}
