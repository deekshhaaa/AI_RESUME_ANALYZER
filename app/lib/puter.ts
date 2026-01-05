import { create } from "zustand";

declare global {
  interface Window {
    puter: {
      auth: {
        getUser: () => Promise<PuterUser>;
        isSignedIn: () => Promise<boolean>;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
      };
      fs: {
        write: (
          path: string,
          data: string | File | Blob
        ) => Promise<File | undefined>;
        read: (path: string) => Promise<Blob>;
        upload: (file: File[] | Blob[]) => Promise<FSItem>;
        delete: (path: string) => Promise<void>;
        readdir: (path: string) => Promise<FSItem[] | undefined>;
      };
      ai: {
        chat: (
          messages: ChatMessage[] | string,
          imageURL?: string | PuterChatOptions,
          testMode?: boolean,
          options?: PuterChatOptions
        ) => Promise<AIResponse>;
        img2txt: (
          image: string | File | Blob,
          testMode?: boolean
        ) => Promise<string>;
      };
      kv: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<boolean>;
        delete: (key: string) => Promise<boolean>;
        list: (pattern: string, returnValues?: boolean) => Promise<string[]>;
        flush: () => Promise<boolean>;
      };
    };
  }
}

interface PuterStore {
  isLoading: boolean;
  error: string | null;
  puterReady: boolean;

  auth: {
    user: PuterUser | null;
    isAuthenticated: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    checkAuthStatus: () => Promise<boolean>;
    getUser: () => PuterUser | null;
  };

  fs: {
    write: (path: string, data: string | File | Blob) => Promise<File | undefined>;
    read: (path: string) => Promise<Blob | undefined>;
    upload: (files: File[] | Blob[]) => Promise<FSItem | undefined>;
    delete: (path: string) => Promise<void>;
    readDir: (path: string) => Promise<FSItem[] | undefined>;
  };

  ai: {
    chat: (
      messages: ChatMessage[] | string,
      imageURL?: string | PuterChatOptions,
      testMode?: boolean,
      options?: PuterChatOptions
    ) => Promise<AIResponse | undefined>;

    feedback: (
      filePath: string,
      instructions: string
    ) => Promise<AIResponse | undefined>;

    img2txt: (
      image: string | File | Blob,
      testMode?: boolean
    ) => Promise<string | undefined>;
  };

  kv: {
    get: (key: string) => Promise<string | null | undefined>;
    set: (key: string, value: string) => Promise<boolean | undefined>;
    delete: (key: string) => Promise<boolean | undefined>;
    list: (
      pattern: string,
      returnValues?: boolean
    ) => Promise<string[] | undefined>;
    flush: () => Promise<boolean | undefined>;
  };

  init: () => void;
  clearError: () => void;
}

const getPuter = () =>
  typeof window !== "undefined" && window.puter ? window.puter : null;

export const usePuterStore = create<PuterStore>((set, get) => {
  const setError = (msg: string) => set({ error: msg, isLoading: false });

  const checkAuthStatus = async () => {
    const puter = getPuter();
    if (!puter) return false;

    try {
      const isSignedIn = await puter.auth.isSignedIn();
      if (isSignedIn) {
        const user = await puter.auth.getUser();
        set({
          auth: {
            ...get().auth,
            user,
            isAuthenticated: true,
          },
        });
      }
      return isSignedIn;
    } catch {
      return false;
    }
  };

  const init = () => {
    const interval = setInterval(() => {
      if (getPuter()) {
        clearInterval(interval);
        set({ puterReady: true });
        checkAuthStatus();
      }
    }, 100);

    setTimeout(() => clearInterval(interval), 10000);
  };

  /* ---------------- AI ---------------- */

  const chat = async (
    messages: ChatMessage[] | string,
    imageURL?: string | PuterChatOptions,
    testMode?: boolean,
    options?: PuterChatOptions
  ) => {
    const puter = getPuter();
    if (!puter) return;
    return puter.ai.chat(messages, imageURL, testMode, options);
  };

  const feedback = async (filePath: string, instructions: string) => {
    const puter = getPuter();
    if (!puter) return;

    const response = await puter.ai.chat([
      {
        role: "system",
        content:
          "You are an ATS resume analyzer. Return ONLY valid JSON. No markdown.",
      },
      {
        role: "user",
        content: `
Analyze the resume stored at: ${filePath}

${instructions}
`,
      },
    ]);

    return response;
  };

  return {
    isLoading: false,
    error: null,
    puterReady: false,

    auth: {
      user: null,
      isAuthenticated: false,
      signIn: async () => getPuter()?.auth.signIn(),
      signOut: async () => getPuter()?.auth.signOut(),
      refreshUser: async () => {
        const user = await getPuter()?.auth.getUser();
        set({ auth: { ...get().auth, user, isAuthenticated: true } });
      },
      checkAuthStatus,
      getUser: () => get().auth.user,
    },

    fs: {
      write: (p, d) => getPuter()?.fs.write(p, d),
      read: (p) => getPuter()?.fs.read(p),
      upload: (f) => getPuter()?.fs.upload(f),
      delete: (p) => getPuter()?.fs.delete(p),
      readDir: (p) => getPuter()?.fs.readdir(p),
    },

    ai: {
      chat,
      feedback,
      img2txt: (img, t) => getPuter()?.ai.img2txt(img, t),
    },

    kv: {
      get: (k) => getPuter()?.kv.get(k),
      set: (k, v) => getPuter()?.kv.set(k, v),
      delete: (k) => getPuter()?.kv.delete(k),
      list: (p, r) => getPuter()?.kv.list(p, r),
      flush: () => getPuter()?.kv.flush(),
    },

    init,
    clearError: () => set({ error: null }),
  };
});
