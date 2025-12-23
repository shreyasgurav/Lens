"use client";

import { useEffect, useState } from "react";

interface TypingAnimationProps {
  text: string;
}

export default function TypingAnimation({ text }: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Reset animation when text changes
  useEffect(() => {
    setDisplayedText("");
    setIsDeleting(false);
    setIsPaused(false);
  }, [text]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isPaused) {
      // Wait 3 seconds before starting to delete
      timeout = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 3000);
    } else if (isDeleting) {
      // Delete backwards
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1));
        }, 50);
      } else {
        // Start typing again
        setIsDeleting(false);
      }
    } else {
      // Type forward
      if (displayedText.length < text.length) {
        timeout = setTimeout(() => {
          setDisplayedText(text.slice(0, displayedText.length + 1));
        }, 80);
      } else {
        // Finished typing, pause
        setIsPaused(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, isPaused, text]);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-1">
        <span className="text-2xl text-neutral-900 font-medium">{displayedText}</span>
        <span className={`w-0.5 h-7 bg-neutral-900 transition-opacity ${showCursor ? "opacity-100" : "opacity-0"}`} />
      </div>
    </div>
  );
}
