'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MessageCircle, Mic, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useTRPC } from '@/trpc/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Hola. Puedo orientarte sobre el sistema y consultar que laboratorios estan libres. Puedes escribir o usar el microfono.',
};

export function HelpChatbot() {
  const trpc = useTRPC();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  // Cargar preferencia de audio desde localStorage
  useEffect(() => {
    const stored = localStorage.getItem('chatbot-audio-enabled');
    if (stored !== null) {
      setIsAudioEnabled(stored === 'true');
    }
  }, []);

  // Guardar preferencia de audio cuando cambie
  useEffect(() => {
    localStorage.setItem('chatbot-audio-enabled', String(isAudioEnabled));
  }, [isAudioEnabled]);

  const askMutation = useMutation(
    trpc.help.ask.mutationOptions({
      onSuccess: (data) => {
        setMessages((current) => [...current, { role: 'assistant', content: data.answer }]);
        if (isAudioEnabled) {
          speak(data.answer);
        }
      },
      onError: (error) => {
        setMessages((current) => [
          ...current,
          { role: 'assistant', content: error.message || 'No pude responder en este momento.' },
        ]);
      },
    })
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, askMutation.isPending]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-PE';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function submitQuestion(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || askMutation.isPending) return;

    const history = messages.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((current) => [...current, { role: 'user', content: trimmedQuestion }]);
    setInput('');
    askMutation.mutate({ message: trimmedQuestion, history });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(input);
  }

  function startListening() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'El reconocimiento de voz no esta disponible en este navegador. Prueba con Chrome o Edge.',
        },
      ]);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'es-PE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setIsListening(false);
      setInput(transcript);
      submitQuestion(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'No pude escuchar con claridad. Intenta nuevamente.' },
      ]);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      {isOpen && (
        <section
          className="mb-3 flex h-[520px] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
          aria-label="Asistente de ayuda"
        >
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Asistente de ayuda</h2>
                <p className="text-[11px] text-white/75">Consultas del sistema y horarios</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsAudioEnabled(prev => !prev)}
                className={`rounded-lg p-2 transition hover:bg-white/10 ${isAudioEnabled ? 'text-white' : 'text-white/40'}`}
                title={isAudioEnabled ? 'Desactivar respuesta de voz (Audio activo)' : 'Activar respuesta de voz (Audio desactivado)'}
                aria-label="Alternar respuesta por voz"
              >
                {isAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar asistente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-primary text-white'
                      : 'rounded-bl-md border border-border bg-white text-text-main'
                  }`}
                >
                  {message.content}
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => speak(message.content)}
                      className="ml-2 inline-flex align-middle text-slate-400 transition hover:text-primary"
                      aria-label="Escuchar respuesta"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {askMutation.isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-white px-3 py-2 text-sm text-text-sub">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Consultando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border bg-white p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startListening}
                disabled={askMutation.isPending || isListening}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                  isListening
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-border text-text-sub hover:border-primary/30 hover:bg-primary-light hover:text-primary'
                }`}
                aria-label={isListening ? 'Escuchando' : 'Hacer pregunta por voz'}
              >
                {isListening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={askMutation.isPending}
                placeholder={isListening ? 'Escuchando...' : 'Escribe tu pregunta'}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-slate-50 px-3 text-sm text-text-main outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
              <button
                type="submit"
                disabled={!input.trim() || askMutation.isPending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar pregunta"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/25 transition hover:scale-105 hover:bg-primary/90"
        aria-label={isOpen ? 'Cerrar asistente de ayuda' : 'Abrir asistente de ayuda'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
