import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Radio } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true; // Importante para ver que el celular escucha
      recognition.lang = 'es-AR'; 

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript) setInterimText(interimTranscript);
        
        if (finalTranscript) {
            onTranscript(finalTranscript);
            // Detener manualmente al tener resultado final para evitar bucles
            recognition.stop();
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event.error);
        if (event.error !== 'no-speech') {
             setIsListening(false);
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome.");
        return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-4">
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`
          relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 shadow-xl
          ${isListening ? 'bg-red-500 scale-105 shadow-red-500/40' : 'bg-black hover:bg-gray-800 shadow-black/20'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        `}
      >
        {isListening && (
           <>
            <span className="absolute w-full h-full rounded-full bg-red-500 animate-ping opacity-20"></span>
            <span className="absolute w-[120%] h-[120%] rounded-full border border-red-500 opacity-20"></span>
           </>
        )}
        {isProcessing ? (
             <Loader2 className="w-10 h-10 text-white animate-spin" />
        ) : isListening ? (
          <Square className="w-8 h-8 text-white z-10" fill="currentColor" />
        ) : (
          <Mic className="w-10 h-10 text-white z-10" />
        )}
      </button>
      
      <div className="h-8 mt-4 flex items-center justify-center w-full">
          {isProcessing ? (
               <p className="text-sm text-gray-500 font-medium animate-pulse">Procesando IA...</p>
          ) : isListening ? (
               <p className="text-sm text-red-500 font-medium animate-pulse flex items-center gap-2">
                   <Radio className="w-4 h-4" /> {interimText || "Escuchando..."}
               </p>
          ) : (
               <p className="text-sm text-gray-400 font-medium">Toca para hablar</p>
          )}
      </div>
    </div>
  );
};

export default VoiceInput;