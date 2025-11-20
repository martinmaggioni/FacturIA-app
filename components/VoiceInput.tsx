import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-AR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-6">
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`
          relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-lg
          ${isListening ? 'bg-red-500 scale-110' : 'bg-blue-600 hover:bg-blue-700'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isListening && (
           <span className="absolute w-full h-full rounded-full bg-red-500 animate-ping opacity-75"></span>
        )}
        {isListening ? (
          <Square className="w-8 h-8 text-white z-10" fill="currentColor" />
        ) : (
          <Mic className="w-8 h-8 text-white z-10" />
        )}
      </button>
      <p className="mt-4 text-sm text-gray-500 font-medium">
        {isListening ? 'Escuchando...' : 'Toca para hablar'}
      </p>
    </div>
  );
};

export default VoiceInput;