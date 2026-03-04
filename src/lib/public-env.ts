export const publicEnv = {
  appTimeZone: process.env.NEXT_PUBLIC_APP_TIME_ZONE ?? "America/Chicago",
  useRemoteApi: process.env.NEXT_PUBLIC_USE_REMOTE_API === "true",
  parentPinHash: process.env.NEXT_PUBLIC_PARENT_PIN_HASH ?? "",
  parentPinPlain: process.env.NEXT_PUBLIC_PARENT_PIN_PLAIN ?? "1234",
  parentPinPepper:
    process.env.NEXT_PUBLIC_PARENT_PIN_PEPPER ?? "herohabits-dev-pepper",
};
