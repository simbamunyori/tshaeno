export function lockedMessage(until?: Date | null): string {
  const time =
    until && !Number.isNaN(until.getTime())
      ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Gaborone" }).format(until)
      : null;
  return time
    ? `Too many attempts. For your safety, sign-in is paused until ${time}.`
    : "Too many attempts. For your safety, sign-in is paused for 15 minutes.";
}
