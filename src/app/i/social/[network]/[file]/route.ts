import { hexFromFile, socialIcon } from "@/server/signatures/icons";
import { iconResponse } from "../../../icon-response";

export async function GET(_req: Request, { params }: { params: Promise<{ network: string; file: string }> }) {
  const { network, file } = await params;
  const hex = hexFromFile(file);
  const png = hex ? socialIcon(network, hex) : null;
  return iconResponse(png);
}
