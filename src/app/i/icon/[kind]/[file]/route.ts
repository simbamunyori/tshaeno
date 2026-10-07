import { contactIcon, hexFromFile } from "@/server/signatures/icons";
import { iconResponse } from "../../../icon-response";

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; file: string }> }) {
  const { kind, file } = await params;
  const hex = hexFromFile(file);
  const png = hex ? contactIcon(kind, hex) : null;
  return iconResponse(png);
}
