import { useEffect, type RefObject } from "react";
import { useKeyboardHeight } from "./use-keyboard-height";

/**
 * Makes a scrollable container keyboard-aware on iOS/Android.
 *
 * When the virtual keyboard appears:
 * 1. Adds paddingBottom to the scroll container so all content remains reachable.
 * 2. Scrolls the focused input/textarea into view with a small margin.
 *
 * @param scrollRef - Ref to the `overflow-y-auto` scroll container element.
 */
export function useKeyboardAwareScroll(scrollRef: RefObject<HTMLElement | null>) {
    const keyboardHeight = useKeyboardHeight();

    // Adjust paddingBottom when keyboard height changes
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        if (keyboardHeight > 0) {
            el.style.paddingBottom = `${keyboardHeight + 16}px`;
        } else {
            el.style.paddingBottom = "";
        }
    }, [keyboardHeight, scrollRef]);

    // Scroll focused input into view when keyboard opens
    useEffect(() => {
        if (keyboardHeight <= 0) return;

        const el = scrollRef.current;
        if (!el) return;

        const onFocusIn = () => {
            // Small delay to wait for keyboard animation to settle
            requestAnimationFrame(() => {
                const active = document.activeElement;
                if (
                    active &&
                    (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
                    el.contains(active)
                ) {
                    active.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            });
        };

        el.addEventListener("focusin", onFocusIn);
        return () => el.removeEventListener("focusin", onFocusIn);
    }, [keyboardHeight, scrollRef]);

    // Also scroll on initial keyboard open if something is already focused
    useEffect(() => {
        if (keyboardHeight <= 0) return;

        const el = scrollRef.current;
        if (!el) return;

        const timer = setTimeout(() => {
            const active = document.activeElement;
            if (
                active &&
                (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
                el.contains(active)
            ) {
                active.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [keyboardHeight, scrollRef]);

    return { keyboardHeight };
}
