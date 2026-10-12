"use client";

import {useEffect, useRef, useState} from 'react';
import {Maximize, Minimize, X} from 'lucide-react';
import {ExperiencePreview, type DynamicDesign} from './experience';
import s from './led-fullscreen.module.css';

/** A viewport-sized stage; the slide itself always keeps its broadcast ratio. */
export function LedFullscreenPreview({design, active = false, onClose}: {
  design: DynamicDesign;
  active?: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  const mountedRef = useRef(false);
  const exitRequestedRef = useRef(false);
  const wasFullscreenRef = useRef(false);
  const [supported, setSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    onCloseRef.current();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const surface = surfaceRef.current;
    if (!dialog || !surface) return;
    mountedRef.current = true;
    closingRef.current = false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    setSupported(Boolean(document.fullscreenEnabled && surface.requestFullscreen));

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    closeButtonRef.current?.focus({preventScroll: true});

    function fullscreenChanged() {
      const current = document.fullscreenElement === surface;
      const escaped = wasFullscreenRef.current && !current && !exitRequestedRef.current;
      wasFullscreenRef.current = current;
      exitRequestedRef.current = false;
      if (mountedRef.current) setFullscreen(current);
      // Browsers consume Escape when leaving fullscreen; close the viewer too.
      if (escaped) close();
    }

    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      // showModal provides a native focus trap; keep the fallback accessible too.
      if (event.key === 'Tab' && typeof dialog!.showModal !== 'function') {
        const controls = Array.from(dialog!.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]'));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    }
    document.addEventListener('fullscreenchange', fullscreenChanged);
    dialog.addEventListener('keydown', keyboard);
    return () => {
      mountedRef.current = false;
      closingRef.current = true;
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      dialog.removeEventListener('keydown', keyboard);
      if (document.fullscreenElement === surface) void document.exitFullscreen().catch(() => {});
      if (dialog.open) dialog.close?.();
      document.body.style.overflow = bodyOverflow;
      document.body.style.overscrollBehavior = bodyOverscroll;
      document.documentElement.style.overflow = rootOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
    };
  }, []);

  async function toggleFullscreen() {
    const surface = surfaceRef.current;
    if (!surface) return;
    setNotice('');
    try {
      if (document.fullscreenElement === surface) {
        exitRequestedRef.current = true;
        await document.exitFullscreen();
      } else {
        // Fullscreen is requested only from this explicit user gesture.
        await surface.requestFullscreen();
      }
    } catch {
      exitRequestedRef.current = false;
      if (mountedRef.current) setNotice('Volledig scherm is niet beschikbaar. Het voorbeeld blijft zo groot mogelijk zichtbaar.');
    }
  }

  return <dialog
    ref={dialogRef}
    className={s.dialog}
    aria-label={`Schermvoorbeeld: ${design.name}`}
    aria-modal="true"
    onCancel={event => { event.preventDefault(); close(); }}
  >
    <div ref={surfaceRef} className={s.surface}>
      <div className={s.slide} data-orientation={design.orientation}>
        <ExperiencePreview design={design} active={active}/>
      </div>
      <div className={s.toolbar} aria-label="Voorbeeldbediening">
        {supported && <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Volledig scherm verlaten' : 'Volledig scherm openen'} title={fullscreen ? 'Volledig scherm verlaten' : 'Volledig scherm openen'}>
          {fullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
        </button>}
        <button ref={closeButtonRef} type="button" onClick={close} aria-label="Schermvoorbeeld sluiten" title="Sluiten (Esc)"><X size={22}/></button>
      </div>
      <p className={s.notice} role="status">{notice}</p>
    </div>
  </dialog>;
}
