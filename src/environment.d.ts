/* eslint-disable @typescript-eslint/consistent-type-definitions */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      DB_SECRET: string;
      DB_CA_BUNDLE_FILE: string;
    }
  }
}

export {};
