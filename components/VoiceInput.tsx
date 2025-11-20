import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Radio, Send } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState(''); // Texto acumulado
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Escucha continua hasta que el usuario pare
      recognition.interimResults = true;
      recognition.lang = 'es-AR'; 

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentFinal += event.results[i][0].transcript + ' ';
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (currentFinal) {
            setFinalText(prev => prev + currentFinal);
        }
        setInterimText(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event.error);
        // No paramos automáticamente en error 'no-speech' para dar más tiempo
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
             setIsListening(false);
             alert("Permiso de micrófono denegado.");
        }
      };
      
      recognition.onend = () => {
        // Si el usuario no lo paró manualmente, intentamos reiniciar si fue un corte inesperado
        // Pero para simplicidad, dejamos que el usuario reactive si se corta.
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const handleToggle = () => {
    if (!recognitionRef.current) {
        alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome.");
        return;
    }

    if (isListening) {
      // STOP: Parar y enviar
      recognitionRef.current.stop();
      setIsListening(false);
      
      // Combinar lo último que se escuchó
      const fullText = (finalText + interimText).trim();
      if (fullText) {
          onTranscript(fullText);
          setFinalText('');
          setInterimText('');
      }
    } else {
      // START
      setFinalText('');
      setInterimText('');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-4">
      <button
        onClick={handleToggle}
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
           </>
        )}
        {isProcessing ? (
             <Loader2 className="w-10 h-10 text-white animate-spin" />
        ) : isListening ? (
          <Send className="w-8 h-8 text-white z-10 ml-1" fill="currentColor" /> 
        ) : (
          <Mic className="w-10 h-10 text-white z-10" />
        )}
      </button>
      
      <div className="min-h-[3rem] mt-4 px-4 w-full text-center">
          {isProcessing ? (
               <p className="text-sm text-gray-500 font-medium animate-pulse">Procesando...</p>
          ) : isListening ? (
               <div className="text-sm text-gray-800 font-medium animate-pulse">
                   <p className="text-xs text-red-500 uppercase font-bold mb-1 flex items-center justify-center gap-1"><Radio className="w-3 h-3"/> Escuchando</p>
                   "{finalText} {interimText}"
                   <p className="text-[10px] text-gray-400 mt-1">(Toca de nuevo para enviar)</p>
               </div>
          ) : (
               <p className="text-sm text-gray-400 font-medium">Toca para hablar</p>
          )}
      </div>
    </div>
  );
};

export default VoiceInput;