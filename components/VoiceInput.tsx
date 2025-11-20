import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // En móviles es mejor false para evitar cortes
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-AR'; // Forzar español Argentina

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
            onTranscript(transcript);
        }
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        // Ignorar error 'no-speech' si es muy rápido, pero resetear estado
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Tu navegador no soporta reconocimiento de voz. Intenta usar Chrome o Safari.");
        return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting speech:", e);
        setIsListening(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-6">
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`
          relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-lg touch-manipulation
          ${isListening ? 'bg-red-500 scale-110 shadow-red-500/50' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        `}
      >
        {isListening && (
           <span className="absolute w-full h-full rounded-full bg-red-500 animate-ping opacity-75"></span>
        )}
        {isProcessing ? (
             <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : isListening ? (
          <Square className="w-8 h-8 text-white z-10" fill="currentColor" />
        ) : (
          <Mic className="w-8 h-8 text-white z-10" />
        )}
      </button>
      <p className="mt-4 text-sm text-gray-500 font-medium animate-fade-in-down">
        {isProcessing ? 'Procesando...' : isListening ? 'Te escucho...' : 'Toca para hablar'}
      </p>
    </div>
  );
};

export default VoiceInput;