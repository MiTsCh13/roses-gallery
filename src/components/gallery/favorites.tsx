"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

import {
  createListAction,
  deleteListAction,
  emailLinkAction,
  sendListAction,
  toggleFavoriteAction,
  type FavoritesResult,
} from "@/app/g/[slug]/favorites-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FavoritesState } from "@/lib/favorites";

type Ctx = {
  state: FavoritesState;
  activeListId: string | null;
  setActive: (id: string) => void;
  isFavorite: (mediaId: string) => boolean;
  toggle: (mediaId: string) => void;
  run: (fn: () => Promise<FavoritesResult>) => void;
  pending: boolean;
  message: string | null;
  slug: string;
};

const FavoritesContext = createContext<Ctx | null>(null);

/** Null outside a public gallery (e.g. the editor preview). */
export function useFavorites() {
  return useContext(FavoritesContext);
}

export function FavoritesProvider({
  slug,
  initial,
  children,
}: {
  slug: string;
  initial: FavoritesState;
  children: ReactNode;
}) {
  const [state, setState] = useState(initial);
  const [active, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // the chosen list, else the first one
  const activeListId =
    state.lists.find((l) => l.id === active)?.id ?? state.lists[0]?.id ?? null;

  const run = useCallback((fn: () => Promise<FavoritesResult>) => {
    start(async () => {
      const result = await fn();
      // a failed call must not wipe the lists the visitor already sees
      if (!result.code || result.code === "sent" || result.code === "link_sent")
        setState(result.state);
      else if (result.state.lists.length) setState(result.state);
      setMessage(result.code ?? null);
    });
  }, []);

  const toggle = useCallback(
    (mediaId: string) =>
      run(async () => {
        const result = await toggleFavoriteAction(slug, mediaId, activeListId);
        return result;
      }),
    [run, slug, activeListId],
  );

  const value = useMemo<Ctx>(() => {
    const list = state.lists.find((l) => l.id === activeListId);
    const ids = new Set(list?.mediaIds ?? []);
    return {
      state,
      activeListId,
      setActive: setActiveId,
      isFavorite: (id) => ids.has(id),
      toggle,
      run,
      pending,
      message,
      slug,
    };
  }, [state, activeListId, toggle, run, pending, message, slug]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function FavoriteButton(props: { mediaId: string; className?: string }) {
  // outside a public gallery (editor preview) there is nothing to favorite
  return useFavorites() ? <FavoriteButtonInner {...props} /> : null;
}

function FavoriteButtonInner({
  mediaId,
  className = "",
}: {
  mediaId: string;
  className?: string;
}) {
  const fav = useFavorites()!;
  const t = useTranslations("PublicGallery");
  const on = fav.isFavorite(mediaId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        fav.toggle(mediaId);
      }}
      aria-pressed={on}
      aria-label={on ? t("favoriteRemove") : t("favoriteAdd")}
      data-testid="favorite-button"
      className={`rounded-full bg-black/50 px-3 py-2 text-xl leading-none text-white hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${className}`}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}

/** Lists, export to the photographer and the magic-link form. */
export function FavoritesPanel() {
  return useFavorites() ? <FavoritesPanelInner /> : null;
}

function FavoritesPanelInner() {
  const fav = useFavorites()!;
  const t = useTranslations("PublicGallery");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { state, activeListId } = fav;
  const active = state.lists.find((l) => l.id === activeListId);

  return (
    <section
      aria-labelledby="favorites-title"
      className="mx-auto w-full max-w-xl space-y-4 px-6 py-10"
    >
      <h2 id="favorites-title" className="text-lg font-semibold">
        {t("favoritesTitle")}
      </h2>
      {fav.message && (
        <p
          role={
            fav.message === "sent" || fav.message === "link_sent"
              ? "status"
              : "alert"
          }
          className="text-sm"
        >
          {t.has(`favoritesMessage.${fav.message}`)
            ? t(`favoritesMessage.${fav.message}`)
            : t("favoritesMessage.invalid")}
        </p>
      )}
      {state.lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("favoritesEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {state.lists.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-sm">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="radio"
                  name="favorite-list"
                  checked={l.id === activeListId}
                  onChange={() => fav.setActive(l.id)}
                />
                <span>
                  {l.name} ({l.mediaIds.length})
                </span>
              </label>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => fav.run(() => deleteListAction(fav.slug, l.id))}
              >
                {t("favoritesDelete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = name;
          setName("");
          fav.run(() => createListAction(fav.slug, value));
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("favoritesNewList")}
          aria-label={t("favoritesNewList")}
          maxLength={60}
          required
        />
        <Button type="submit" variant="outline" disabled={fav.pending}>
          {t("favoritesCreate")}
        </Button>
      </form>
      {active && active.mediaIds.length > 0 && (
        <Button
          type="button"
          disabled={fav.pending}
          onClick={() => fav.run(() => sendListAction(fav.slug, active.id))}
        >
          {t("favoritesSend")}
        </Button>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          fav.run(() => emailLinkAction(fav.slug, email));
        }}
      >
        <p className="text-sm text-muted-foreground">
          {state.hasEmail ? t("favoritesLinkSent") : t("favoritesLinkIntro")}
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={t("favoritesEmail")}
            placeholder={t("favoritesEmail")}
            maxLength={254}
            required
          />
          <Button type="submit" variant="outline" disabled={fav.pending}>
            {t("favoritesLinkSubmit")}
          </Button>
        </div>
      </form>
    </section>
  );
}
