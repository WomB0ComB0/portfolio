'use client';

/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file The guestbook's compose card: sign in, then write.
 *
 * Signed out, it is one line and a Sign in button, and Firebase is not loaded. Pressing Sign in
 * loads it (src/core/auth): a visitor with a saved session goes straight to the box, anyone else
 * chooses Google, GitHub or guest. A two-step press on purpose: Firebase opens a provider's popup
 * only after its auth iframe is ready, and Safari and phones block a popup that opens long after
 * the click, so the choice comes once that iframe is loading, not before.
 *
 * Signed in, it is a labelled box with a live character count (red past 280; nothing cuts a long
 * draft silently). Posting clears the box at once (the row shows in the list) and makes it
 * read-only until the API answers, so a failure puts back exactly what was sent and says why. A
 * draft the check would change (markup, a script prefix) is shown as it will post, and a second
 * press sends it. Errors are role=alert lines in the card; notes and success go to its role=status
 * line. Only a problem with the text marks the box invalid. Nothing uses a toast or reloads.
 *
 * The text in the box belongs to the card, not the signed-in panel: signing out and in again (or
 * the session ending while a post was being sent) keeps it. A post refused for its sign-in signs
 * the visitor out (../_lib/post.ts) and says to sign in again; that line stays while they are
 * signed out, beside the sign-in choices, and goes once they are signed in again, with their text
 * back in the box.
 *
 * Focus is never dropped to the page: busy buttons use aria-disabled, never disabled. When the
 * visitor signs in or out on this card, the new panel takes focus (the box, or the first choice),
 * unless they have moved focus elsewhere; a card that mounts already signed in (a client-side
 * return to /guestbook) leaves focus where it is. After a post, focus is in the box.
 */

import {
  type FormEvent,
  type ReactElement,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { LoginButton } from '@/components/custom/login-button';
import { LogoutButton } from '@/components/custom/logout-button';
import { Button } from '@/components/ui/button';
import {
  type AuthPhase,
  prepareSignIn,
  type SessionUser,
  type SignInMethod,
  useAuth,
} from '@/core/auth';
import {
  authorNameOf,
  checkDraft,
  DRAFT_OVER_LIMIT,
  MESSAGE_MAX_LENGTH,
  rewriteNotice,
} from '../_lib/draft';
import {
  CARD_CLASS,
  CARD_TEXT_CLASS,
  CARD_TITLE_CLASS,
  COMPOSE_FOOT_CLASS,
  COUNTER_CLASS,
  COUNTER_OVER_CLASS,
  ERROR_CLASS,
  FIELD_LABEL_CLASS,
  PROVIDERS_CLASS,
  SIGNED_IN_CLASS,
  STATUS_CLASS,
  TEXT_BUTTON_CLASS,
  TEXTAREA_CLASS,
} from './guestbook-classes';
import type { PostMessage } from './use-posted-messages';

const TITLE_ID = 'guestbook-compose';
const FIELD_ID = 'guestbook-message';
const COUNTER_ID = 'guestbook-message-count';
const ERROR_ID = 'guestbook-message-error';
const METHODS: readonly SignInMethod[] = ['google.com', 'github.com', 'anonymous'];

const INVITE = 'Sign in with Google or GitHub, or as a guest, to leave a message.';
const CHOOSE = 'Choose how to sign in. A guest posts as Anonymous.';
const NO_SCRIPT = 'Signing in needs JavaScript.';
const POSTED = 'Posted. Thanks for signing.';

export interface ComposeCardProps {
  readonly onPost: PostMessage;
}

/**
 * Whether focus may be moved into `root`: it is on nothing (the element that had it was removed)
 * or already inside `root`. Anywhere else, the visitor put it there, so it stays.
 */
function focusIsFree(root: Element | null): boolean {
  const active = document.activeElement;
  return !active || active === document.body || Boolean(root?.contains(active));
}

/** Focuses `root`'s first button, unless the visitor has put focus somewhere else. */
function focusFirstButton(root: HTMLElement | null): void {
  if (focusIsFree(root)) root?.querySelector('button')?.focus();
}

/**
 * Whether the visitor has signed in or out since this card mounted. Only then does the panel that
 * replaces the old one take focus; a card that mounts signed in leaves focus alone.
 */
function useSwitchedSinceMount(signedIn: boolean): boolean {
  const [seen, setSeen] = useState({ signedIn, switched: false });
  // Adjusting state to a changed input during render (React's documented pattern for it).
  if (seen.signedIn !== signedIn) setSeen({ signedIn, switched: true });
  return seen.switched || seen.signedIn !== signedIn;
}

/** Sign in, or the choices once Firebase is loading; focus follows the press to the choices. */
function SignInPanel({
  phase,
  takeFocus,
}: {
  readonly phase: AuthPhase;
  /** It replaced the signed-in box (Sign out): its first button takes focus. */
  readonly takeFocus: boolean;
}): ReactElement {
  const choices = phase === 'ready' || phase === 'signing-in';
  const preparing = phase === 'preparing';
  const panel = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);

  useEffect(() => {
    if (takeFocus) focusFirstButton(panel.current);
  }, [takeFocus]);
  useEffect(() => {
    if (!choices || !pressed.current) return;
    pressed.current = false;
    focusFirstButton(panel.current);
  }, [choices]);

  const start = () => {
    if (preparing) return;
    pressed.current = true;
    void prepareSignIn();
  };

  return (
    <div ref={panel} className="contents">
      {choices ? (
        <>
          <p className={CARD_TEXT_CLASS}>{CHOOSE}</p>
          <div className={PROVIDERS_CLASS}>
            {METHODS.map((method) => (
              <LoginButton key={method} signInMethod={method} disabled={phase === 'signing-in'} />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className={CARD_TEXT_CLASS}>{INVITE}</p>
          <div>
            <Button
              type="button"
              onClick={start}
              aria-disabled={preparing || undefined}
              aria-busy={preparing || undefined}
            >
              {preparing ? 'Preparing sign-in…' : 'Sign in'}
            </Button>
          </div>
          <noscript>
            <p className={CARD_TEXT_CLASS}>{NO_SCRIPT}</p>
          </noscript>
        </>
      )}
    </div>
  );
}

/** Why the last post failed (network, server, rate limit, sign-in): the text itself is fine. */
interface PostProblem {
  readonly text: string;
  /** The visitor has to sign in again; the card says so while they are signed out. */
  readonly needsSignIn: boolean;
}

/** What the card keeps whether or not the visitor is signed in. */
interface KeptDraft {
  readonly draft: string;
  readonly setDraft: (draft: string) => void;
  readonly postError: PostProblem | null;
  readonly setPostError: (problem: PostProblem | null) => void;
}

/**
 * The box's text and the last post failure, kept by the card rather than the signed-in panel, so
 * a sign-out (the visitor's, or Firebase's when the session has ended mid-post) loses neither.
 * Signing in clears the failure: it said to sign in, and that is done.
 */
function useKeptDraft(signedIn: boolean): KeptDraft {
  const [draft, setDraft] = useState('');
  const [postError, setPostError] = useState<PostProblem | null>(null);
  const [wasSignedIn, setWasSignedIn] = useState(signedIn);
  // Adjusting state to a changed input during render (React's documented pattern for it).
  if (wasSignedIn !== signedIn) {
    setWasSignedIn(signedIn);
    if (signedIn) setPostError(null);
  }
  return { draft, setDraft, postError, setPostError };
}

interface ComposerOptions {
  readonly user: SessionUser;
  readonly onPost: PostMessage;
  readonly kept: KeptDraft;
  readonly form: RefObject<HTMLFormElement | null>;
  readonly field: RefObject<HTMLTextAreaElement | null>;
}

/**
 * The box's state and its submit: a draft the check would change is shown first; a post clears
 * the box (read-only while it sends), puts the exact text back if it fails, then focuses the box.
 */
function useComposer({ user, onPost, kept, form, field }: ComposerOptions) {
  const { draft, setDraft, postError, setPostError } = kept;
  /** A problem with the text: drives aria-invalid. */
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  /** The changed text the visitor was shown, so the next press of Post sends it. */
  const [shown, setShown] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setPostError(null);
    const checked = checkDraft(draft);
    if (!checked.ok) {
      setStatus('');
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    if (checked.changed && shown !== checked.text) {
      setShown(checked.text);
      setStatus(rewriteNotice(checked.text));
      return;
    }
    const typed = draft;
    setShown(null);
    setStatus('');
    setSending(true);
    setDraft('');
    const outcome = await onPost({ authorName: authorNameOf(user), message: checked.text });
    setSending(false);
    if (outcome.ok) setStatus(POSTED);
    else {
      // The box was read-only while sending, so it is still empty: this is exactly what was sent.
      // Both setters are the card's, so this holds even if the session ended and the form is gone.
      setDraft(typed);
      setPostError({ text: outcome.error, needsSignIn: outcome.needsSignIn });
    }
    if (focusIsFree(form.current)) field.current?.focus();
  };
  const change = (value: string) => {
    setDraft(value);
    setFieldError(null);
    setPostError(null);
    setShown(null);
    setStatus('');
  };
  return { draft, fieldError, postError, status, sending, submit, change };
}

/** The live character count beside Post; Post stays focusable while it sends. */
function ComposeFoot({ draft, sending }: { readonly draft: string; readonly sending: boolean }) {
  const over = draft.length > MESSAGE_MAX_LENGTH;
  const unavailable = sending || draft.trim() === '';
  return (
    <div className={COMPOSE_FOOT_CLASS}>
      <span id={COUNTER_ID} className={over ? COUNTER_OVER_CLASS : COUNTER_CLASS}>
        {draft.length} / {MESSAGE_MAX_LENGTH}
      </span>
      <span className="sr-only" aria-live="polite">
        {over ? DRAFT_OVER_LIMIT : ''}
      </span>
      <Button
        type="submit"
        aria-disabled={unavailable || undefined}
        aria-busy={sending || undefined}
      >
        {sending ? 'Posting…' : 'Post message'}
      </Button>
    </div>
  );
}

/** Who is posting, with Sign out as a link in the line. */
function SignedInAs({ user }: { readonly user: SessionUser }) {
  return (
    <p className={SIGNED_IN_CLASS}>
      Signed in as {authorNameOf(user)} · <LogoutButton className={TEXT_BUTTON_CLASS} />
    </p>
  );
}

/** The signed-in box: label, text, count and Post, then who is signed in. */
function ComposeForm({
  user,
  onPost,
  kept,
  takeFocus,
}: {
  readonly user: SessionUser;
  readonly onPost: PostMessage;
  /** The card's text and last post failure. */
  readonly kept: KeptDraft;
  /** The visitor just signed in on this card: the box takes focus. */
  readonly takeFocus: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const { draft, fieldError, postError, status, sending, submit, change } = useComposer({
    user,
    onPost,
    kept,
    form,
    field,
  });
  useEffect(() => {
    if (takeFocus && focusIsFree(form.current)) field.current?.focus();
  }, [takeFocus]);
  const error = fieldError ?? postError?.text;

  return (
    <form ref={form} onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={FIELD_ID} className={FIELD_LABEL_CLASS}>
        Your message
      </label>
      <textarea
        ref={field}
        id={FIELD_ID}
        name="message"
        rows={3}
        value={draft}
        readOnly={sending}
        onChange={(event) => change(event.target.value)}
        placeholder="Say hello, or leave a note…"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={error ? `${COUNTER_ID} ${ERROR_ID}` : COUNTER_ID}
        className={TEXTAREA_CLASS}
      />
      {error && (
        <p id={ERROR_ID} role="alert" className={ERROR_CLASS}>
          {error}
        </p>
      )}
      <ComposeFoot draft={draft} sending={sending} />
      <SignedInAs user={user} />
      <p role="status" className={STATUS_CLASS}>
        {status}
      </p>
    </form>
  );
}

/** The compose card. `onPost` posts a checked draft (the board's optimistic post). */
export function ComposeCard({ onPost }: ComposeCardProps): ReactElement {
  const { phase, user, error } = useAuth();
  const switched = useSwitchedSinceMount(user !== null);
  const kept = useKeptDraft(user !== null);
  const preparing = phase === 'preparing';
  /** Signed out after a post refused for its sign-in: why, above the choices' own errors. */
  const signInNote = !user && kept.postError?.needsSignIn ? kept.postError.text : null;
  return (
    <section
      aria-labelledby={TITLE_ID}
      data-state={preparing ? 'loading' : 'ready'}
      aria-busy={preparing || undefined}
      className={CARD_CLASS}
    >
      <h2 id={TITLE_ID} className={CARD_TITLE_CLASS}>
        Sign the guestbook
      </h2>
      {user ? (
        <ComposeForm user={user} onPost={onPost} kept={kept} takeFocus={switched} />
      ) : (
        <SignInPanel phase={phase} takeFocus={switched} />
      )}
      {signInNote && (
        <p role="alert" className={ERROR_CLASS}>
          {signInNote}
        </p>
      )}
      {error && (
        <p role="alert" className={ERROR_CLASS}>
          {error}
        </p>
      )}
    </section>
  );
}
ComposeCard.displayName = 'ComposeCard';
