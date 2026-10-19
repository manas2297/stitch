/// <reference types="vite/client" />

declare global {
  interface Window {
    go?: {
      desktop?: {
        App?: {
          OpenURL(url: string): void;
          ShowConfirmDialog?(title: string, message: string): Promise<boolean>;
          PickFolder?(title: string): Promise<string>;
          DeleteRepo?(path: string): Promise<string>;
          ToggleMajor?(path: string): Promise<boolean>;
          SetFocus?(path: string): Promise<string>;
          GetProfile?(path: string): Promise<any>;
        };
      };
    };
  }
}

export {};
