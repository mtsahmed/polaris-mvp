// Shared by the server layout and the client sidebar, so it must not live in a "use client" file
// (a server component importing a constant from one gets a client reference, not the value).

export const SIDEBAR_COOKIE = "polaris_sidebar";
// Literal class strings, so Tailwind generates them.
export const SIDEBAR_HIDE = "md:group-data-[collapsed=true]/sidebar:hidden";
export const SIDEBAR_LABEL = "md:group-data-[collapsed=true]/sidebar:sr-only";
export const SIDEBAR_CENTER = "md:group-data-[collapsed=true]/sidebar:justify-center md:group-data-[collapsed=true]/sidebar:px-0";
