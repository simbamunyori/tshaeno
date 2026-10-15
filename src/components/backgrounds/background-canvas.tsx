"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { draw, H, W, type Style } from "@/lib/backgrounds/draw";
import { cn } from "@/lib/cn";

export interface CanvasDesign {
  style: Style;
  colour: string;
  company: string;
  logoUrl: string | null;
  photoUrl: string | null;
  showName: boolean;
  showTitle: boolean;
}

function useImage(url: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return setImg(null);
    let live = true;
    const i = new Image();
    i.onload = () => live && setImg(i);
    i.onerror = () => live && setImg(null);
    i.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return url ? img : null;
}

export const fileName = (name: string, design: string) => `${[name, design].filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "meeting"}-background.png`;

/** One person's copy of a meeting background, drawn in the browser, with a download button. */
export function BackgroundCanvas({ design, name, title, download, className }: { design: CanvasDesign; name: string; title: string; download?: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const logo = useImage(design.logoUrl);
  const photo = useImage(design.style === "photo" ? design.photoUrl : null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const run = () =>
      draw(ctx, {
        style: design.style,
        colour: design.colour,
        name: design.showName ? name : "",
        title: design.showTitle ? title : "",
        company: design.company,
        logo,
        photo,
      });
    run();
    document.fonts?.ready.then(run).catch(() => {});
  }, [design, name, title, logo, photo]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <canvas ref={canvas} width={W} height={H} role="img" aria-label={`Meeting background${name ? ` for ${name}` : ""}`} className="aspect-video w-full rounded-lg border border-border bg-surface-2" />
      {download ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() =>
            canvas.current?.toBlob((b) => {
              if (!b) return;
              const a = document.createElement("a");
              a.href = URL.createObjectURL(b);
              a.download = download;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            }, "image/png")
          }
        >
          <Download aria-hidden /> Download, 1920 by 1080
        </Button>
      ) : null}
    </div>
  );
}
