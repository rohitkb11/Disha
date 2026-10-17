"use client";
import { useSyncExternalStore } from "react";
import { interfaceText } from "@/lib/ui-translations";
const subscribe = (listener: () => void) => {
  window.addEventListener("disha-language-change", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("disha-language-change", listener);
    window.removeEventListener("storage", listener);
  };
};
export function useUiText() {
  const language = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem("disha-language") || "en",
    () => "en",
  );
  return (text: string) => interfaceText(text, language);
}
