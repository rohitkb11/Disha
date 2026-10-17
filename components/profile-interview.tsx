"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mic, Volume2 } from "lucide-react";
import { toast } from "sonner";
import type { Lang, Profile } from "@/lib/types";
const QUESTIONS = {
  en: [
    "What would you like us to call you?",
    "What do you enjoy doing? For example, drawing, helping people, making things or working with technology.",
    "What would you like to learn or work towards?",
    "Which district do you live in?",
    "Which school grade are you in? Enter 9, 10, 11, 12 or 15 for college.",
    "How many hours could you spend learning each week?",
  ],
  hi: [
    "हम आपको किस नाम से बुलाएँ?",
    "आपको क्या करना पसंद है? जैसे चित्र बनाना, लोगों की मदद करना, चीज़ें बनाना या तकनीक।",
    "आप क्या सीखना या करना चाहते हैं?",
    "आप किस जिले में रहते हैं?",
    "आप किस कक्षा में हैं? 9, 10, 11, 12 या कॉलेज के लिए 15 लिखें।",
    "हर सप्ताह सीखने के लिए कितने घंटे दे सकते हैं?",
  ],
  mr: [
    "तुम्हाला कोणत्या नावाने हाक मारू?",
    "तुम्हाला काय करायला आवडते? चित्रकला, लोकांना मदत, वस्तू बनवणे की तंत्रज्ञान?",
    "तुम्हाला काय शिकायचे किंवा साध्य करायचे आहे?",
    "तुम्ही कोणत्या जिल्ह्यात राहता?",
    "तुम्ही कोणत्या इयत्तेत आहात? 9, 10, 11, 12 किंवा महाविद्यालयासाठी 15 लिहा.",
    "आठवड्यात शिकण्यासाठी किती तास देता येतील?",
  ],
};
const INTEREST_WORDS: [string, RegExp][] = [
  ["Art & design", /design|draw|art|चित्र|डिझ|डिज़|कला/i],
  ["Helping people", /help|care|मदद|मदत|सेवा/i],
  ["Making things", /mak|repair|build|बनाना|बनव|दुरुस्त/i],
  ["Technology", /tech|computer|coding|तकनीक|तंत्र|संगणक|कंप्यूटर/i],
  ["Teaching", /teach|शिक्ष|पढ़ा|शिकव/i],
  ["Business", /business|sell|shop|व्यापार|व्यवसाय|दुकान/i],
  ["Nature & farming", /farm|nature|कृषि|शेती|निसर्ग/i],
  ["Communication", /talk|communicat|बात|संवाद|बोल/i],
];
export default function ProfileInterview({
  profile,
  lang,
  onReview,
}: {
  profile: Profile;
  lang: Lang;
  onReview: (p: Profile) => void;
}) {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [draft, setDraft] = useState(profile);
  const [listening, setListening] = useState(false);
  const recognition = useRef<any>(null);
  useEffect(
    () => () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const question = QUESTIONS[lang][step];
  function hear() {
    if (!("speechSynthesis" in window)) {
      toast.info("Audio is not supported on this device.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = `${lang === "en" ? "en" : lang}-IN`;
    window.speechSynthesis.speak(utterance);
  }
  function record() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Speech) {
      toast.info("Voice input is unavailable here. Type your answer below.");
      return;
    }
    const rec = new Speech();
    rec.lang = `${lang === "en" ? "en" : lang}-IN`;
    rec.onresult = (event: any) => setAnswer(event.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.info(
        "Check microphone access and your connection, or type your answer.",
      );
    };
    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      toast.info("Microphone unavailable. Type your answer instead.");
    }
  }
  function next() {
    const value = answer.trim();
    if (!value) return;
    const next = { ...draft };
    if (step === 0) next.name = value.slice(0, 100);
    if (step === 1) {
      const suggestions = INTEREST_WORDS.filter(([, regex]) =>
        regex.test(value),
      ).map(([interest]) => interest);
      next.interests = [...new Set([...next.interests, ...suggestions])];
    }
    if (step === 2) next.goals = value.slice(0, 2000);
    if (step === 3) next.district = value.slice(0, 100);
    if (step >= 4) {
      const number = Number(
        value
          .replace(/[०-९]/g, (ch) => String(ch.charCodeAt(0) - 0x0966))
          .match(/\d+/)?.[0],
      );
      if (step === 4 && ![8, 9, 10, 11, 12, 15].includes(number)) {
        toast.info("Enter a grade number: 8–12, or 15 for college.");
        return;
      }
      if (step === 4) {
        next.education = number;
        next.grade = number === 15 ? "Graduation" : String(number);
      } else {
        if (number < 0 || number > 100 || !Number.isFinite(number)) {
          toast.info("Enter a number of hours from 0 to 100.");
          return;
        }
        next.hours = number;
      }
    }
    setDraft(next);
    setAnswer("");
    recognition.current?.abort();
    window.speechSynthesis?.cancel();
    if (step === QUESTIONS[lang].length - 1) onReview(next);
    else setStep(step + 1);
  }
  return (
    <div className="profile-interview">
      <span className="eyebrow">
        GUIDED DISCOVERY · {step + 1}/{QUESTIONS[lang].length}
      </span>
      <h3>{question}</h3>
      <p className="subtle">
        Speak or type. You will review and correct every profile field before
        saving. Voice recognition depends on this browser and may need internet.
      </p>
      <div className="tag-row">
        <button type="button" className="button secondary small" onClick={hear}>
          <Volume2 size={15} />
          {lang === "en"
            ? "Hear the question"
            : lang === "hi"
              ? "प्रश्न सुनें"
              : "प्रश्न ऐका"}
        </button>
        <button
          type="button"
          className={`button secondary small ${listening ? "recording" : ""}`}
          onClick={record}
        >
          <Mic size={15} />
          {listening
            ? "Stop"
            : lang === "en"
              ? "Speak my answer"
              : lang === "hi"
                ? "बोलकर जवाब दें"
                : "बोलून उत्तर द्या"}
        </button>
      </div>
      <label>
        Your answer
        <input
          autoFocus
          value={answer}
          maxLength={2000}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              next();
            }
          }}
        />
      </label>
      <div className="modal-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => onReview(draft)}
        >
          Review profile now
        </button>
        <button
          type="button"
          className="button"
          disabled={!answer.trim()}
          onClick={next}
        >
          {step === QUESTIONS[lang].length - 1
            ? "Review my profile"
            : "Next question"}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
