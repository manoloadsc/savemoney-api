import path from "path";

export const dirname =
  typeof __APP_DIRNAME__ !== 'undefined'
    ? __APP_DIRNAME__
    : path.resolve('./')